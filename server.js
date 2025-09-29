require('dotenv').config();

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Import SQLite Database Manager, Validation Utils, and Booking Logic
const DatabaseManager = require('./database');
const ValidationUtils = require('./js/shared/validationUtils');
const BookingLogic = require('./js/shared/bookingLogic');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize SQLite database
const db = new DatabaseManager();

// Migrate from JSON if exists
const DATA_FILE = path.join(__dirname, 'data', 'bookings.json');
fs.access(DATA_FILE)
  .then(() => {
    console.info('Migrating existing JSON data to SQLite...');
    return db.migrateFromJSON(DATA_FILE);
  })
  .then(() => {
    // Rename JSON file after successful migration
    const backupFile = `${DATA_FILE}.migrated-${Date.now()}`;
    return fs.rename(DATA_FILE, backupFile);
  })
  .then(() => {
    console.info('Migration complete. JSON backup saved.');
  })
  .catch((err) => {
    if (err.code !== 'ENOENT') {
      console.error('Migration error:', err);
    }
  });

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"], // For AJAX requests
      },
    },
  })
);

// CORS configuration
const corsOptions = {
  origin(origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  message: 'Příliš mnoho požadavků z této IP adresy, zkuste to prosím později.',
});
app.use('/api/', limiter);

// Stricter rate limit for booking creation
const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // max 10 bookings per hour
  message: 'Překročen limit pro vytváření rezervací. Zkuste to prosím za hodinu.',
});

app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static('.'));

// API Key authentication middleware
const requireApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    res.status(401).json({ error: 'Neautorizovaný přístup' });
    return;
  }
  next();
};

// Helper function to generate secure tokens
function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Helper functions for DataManager compatibility
function generateId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'BK';
  for (let i = 0; i < 13; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function generateEditToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 12; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function formatDate(date) {
  if (!date) {
    return null;
  }
  if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/u)) {
    return date;
  }
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isChristmasPeriod(date) {
  const settings = db.getSettings();
  if (!settings.christmasPeriod) {
    return false;
  }

  const checkDate = new Date(date);
  const start = new Date(settings.christmasPeriod.start);
  const end = new Date(settings.christmasPeriod.end);

  return checkDate >= start && checkDate <= end;
}

function validateChristmasCode(code) {
  const settings = db.getSettings();
  return settings.christmasAccessCodes && settings.christmasAccessCodes.includes(code);
}

function calculatePrice(rooms, guestType, adults, children, nights) {
  const settings = db.getSettings();
  const { prices } = settings;

  if (!prices || !prices[guestType]) {
    return 0;
  }

  let totalPrice = 0;
  const roomsData = settings.rooms || [];

  for (const roomId of rooms) {
    const room = roomsData.find((r) => r.id === roomId);
    if (room) {
      const roomType = room.type;
      const priceConfig = prices[guestType][roomType];

      if (priceConfig) {
        // Base price for the room
        totalPrice += priceConfig.base * nights;

        // Additional adults (assuming first adult is included in base price)
        const additionalAdults = Math.max(0, adults - rooms.length);
        totalPrice += additionalAdults * priceConfig.adult * nights;

        // Children
        totalPrice += (children || 0) * priceConfig.child * nights;
      }
    }
  }

  return totalPrice;
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: Date.now(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Public endpoint - read all data from SQLite
app.get('/api/data', async (req, res) => {
  try {
    const data = db.getAllData();

    // Remove sensitive data before sending to client
    if (data.settings) {
      delete data.settings.adminPasswordHash;
      // Keep adminPassword field for backward compatibility but empty
      data.settings.adminPassword = '';
    }

    res.json(data);
  } catch (error) {
    console.error('Error reading data:', error);
    return res.status(500).json({ error: 'Nepodařilo se načíst data' });
  }
});

// Admin endpoint - save all data (for bulk operations)
app.post('/api/data', requireApiKey, async (req, res) => {
  try {
    const dataToSave = req.body;

    // Clear existing data and replace with new data
    const transaction = db.db.transaction(() => {
      // Clear existing data
      db.db.exec('DELETE FROM bookings');
      db.db.exec('DELETE FROM booking_rooms');
      db.db.exec('DELETE FROM blocked_dates');

      // Insert bookings
      if (dataToSave.bookings && dataToSave.bookings.length > 0) {
        for (const booking of dataToSave.bookings) {
          db.createBooking(booking);
        }
      }

      // Insert blocked dates
      if (dataToSave.blockedDates && dataToSave.blockedDates.length > 0) {
        for (const blocked of dataToSave.blockedDates) {
          db.createBlockedDate(blocked);
        }
      }

      // Update settings
      if (dataToSave.settings) {
        db.updateSettings(dataToSave.settings);
      }
    });

    transaction();

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving data:', error);
    return res.status(500).json({ error: 'Nepodařilo se uložit data' });
  }
});

// Public endpoint for creating bookings with rate limiting
app.post('/api/booking', bookingLimiter, async (req, res) => {
  try {
    const bookingData = req.body;

    // Validate required fields
    if (!bookingData.name || !bookingData.email || !bookingData.startDate || !bookingData.endDate) {
      return res.status(400).json({ error: 'Chybí povinné údaje' });
    }

    // Validate email format using ValidationUtils
    if (!ValidationUtils.validateEmail(bookingData.email)) {
      return res
        .status(400)
        .json({ error: ValidationUtils.getValidationError('email', bookingData.email, 'cs') });
    }

    // Validate phone if provided
    if (bookingData.phone && !ValidationUtils.validatePhone(bookingData.phone)) {
      return res
        .status(400)
        .json({ error: ValidationUtils.getValidationError('phone', bookingData.phone, 'cs') });
    }

    // Validate ZIP code if provided
    if (bookingData.zip && !ValidationUtils.validateZIP(bookingData.zip)) {
      return res
        .status(400)
        .json({ error: ValidationUtils.getValidationError('zip', bookingData.zip, 'cs') });
    }

    // Validate IČO if provided
    if (bookingData.ico && !ValidationUtils.validateICO(bookingData.ico)) {
      return res
        .status(400)
        .json({ error: ValidationUtils.getValidationError('ico', bookingData.ico, 'cs') });
    }

    // Validate DIČ if provided
    if (bookingData.dic && !ValidationUtils.validateDIC(bookingData.dic)) {
      return res
        .status(400)
        .json({ error: ValidationUtils.getValidationError('dic', bookingData.dic, 'cs') });
    }

    // Check Christmas period access
    if (isChristmasPeriod(bookingData.startDate) || isChristmasPeriod(bookingData.endDate)) {
      if (!bookingData.christmasCode || !validateChristmasCode(bookingData.christmasCode)) {
        return res
          .status(403)
          .json({ error: 'Rezervace v období vánočních prázdnin vyžaduje přístupový kód' });
      }
    }

    // Check room availability
    const startDate = new Date(bookingData.startDate);
    const endDate = new Date(bookingData.endDate);

    if (startDate >= endDate) {
      return res.status(400).json({ error: 'Datum odjezdu musí být po datu příjezdu' });
    }

    // Check availability for each room
    for (const roomId of bookingData.rooms) {
      const current = new Date(bookingData.startDate);
      while (current < endDate) {
        const dateStr = formatDate(current);
        const availability = db.getRoomAvailability(roomId, dateStr);
        if (!availability.available) {
          return res.status(400).json({
            error: `Pokoj ${roomId} není dostupný dne ${dateStr}`,
          });
        }
        current.setDate(current.getDate() + 1);
      }
    }

    // Calculate price
    const nights = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    bookingData.totalPrice = calculatePrice(
      bookingData.rooms,
      bookingData.guestType,
      bookingData.adults,
      bookingData.children || 0,
      nights
    );

    // Generate secure IDs
    bookingData.id = generateId();
    bookingData.editToken = generateEditToken();
    bookingData.createdAt = new Date().toISOString();
    bookingData.updatedAt = new Date().toISOString();

    // Create the booking
    db.createBooking(bookingData);

    res.json({
      success: true,
      booking: bookingData,
      editToken: bookingData.editToken,
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    return res.status(500).json({ error: 'Nepodařilo se vytvořit rezervaci' });
  }
});

// Update booking - requires edit token or API key
app.put('/api/booking/:id', async (req, res) => {
  try {
    const bookingId = req.params.id;
    const bookingData = req.body;
    const editToken = req.headers['x-edit-token'] || req.body.editToken;

    // Get existing booking to verify edit token
    const existingBooking = db.getBooking(bookingId);

    if (!existingBooking) {
      return res.status(404).json({ error: 'Rezervace nenalezena' });
    }

    // Verify edit token
    if (!editToken || editToken !== existingBooking.editToken) {
      // Check if API key is provided for admin access
      const apiKey = req.headers['x-api-key'];
      if (!apiKey || apiKey !== process.env.API_KEY) {
        return res.status(403).json({ error: 'Neplatný editační token' });
      }
    }

    // Validate dates
    const startDate = new Date(bookingData.startDate);
    const endDate = new Date(bookingData.endDate);

    if (startDate >= endDate) {
      return res.status(400).json({ error: 'Datum odjezdu musí být po datu příjezdu' });
    }

    // Check Christmas period access
    if (isChristmasPeriod(bookingData.startDate) || isChristmasPeriod(bookingData.endDate)) {
      if (!bookingData.christmasCode || !validateChristmasCode(bookingData.christmasCode)) {
        return res
          .status(403)
          .json({ error: 'Rezervace v období vánočních prázdnin vyžaduje přístupový kód' });
      }
    }

    // Check room availability using unified BookingLogic (excluding current booking)
    const bookings = db.getAllBookings();
    const otherBookings = bookings.filter((b) => b.id !== bookingId);

    const conflictCheck = BookingLogic.checkBookingConflict(
      startDate,
      endDate,
      bookingData.rooms,
      otherBookings,
      bookingId
    );

    if (conflictCheck.hasConflict) {
      return res.status(400).json({
        error: `Pokoj ${conflictCheck.roomId} je již rezervován v tomto termínu`,
      });
    }

    // Recalculate price
    const nights = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    bookingData.totalPrice = calculatePrice(
      bookingData.rooms,
      bookingData.guestType,
      bookingData.adults,
      bookingData.children || 0,
      nights
    );

    // Update the booking
    db.updateBooking(bookingId, bookingData);
    const updatedBooking = db.getBooking(bookingId);

    res.json({
      success: true,
      booking: updatedBooking,
    });
  } catch (error) {
    console.error('Error updating booking:', error);
    return res.status(500).json({ error: 'Nepodařilo se aktualizovat rezervaci' });
  }
});

// Delete booking - requires API key or edit token
app.delete('/api/booking/:id', async (req, res) => {
  try {
    const bookingId = req.params.id;
    const editToken = req.headers['x-edit-token'];

    // Get existing booking to verify edit token
    const existingBooking = db.getBooking(bookingId);

    if (!existingBooking) {
      return res.status(404).json({ error: 'Rezervace nenalezena' });
    }

    // Verify edit token
    if (!editToken || editToken !== existingBooking.editToken) {
      // Check if API key is provided for admin access
      const apiKey = req.headers['x-api-key'];
      if (!apiKey || apiKey !== process.env.API_KEY) {
        return res.status(403).json({ error: 'Neplatný editační token' });
      }
    }

    db.deleteBooking(bookingId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting booking:', error);
    return res.status(500).json({ error: 'Nepodařilo se smazat rezervaci' });
  }
});

// Admin login endpoint
app.post('/api/admin/login', async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Heslo je povinné' });
    }

    const settings = db.getSettings();
    const adminPassword = settings.adminPassword || process.env.ADMIN_PASSWORD || 'admin123';

    // For backward compatibility, check both plain and hashed passwords
    let isValid = false;

    if (adminPassword === password) {
      // Plain password match (for backward compatibility)
      isValid = true;
    } else if (adminPassword.startsWith('$2')) {
      // Looks like a bcrypt hash
      isValid = await bcrypt.compare(password, adminPassword);
    }

    if (isValid) {
      // Generate session token
      const sessionToken = generateSecureToken();
      res.json({
        success: true,
        sessionToken,
        apiKey: process.env.API_KEY, // Send API key for admin operations
      });
    } else {
      res.status(401).json({ error: 'Nesprávné heslo' });
    }
  } catch (error) {
    console.error('Error during admin login:', error);
    return res.status(500).json({ error: 'Chyba při přihlašování' });
  }
});

// Update admin password - requires API key
app.post('/api/admin/update-password', requireApiKey, async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Nové heslo musí mít alespoň 8 znaků' });
    }

    // Hash the new password and save it
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    db.setSetting('adminPassword', hashedPassword);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating password:', error);
    return res.status(500).json({ error: 'Nepodařilo se aktualizovat heslo' });
  }
});

// Protected admin endpoint - update settings
app.post('/api/admin/settings', requireApiKey, async (req, res) => {
  try {
    const settings = req.body;

    // Hash admin password if provided
    if (settings.adminPassword) {
      const hashedPassword = await bcrypt.hash(settings.adminPassword, 10);
      settings.adminPassword = hashedPassword;
    }

    db.updateSettings(settings);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating settings:', error);
    return res.status(500).json({ error: 'Chyba při ukládání nastavení' });
  }
});

// Protected admin endpoint - block dates
app.post('/api/admin/block-dates', requireApiKey, async (req, res) => {
  try {
    const { startDate, endDate, rooms, reason } = req.body;

    if (!startDate || !endDate || !rooms || rooms.length === 0) {
      return res.status(400).json({ error: 'Chybí povinné údaje' });
    }

    const blocked = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dateStr = formatDate(date);
      for (const roomId of rooms) {
        const blockageId = `BLK${Math.random().toString(36).slice(2, 11).toUpperCase()}`;
        const blockedDate = {
          blockageId,
          date: dateStr,
          roomId,
          reason: reason || null,
          blockedAt: new Date().toISOString(),
        };
        db.createBlockedDate(blockedDate);
        blocked.push(blockedDate);
      }
    }

    res.json({ success: true, blocked });
  } catch (error) {
    console.error('Error blocking dates:', error);
    return res.status(500).json({ error: 'Chyba při blokování dat' });
  }
});

// Protected admin endpoint - unblock dates
app.delete('/api/admin/block-dates/:blockageId', requireApiKey, async (req, res) => {
  try {
    const { blockageId } = req.params;

    db.deleteBlockedDate(blockageId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error unblocking dates:', error);
    return res.status(500).json({ error: 'Chyba při odblokování dat' });
  }
});

// Christmas periods API endpoints
app.get('/api/admin/christmas-periods', async (req, res) => {
  try {
    const periods = db.getAllChristmasPeriods();
    res.json({ success: true, periods });
  } catch (error) {
    console.error('Error fetching Christmas periods:', error);
    return res.status(500).json({ error: 'Chyba při načítání vánočních období' });
  }
});

app.post('/api/admin/christmas-periods', requireApiKey, async (req, res) => {
  try {
    const { name, startDate, endDate } = req.body;

    if (!name || !startDate || !endDate) {
      return res.status(400).json({ error: 'Chybí povinné údaje' });
    }

    const periodData = {
      name,
      startDate,
      endDate,
      year: new Date(startDate).getFullYear(),
    };

    db.createChristmasPeriod(periodData);
    res.json({ success: true });
  } catch (error) {
    console.error('Error creating Christmas period:', error);
    return res.status(500).json({ error: 'Chyba při vytváření vánočního období' });
  }
});

app.put('/api/admin/christmas-periods/:periodId', requireApiKey, async (req, res) => {
  try {
    const { periodId } = req.params;
    const { name, startDate, endDate } = req.body;

    const periodData = {
      name,
      startDate,
      endDate,
      year: new Date(startDate).getFullYear(),
    };

    db.updateChristmasPeriod(periodId, periodData);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating Christmas period:', error);
    return res.status(500).json({ error: 'Chyba při aktualizaci vánočního období' });
  }
});

app.delete('/api/admin/christmas-periods/:periodId', requireApiKey, async (req, res) => {
  try {
    const { periodId } = req.params;

    db.deleteChristmasPeriod(periodId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting Christmas period:', error);
    return res.status(500).json({ error: 'Chyba při mazání vánočního období' });
  }
});

// Proposed bookings endpoints
app.post('/api/proposed-booking', async (req, res) => {
  try {
    const { sessionId, startDate, endDate, rooms } = req.body;

    if (!sessionId || !startDate || !endDate || !rooms || rooms.length === 0) {
      return res.status(400).json({ error: 'Chybí povinné údaje' });
    }

    // Delete any existing proposals for this session
    db.deleteProposedBookingsBySession(sessionId);

    // Create new proposed booking
    const proposalId = db.createProposedBooking(sessionId, startDate, endDate, rooms);

    res.json({ success: true, proposalId });
  } catch (error) {
    console.error('Error creating proposed booking:', error);
    return res.status(500).json({ error: 'Chyba při vytváření navrhované rezervace' });
  }
});

app.get('/api/proposed-bookings', async (req, res) => {
  try {
    const proposedBookings = db.getActiveProposedBookings();
    res.json(proposedBookings);
  } catch (error) {
    console.error('Error getting proposed bookings:', error);
    return res.status(500).json({ error: 'Chyba při načítání navrhovaných rezervací' });
  }
});

app.post('/api/proposed-bookings', async (req, res) => {
  try {
    const { sessionId, startDate, endDate, rooms } = req.body;

    if (!sessionId || !startDate || !endDate || !rooms) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const proposalId = db.createProposedBooking(sessionId, startDate, endDate, rooms);
    res.json({ success: true, proposalId });
  } catch (error) {
    console.error('Error creating proposed booking:', error);
    return res.status(500).json({ error: 'Chyba při vytváření navrhované rezervace' });
  }
});

app.delete('/api/proposed-booking/:proposalId', async (req, res) => {
  try {
    const { proposalId } = req.params;

    db.deleteProposedBooking(proposalId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting proposed booking:', error);
    return res.status(500).json({ error: 'Chyba při mazání navrhované rezervace' });
  }
});

app.delete('/api/proposed-bookings/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    db.deleteProposedBookingsBySession(sessionId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting proposed bookings by session:', error);
    return res.status(500).json({ error: 'Chyba při mazání navrhovaných rezervací' });
  }
});

// Cleanup expired proposed bookings (run every minute)
setInterval(() => {
  try {
    const result = db.deleteExpiredProposedBookings();
    if (result.changes > 0) {
      console.info(`Cleaned up ${result.changes} expired proposed bookings`);
    }
  } catch (error) {
    console.error('Error cleaning up expired proposed bookings:', error);
  }
}, 60000); // Run every minute

// Error handling middleware
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Něco se pokazilo!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.info('HTTP server closed');
    db.close();
    process.exit(0);
  });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.info(`Server běží na http://localhost:${PORT}`);
  console.info(`Prostředí: ${process.env.NODE_ENV || 'development'}`);
  console.info('Database: SQLite (bookings.db)');
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      '⚠️  VAROVÁNÍ: Server běží v development módu. Pro produkci nastavte NODE_ENV=production'
    );
  }
});

module.exports = app;

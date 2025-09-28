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

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'bookings.json');

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

async function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }

  try {
    await fs.access(DATA_FILE);
  } catch {
    // Hash the admin password from environment variable
    const hashedPassword = await bcrypt.hash(
      process.env.ADMIN_PASSWORD || 'ChangeThisPassword123!',
      10
    );

    const initialData = {
      bookings: [],
      blockedDates: [],
      settings: {
        adminPasswordHash: hashedPassword,
        christmasAccessCodes: process.env.CHRISTMAS_ACCESS_CODES?.split(',') || ['XMAS2024'],
        christmasPeriod: {
          start: process.env.CHRISTMAS_START || '2024-12-23',
          end: process.env.CHRISTMAS_END || '2025-01-02',
        },
        rooms: [
          { id: '12', name: 'Pokoj 12', type: 'small', beds: 2 },
          { id: '13', name: 'Pokoj 13', type: 'small', beds: 3 },
          { id: '14', name: 'Pokoj 14', type: 'large', beds: 4 },
          { id: '22', name: 'Pokoj 22', type: 'small', beds: 2 },
          { id: '23', name: 'Pokoj 23', type: 'small', beds: 3 },
          { id: '24', name: 'Pokoj 24', type: 'large', beds: 4 },
          { id: '42', name: 'Pokoj 42', type: 'small', beds: 2 },
          { id: '43', name: 'Pokoj 43', type: 'small', beds: 2 },
          { id: '44', name: 'Pokoj 44', type: 'large', beds: 4 },
        ],
        prices: {
          utia: { base: 300, adult: 50, child: 25 },
          external: { base: 500, adult: 100, child: 50 },
        },
      },
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(initialData, null, 2));
  }
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

// Public endpoint - read only non-sensitive data
app.get('/api/data', async (req, res) => {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    const parsedData = JSON.parse(data);

    // Remove sensitive data before sending to client
    if (parsedData.settings) {
      delete parsedData.settings.adminPasswordHash;
      // Keep adminPassword field for backward compatibility but empty
      parsedData.settings.adminPassword = '';
    }

    res.json(parsedData);
  } catch (error) {
    console.error('Error reading data:', error);
    return res.status(500).json({ error: 'Nepodařilo se načíst data' });
  }
});

// Admin endpoint - requires API key
app.post('/api/data', requireApiKey, async (req, res) => {
  try {
    // Preserve the password hash if it exists
    const currentData = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
    const dataToSave = req.body;

    if (currentData.settings?.adminPasswordHash) {
      dataToSave.settings.adminPasswordHash = currentData.settings.adminPasswordHash;
    }

    await fs.writeFile(DATA_FILE, JSON.stringify(dataToSave, null, 2));
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving data:', error);
    return res.status(500).json({ error: 'Nepodařilo se uložit data' });
  }
});

// Public endpoint for creating bookings with rate limiting
app.post('/api/booking', bookingLimiter, async (req, res) => {
  try {
    const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
    const booking = req.body;

    // Validate required fields
    if (!booking.name || !booking.email || !booking.startDate || !booking.endDate) {
      return res.status(400).json({ error: 'Chybí povinné údaje' });
    }

    // Generate secure IDs
    booking.id = `BK${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    booking.editToken = generateSecureToken();
    booking.createdAt = new Date().toISOString();
    booking.updatedAt = new Date().toISOString();

    data.bookings.push(booking);
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));

    res.json({ success: true, booking });
  } catch (error) {
    console.error('Error creating booking:', error);
    return res.status(500).json({ error: 'Nepodařilo se vytvořit rezervaci' });
  }
});

// Update booking - requires edit token or API key
app.put('/api/booking/:id', async (req, res) => {
  try {
    const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
    const index = data.bookings.findIndex((b) => b.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: 'Rezervace nenalezena' });
    }

    // Check authorization: either valid edit token or API key
    const editToken = req.headers['x-edit-token'];
    const apiKey = req.headers['x-api-key'];

    if (data.bookings[index].editToken !== editToken && apiKey !== process.env.API_KEY) {
      return res.status(401).json({ error: 'Neautorizovaný přístup' });
    }

    data.bookings[index] = {
      ...data.bookings[index],
      ...req.body,
      id: data.bookings[index].id, // Preserve original ID
      editToken: data.bookings[index].editToken, // Preserve edit token
      createdAt: data.bookings[index].createdAt, // Preserve creation date
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));

    res.json({ success: true, booking: data.bookings[index] });
  } catch (error) {
    console.error('Error updating booking:', error);
    return res.status(500).json({ error: 'Nepodařilo se aktualizovat rezervaci' });
  }
});

// Delete booking - requires API key
app.delete('/api/booking/:id', requireApiKey, async (req, res) => {
  try {
    const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
    const bookingCount = data.bookings.length;
    data.bookings = data.bookings.filter((b) => b.id !== req.params.id);

    if (data.bookings.length === bookingCount) {
      return res.status(404).json({ error: 'Rezervace nenalezena' });
    }

    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
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

    const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));

    // Compare with hashed password
    const isValid = await bcrypt.compare(password, data.settings.adminPasswordHash);

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

    const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
    data.settings.adminPasswordHash = await bcrypt.hash(newPassword, 10);

    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating password:', error);
    return res.status(500).json({ error: 'Nepodařilo se aktualizovat heslo' });
  }
});

// Error handling middleware
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Něco se pokazilo!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

async function start() {
  await ensureDataFile();
  app.listen(PORT, () => {
    console.info(`Server běží na http://localhost:${PORT}`);
    console.info(`Prostředí: ${process.env.NODE_ENV || 'development'}`);
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '⚠️  VAROVÁNÍ: Server běží v development módu. Pro produkci nastavte NODE_ENV=production'
      );
    }
  });
}

start();

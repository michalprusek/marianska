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

// Import SQLite Database Manager, Validation Utils, Booking Logic, Logger, and Error Classes
const DatabaseManager = require('./database');
const ValidationUtils = require('./js/shared/validationUtils');
const BookingLogic = require('./js/shared/bookingLogic');
const { createLogger } = require('./js/shared/logger');
const {
  ValidationError,
  AuthenticationError,
  NotFoundError,
  ConflictError,
  SessionExpiredError,
  DatabaseError,
} = require('./js/shared/errors');

// Initialize logger - DEBUG level in development
const logger = createLogger(
  'Server',
  process.env.NODE_ENV === 'development' ? 'DEBUG' : process.env.LOG_LEVEL || 'INFO'
);

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy - required when running behind nginx
app.set('trust proxy', true);

// Session timeout constants
const SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

// Initialize SQLite database
const db = new DatabaseManager();

// Migrate from JSON if exists
const DATA_FILE = path.join(__dirname, 'data', 'bookings.json');
fs.access(DATA_FILE)
  .then(() => {
    logger.info('Migrating existing JSON data to SQLite...');
    return db.migrateFromJSON(DATA_FILE);
  })
  .then(() => {
    // Rename JSON file after successful migration
    const backupFile = `${DATA_FILE}.migrated-${Date.now()}`;
    return fs.rename(DATA_FILE, backupFile);
  })
  .then(() => {
    logger.info('Migration complete. JSON backup saved.');
  })
  .catch((err) => {
    if (err.code !== 'ENOENT') {
      logger.error('Migration error', { error: err.message, stack: err.stack });
    }
  });

// Security middleware - Defense-in-depth headers
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
        objectSrc: ["'none'"], // Prevent Flash/Java applets
        baseUri: ["'self'"], // Prevent base tag hijacking
        formAction: ["'self'"], // Restrict form submissions
        frameAncestors: ["'none'"], // Prevent clickjacking
      },
    },
    // Additional security headers
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true, // X-Content-Type-Options: nosniff
    frameguard: { action: 'deny' }, // X-Frame-Options: DENY
    xssFilter: true, // X-XSS-Protection: 1; mode=block
  })
);

// Additional security headers
app.use((req, res, next) => {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Permissions policy (formerly Feature-Policy)
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

// CORS configuration
const corsOptions = {
  origin(origin, callback) {
    const defaultOrigins = [
      'http://localhost:3000',
      'https://localhost:3000',
      'https://chata.utia.cas.cz',
      'http://chata.utia.cas.cz',
    ];
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || defaultOrigins;

    // In development, allow localhost and development origins
    if (process.env.NODE_ENV === 'development') {
      const devAllowedOrigins = [
        ...defaultOrigins,
        'http://127.0.0.1:3000',
        'http://localhost:8080',
        'http://127.0.0.1:8080',
      ];

      if (!origin || devAllowedOrigins.some((allowed) => origin.startsWith(allowed))) {
        logger.debug('CORS: Allowing development origin', { origin });
        callback(null, true);
      } else {
        logger.warn('CORS: Origin not in development whitelist', { origin, devAllowedOrigins });
        callback(new Error('Not allowed by CORS'));
      }
    } else if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn('CORS: Origin not allowed', { origin, allowedOrigins });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};
app.use(cors(corsOptions));

// Rate limiting - Separate limits for different endpoint types
// Read-only endpoints (GET) - more lenient limit
const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Increased from 100 to accommodate calendar rendering
  message: 'Příliš mnoho požadavků z této IP adresy, zkuste to prosím později.',
});

// Write endpoints (POST/PUT/DELETE) - stricter limit
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Příliš mnoho požadavků z této IP adresy, zkuste to prosím později.',
});

// Stricter rate limit for booking creation
const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // max 10 bookings per hour
  message: 'Překročen limit pro vytváření rezervací. Zkuste to prosím za hodinu.',
});

// Strict rate limit for admin login (defense against brute-force)
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // max 5 login attempts per 15 minutes
  skipSuccessfulRequests: true, // Don't count successful logins
  message: 'Příliš mnoho neúspěšných pokusů o přihlášení. Zkuste to za 15 minut.',
});

// Rate limiting for Christmas code validation attempts (defense against brute-force)
const christmasCodeAttempts = new Map(); // { ip: { attempts: number, resetAt: timestamp } }

function checkChristmasCodeRateLimit(ip) {
  const now = Date.now();
  const record = christmasCodeAttempts.get(ip);

  // Clean up if reset time has passed
  if (record && now >= record.resetAt) {
    christmasCodeAttempts.delete(ip);
    return { allowed: true, remaining: 10 };
  }

  if (!record) {
    christmasCodeAttempts.set(ip, {
      attempts: 1,
      resetAt: now + 15 * 60 * 1000, // 15 minutes
    });
    return { allowed: true, remaining: 9 };
  }

  // Check if limit exceeded
  if (record.attempts >= 10) {
    const minutesLeft = Math.ceil((record.resetAt - now) / 60000);
    return {
      allowed: false,
      remaining: 0,
      minutesLeft,
    };
  }

  // Increment attempts
  record.attempts += 1;
  return { allowed: true, remaining: 10 - record.attempts };
}

function resetChristmasCodeAttempts(ip) {
  christmasCodeAttempts.delete(ip);
}

// Cleanup expired entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [ip, record] of christmasCodeAttempts.entries()) {
      if (now >= record.resetAt) {
        christmasCodeAttempts.delete(ip);
      }
    }
  },
  5 * 60 * 1000
);

// Request logging middleware for debugging
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.url}`, {
      body: req.body,
      query: req.query,
      headers: req.headers,
    });
    next();
  });
}

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

/**
 * Determines if Christmas access code is required based on current date and Christmas period
 *
 * Rules:
 * - Code required if current date <= Sept 30 of the year containing Christmas period start
 * - After Oct 1: Single room bookings don't need code, bulk bookings are blocked
 *
 * @param {Date} currentDate - Current date (usually today)
 * @param {string} christmasPeriodStart - First day of Christmas period (YYYY-MM-DD)
 * @param {boolean} isBulkBooking - Whether this is a bulk booking
 * @returns {Object} { codeRequired: boolean, bulkBlocked: boolean }
 */
function checkChristmasAccessRequirement(currentDate, christmasPeriodStart, isBulkBooking = false) {
  if (!christmasPeriodStart) {
    return { codeRequired: false, bulkBlocked: false };
  }

  const christmasStartDate = new Date(christmasPeriodStart);
  const christmasYear = christmasStartDate.getFullYear();

  // Sept 30 of the year containing Christmas period start
  const sept30Cutoff = new Date(christmasYear, 8, 30, 23, 59, 59); // Month is 0-indexed (8 = September)

  const isBeforeSept30 = currentDate <= sept30Cutoff;

  if (isBeforeSept30) {
    // Before Oct 1: Code required for both single and bulk
    return { codeRequired: true, bulkBlocked: false };
  }
  // After Oct 1: Single rooms don't need code, bulk is blocked
  return { codeRequired: false, bulkBlocked: isBulkBooking };
}

// Session validation middleware
function requireSession(req, res, next) {
  const sessionToken = req.headers['x-session-token'];

  if (!sessionToken) {
    return res.status(401).json({ error: 'Neautorizovaný přístup - chybí session token' });
  }

  const session = db.getAdminSession(sessionToken);

  if (!session) {
    return res.status(401).json({ error: 'Neplatný session token' });
  }

  // Check if session expired (convert ISO string to timestamp)
  const expiresAt = new Date(session.expires_at).getTime();
  if (expiresAt < Date.now()) {
    db.deleteAdminSession(sessionToken);
    return res.status(401).json({ error: 'Session vypršela - přihlaste se znovu' });
  }

  // Session is valid - attach to request
  req.session = session;
  req.sessionToken = sessionToken;

  next();
}

// Middleware that accepts either API key or session token
function requireApiKeyOrSession(req, res, next) {
  // Check for API key first
  const apiKey = req.headers['x-api-key'];
  if (apiKey && apiKey === process.env.API_KEY) {
    return next();
  }

  // Check for session token
  const sessionToken = req.headers['x-session-token'];
  if (!sessionToken) {
    return res
      .status(401)
      .json({ error: 'Neautorizovaný přístup - chybí API klíč nebo session token' });
  }

  const session = db.getAdminSession(sessionToken);
  if (!session) {
    return res.status(401).json({ error: 'Neplatný session token' });
  }

  // Check if session expired (convert ISO string to timestamp)
  const expiresAt = new Date(session.expires_at).getTime();
  if (expiresAt < Date.now()) {
    db.deleteAdminSession(sessionToken);
    return res.status(401).json({ error: 'Session vypršela - přihlaste se znovu' });
  }

  // Session is valid
  req.session = session;
  req.sessionToken = sessionToken;
  next();
}

function calculatePrice(rooms, guestType, adults, children, nights) {
  const settings = db.getSettings();
  const { prices } = settings;

  if (!prices || !prices[guestType]) {
    return 0;
  }

  // Use flat pricing structure (no small/large distinction)
  const priceConfig = prices[guestType];

  if (!priceConfig) {
    return 0;
  }

  // Base price per room * number of rooms * nights
  let totalPrice = priceConfig.base * rooms.length * nights;

  // Additional adults (assuming one adult per room is included in base)
  const additionalAdults = Math.max(0, adults - rooms.length);
  totalPrice += additionalAdults * priceConfig.adult * nights;

  // Children
  totalPrice += (children || 0) * priceConfig.child * nights;

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

// Public endpoint - read all data from SQLite (use lenient read limiter)
app.get('/api/data', readLimiter, (req, res) => {
  try {
    const data = db.getAllData();

    // Remove sensitive data before sending to client
    if (data.settings) {
      delete data.settings.adminPasswordHash;
      // Keep adminPassword field for backward compatibility but empty
      data.settings.adminPassword = '';
    }

    return res.json(data);
  } catch (error) {
    logger.error('reading data:', error);
    return res.status(500).json({ error: 'Nepodařilo se načíst data' });
  }
});

// Admin endpoint - save all data (for bulk operations)
app.post('/api/data', writeLimiter, requireApiKeyOrSession, (req, res) => {
  try {
    const dataToSave = req.body;

    // CRITICAL FIX: Remove nested transactions - each method has its own transaction
    // Just call methods sequentially instead of wrapping in outer transaction

    // Clear existing data
    db.db.exec('DELETE FROM bookings');
    db.db.exec('DELETE FROM booking_rooms');
    db.db.exec('DELETE FROM blockage_instances');
    db.db.exec('DELETE FROM blockage_rooms');

    // Insert bookings
    if (dataToSave.bookings && dataToSave.bookings.length > 0) {
      for (const booking of dataToSave.bookings) {
        db.createBooking(booking);
      }
    }

    // Insert blocked dates (legacy compatibility)
    if (dataToSave.blockedDates && dataToSave.blockedDates.length > 0) {
      for (const blocked of dataToSave.blockedDates) {
        db.createBlockedDate(blocked);
      }
    }

    // Update settings (this method has its own transaction)
    if (dataToSave.settings) {
      db.updateSettings(dataToSave.settings);
    }

    return res.json({ success: true });
  } catch (error) {
    logger.error('saving data:', error);
    logger.error('Error stack:', error.stack);
    return res.status(500).json({ error: 'Nepodařilo se uložit data' });
  }
});

// Public endpoint for creating bookings with rate limiting
app.post('/api/booking', bookingLimiter, (req, res) => {
  try {
    const bookingData = req.body;

    // Validate required fields
    if (!bookingData.name || !bookingData.email || !bookingData.startDate || !bookingData.endDate) {
      return res.status(400).json({ error: 'Chybí povinné údaje' });
    }

    // SECURITY FIX: Validate field lengths
    const lengthCheck = validateFieldLengths(bookingData);
    if (!lengthCheck.valid) {
      return res.status(400).json({ error: lengthCheck.error });
    }

    // SECURITY FIX: Sanitize text inputs
    bookingData.name = sanitizeInput(bookingData.name, MAX_LENGTHS.name);
    bookingData.company = sanitizeInput(bookingData.company, MAX_LENGTHS.company);
    bookingData.address = sanitizeInput(bookingData.address, MAX_LENGTHS.address);
    bookingData.city = sanitizeInput(bookingData.city, MAX_LENGTHS.city);
    bookingData.notes = sanitizeInput(bookingData.notes, MAX_LENGTHS.notes);

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

    // Check Christmas period access with date-based rules
    const isChristmas =
      isChristmasPeriod(bookingData.startDate) || isChristmasPeriod(bookingData.endDate);

    if (isChristmas) {
      const settings = db.getSettings();
      const christmasPeriodStart = settings.christmasPeriod?.start;
      const isBulkBooking = bookingData.isBulkBooking || false;
      const today = new Date();

      const { codeRequired, bulkBlocked } = checkChristmasAccessRequirement(
        today,
        christmasPeriodStart,
        isBulkBooking
      );

      // Block bulk bookings after Oct 1
      if (bulkBlocked) {
        return res.status(403).json({
          error:
            'Hromadné rezervace celé chaty nejsou po 1. říjnu povoleny pro vánoční období. Rezervujte jednotlivé pokoje.',
        });
      }

      // Require code if before Oct 1
      if (codeRequired) {
        const clientIp = req.ip || req.connection.remoteAddress;

        // Check rate limit for Christmas code validation
        const rateLimit = checkChristmasCodeRateLimit(clientIp);
        if (!rateLimit.allowed) {
          logger.warn('Christmas code rate limit exceeded', { ip: clientIp });
          return res.status(429).json({
            error: `Příliš mnoho neplatných pokusů o vánoční kód. Zkuste to za ${rateLimit.minutesLeft} minut.`,
          });
        }

        if (!bookingData.christmasCode || !validateChristmasCode(bookingData.christmasCode)) {
          logger.warn('Invalid Christmas code attempt', {
            ip: clientIp,
            remaining: rateLimit.remaining,
          });
          return res
            .status(403)
            .json({ error: 'Rezervace v období vánočních prázdnin vyžaduje přístupový kód' });
        }

        // Valid code - reset rate limit for this IP
        resetChristmasCodeAttempts(clientIp);
      }
    }

    // Check room availability
    const startDate = new Date(bookingData.startDate);
    const endDate = new Date(bookingData.endDate);

    if (startDate >= endDate) {
      return res.status(400).json({ error: 'Datum odjezdu musí být po datu příjezdu' });
    }

    // P0 FIX: Validate guest counts
    const totalGuests = (bookingData.adults || 0) + (bookingData.children || 0);

    if (bookingData.adults < 1) {
      return res.status(400).json({ error: 'Rezervace musí obsahovat alespoň 1 dospělého' });
    }

    if (bookingData.adults < 0 || bookingData.children < 0 || bookingData.toddlers < 0) {
      return res.status(400).json({ error: 'Počet hostů nemůže být záporný' });
    }

    if (totalGuests === 0) {
      return res.status(400).json({ error: 'Rezervace musí obsahovat alespoň 1 hosta' });
    }

    // CRITICAL FIX: Wrap availability check + booking creation in transaction
    // This prevents race conditions where two users book the same room simultaneously
    const transaction = db.db.transaction(() => {
      // Check availability for each room INSIDE transaction
      for (const roomId of bookingData.rooms) {
        const checkStart = new Date(bookingData.startDate);
        const current = new Date(checkStart);
        while (current.getTime() < endDate.getTime()) {
          const dateStr = formatDate(current);
          const sessionId = bookingData.sessionId || null;
          const availability = db.getRoomAvailability(roomId, dateStr, sessionId);
          if (!availability.available) {
            console.error('[BOOKING] Availability check failed:', {
              roomId,
              date: dateStr,
              reason: availability.reason,
              sessionId: sessionId || 'none',
              existingBooking: availability.booking?.id || 'none',
              proposalId: availability.proposal?.proposal_id || 'none',
              timestamp: new Date().toISOString(),
            });
            throw new Error(`Pokoj ${roomId} není dostupný dne ${dateStr}`);
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

      // Create the booking (still locked)
      db.createBooking(bookingData);

      return bookingData;
    });

    // Execute transaction atomically
    const booking = transaction();

    return res.json({
      success: true,
      booking,
      editToken: booking.editToken,
    });
  } catch (error) {
    logger.error('creating booking:', error);

    // More specific error messages
    const errorMessage = error.message.includes('není dostupný')
      ? error.message
      : 'Nepodařilo se vytvořit rezervaci';

    // Use 409 Conflict for availability issues, 500 for other errors
    return res
      .status(error.message.includes('není dostupný') ? 409 : 500)
      .json({ error: errorMessage });
  }
});

// Update booking - requires edit token or API key
app.put('/api/booking/:id', writeLimiter, (req, res) => {
  try {
    const bookingId = req.params.id;
    const bookingData = req.body;
    const editToken = req.headers['x-edit-token'] || req.body.editToken;

    // Get existing booking to verify edit token
    const existingBooking = db.getBooking(bookingId);

    if (!existingBooking) {
      return res.status(404).json({ error: 'Rezervace nenalezena' });
    }

    // Verify edit token or session
    const sessionToken = req.headers['x-session-token'];
    const isAdmin = sessionToken && db.getAdminSession(sessionToken) !== undefined;

    if (!editToken || editToken !== existingBooking.editToken) {
      // Check if user is admin
      if (!isAdmin) {
        return res.status(403).json({ error: 'Neplatný editační token' });
      }
    }

    // P1 FIX: Add validation for all fields (same as POST)
    if (bookingData.email && !ValidationUtils.validateEmail(bookingData.email)) {
      return res.status(400).json({
        error: ValidationUtils.getValidationError('email', bookingData.email, 'cs'),
      });
    }

    if (bookingData.phone && !ValidationUtils.validatePhone(bookingData.phone)) {
      return res.status(400).json({
        error: ValidationUtils.getValidationError('phone', bookingData.phone, 'cs'),
      });
    }

    if (bookingData.zip && !ValidationUtils.validateZIP(bookingData.zip)) {
      return res.status(400).json({
        error: ValidationUtils.getValidationError('zip', bookingData.zip, 'cs'),
      });
    }

    if (bookingData.ico && !ValidationUtils.validateICO(bookingData.ico)) {
      return res.status(400).json({
        error: ValidationUtils.getValidationError('ico', bookingData.ico, 'cs'),
      });
    }

    if (bookingData.dic && !ValidationUtils.validateDIC(bookingData.dic)) {
      return res.status(400).json({
        error: ValidationUtils.getValidationError('dic', bookingData.dic, 'cs'),
      });
    }

    // Validate field lengths
    const lengthCheck = validateFieldLengths(bookingData);
    if (!lengthCheck.valid) {
      return res.status(400).json({ error: lengthCheck.error });
    }

    // Sanitize text inputs
    if (bookingData.name) {
      bookingData.name = sanitizeInput(bookingData.name, MAX_LENGTHS.name);
    }
    if (bookingData.company) {
      bookingData.company = sanitizeInput(bookingData.company, MAX_LENGTHS.company);
    }
    if (bookingData.address) {
      bookingData.address = sanitizeInput(bookingData.address, MAX_LENGTHS.address);
    }
    if (bookingData.city) {
      bookingData.city = sanitizeInput(bookingData.city, MAX_LENGTHS.city);
    }
    if (bookingData.notes) {
      bookingData.notes = sanitizeInput(bookingData.notes, MAX_LENGTHS.notes);
    }

    // Validate dates
    const startDate = new Date(bookingData.startDate);
    const endDate = new Date(bookingData.endDate);

    if (startDate >= endDate) {
      return res.status(400).json({ error: 'Datum odjezdu musí být po datu příjezdu' });
    }

    // Check Christmas period access with date-based rules
    const isChristmas =
      isChristmasPeriod(bookingData.startDate) || isChristmasPeriod(bookingData.endDate);

    if (isChristmas) {
      const settings = db.getSettings();
      const christmasPeriodStart = settings.christmasPeriod?.start;
      const isBulkBooking = bookingData.isBulkBooking || false;
      const today = new Date();

      const { codeRequired, bulkBlocked } = checkChristmasAccessRequirement(
        today,
        christmasPeriodStart,
        isBulkBooking
      );

      // Block bulk bookings after Oct 1
      if (bulkBlocked) {
        return res.status(403).json({
          error:
            'Hromadné rezervace celé chaty nejsou po 1. říjnu povoleny pro vánoční období. Rezervujte jednotlivé pokoje.',
        });
      }

      // Require code if before Oct 1
      if (codeRequired) {
        const clientIp = req.ip || req.connection.remoteAddress;

        // Check rate limit for Christmas code validation
        const rateLimit = checkChristmasCodeRateLimit(clientIp);
        if (!rateLimit.allowed) {
          logger.warn('Christmas code rate limit exceeded', { ip: clientIp });
          return res.status(429).json({
            error: `Příliš mnoho neplatných pokusů o vánoční kód. Zkuste to za ${rateLimit.minutesLeft} minut.`,
          });
        }

        if (!bookingData.christmasCode || !validateChristmasCode(bookingData.christmasCode)) {
          logger.warn('Invalid Christmas code attempt', {
            ip: clientIp,
            remaining: rateLimit.remaining,
          });
          return res
            .status(403)
            .json({ error: 'Rezervace v období vánočních prázdnin vyžaduje přístupový kód' });
        }

        // Valid code - reset rate limit for this IP
        resetChristmasCodeAttempts(clientIp);
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
      return res.status(409).json({
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

    return res.json({
      success: true,
      booking: updatedBooking,
    });
  } catch (error) {
    logger.error('updating booking:', error);
    return res.status(500).json({ error: 'Nepodařilo se aktualizovat rezervaci' });
  }
});

// Delete booking - requires API key or edit token
app.delete('/api/booking/:id', writeLimiter, (req, res) => {
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

    return res.json({ success: true });
  } catch (error) {
    logger.error('deleting booking:', error);
    return res.status(500).json({ error: 'Nepodařilo se smazat rezervaci' });
  }
});

// SECURITY FIX: Use database-backed session storage instead of in-memory Map
// This ensures sessions persist across server restarts
// Cleanup expired sessions every 5 minutes
setInterval(
  () => {
    const deletedCount = db.deleteExpiredAdminSessions();
    if (deletedCount > 0) {
      logger.info(`🗑️  Cleaned up ${deletedCount} expired admin session(s)`);
    }
  },
  5 * 60 * 1000
);

// Admin login endpoint
app.post('/api/admin/login', adminLoginLimiter, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Heslo je povinné' });
    }

    const settings = db.getSettings();
    const adminPassword = settings.adminPassword || process.env.ADMIN_PASSWORD || 'admin123';

    // SECURITY FIX: Force bcrypt-only authentication
    let isValid = false;

    if (adminPassword.startsWith('$2')) {
      // Bcrypt hash
      isValid = await bcrypt.compare(password, adminPassword);
    } else {
      // Plaintext password detected - migrate to bcrypt
      logger.warn('⚠️  Plaintext admin password detected - migrating to bcrypt');
      if (adminPassword === password) {
        isValid = true;
        // Auto-migrate to bcrypt hash
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        db.setSetting('adminPassword', hashedPassword);
        logger.info('✅ Admin password migrated to bcrypt hash');
      }
    }

    if (isValid) {
      // SECURITY FIX: Generate session token instead of exposing API key
      const sessionToken = generateSecureToken();
      const expiresAt = new Date(Date.now() + SESSION_TIMEOUT).toISOString();
      const userAgent = req.get('user-agent');
      const ipAddress = req.ip || req.connection.remoteAddress;

      // Store session in database for persistence
      db.createAdminSession(sessionToken, expiresAt, userAgent, ipAddress);

      return res.json({
        success: true,
        sessionToken,
        expiresAt,
        // SECURITY FIX: DO NOT send API key to client!
      });
    }
    return res.status(401).json({ error: 'Nesprávné heslo' });
  } catch (error) {
    logger.error('during admin login:', error);
    return res.status(500).json({ error: 'Chyba při přihlašování' });
  }
});

// Session refresh endpoint - extend session expiry
app.post('/api/admin/refresh-session', requireSession, (req, res) => {
  try {
    const session = db.getAdminSession(req.sessionToken);

    if (session) {
      // Extend expiration
      const newExpiresAt = new Date(Date.now() + SESSION_TIMEOUT).toISOString();
      db.updateAdminSessionActivity(req.sessionToken, newExpiresAt);

      return res.json({
        success: true,
        expiresAt: newExpiresAt,
      });
    }

    return res.status(401).json({ error: 'Session not found' });
  } catch (error) {
    logger.error('refreshing session:', error);
    return res.status(500).json({ error: 'Chyba při obnovení session' });
  }
});

// Admin logout endpoint
app.post('/api/admin/logout', requireSession, (req, res) => {
  try {
    db.deleteAdminSession(req.sessionToken);
    return res.json({ success: true });
  } catch (error) {
    logger.error('during logout:', error);
    return res.status(500).json({ error: 'Chyba při odhlašování' });
  }
});

// Update admin password - requires session
app.post('/api/admin/update-password', requireSession, async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Nové heslo musí mít alespoň 8 znaků' });
    }

    // Hash the new password and save it
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    db.setSetting('adminPassword', hashedPassword);

    return res.json({ success: true });
  } catch (error) {
    logger.error('updating password:', error);
    return res.status(500).json({ error: 'Nepodařilo se aktualizovat heslo' });
  }
});

// Input sanitization function - Defense-in-depth HTML escaping
function sanitizeInput(str, maxLength = 255) {
  if (!str) {
    return str;
  }
  return String(str)
    .replace(/&/g, '&amp;') // Must be first - escape ampersands
    .replace(/</g, '&lt;') // Escape less-than
    .replace(/>/g, '&gt;') // Escape greater-than
    .replace(/"/g, '&quot;') // Escape double quotes
    .replace(/'/g, '&#x27;') // Escape single quotes
    .replace(/\//g, '&#x2F;') // Escape forward slash
    .slice(0, maxLength);
}

// Helper to escape HTML for safe innerHTML usage
function escapeHtml(unsafe) {
  if (!unsafe) {
    return '';
  }
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Max length validation
const MAX_LENGTHS = {
  name: 100,
  email: 254,
  phone: 20,
  company: 100,
  address: 200,
  city: 100,
  zip: 10,
  ico: 10,
  dic: 12,
  notes: 1000,
};

function validateFieldLengths(data) {
  for (const [field, maxLen] of Object.entries(MAX_LENGTHS)) {
    if (data[field] && data[field].length > maxLen) {
      return {
        valid: false,
        error: `Pole ${field} je příliš dlouhé (max ${maxLen} znaků)`,
      };
    }
  }
  return { valid: true };
}

// Protected admin endpoint - update settings
app.post('/api/admin/settings', requireSession, async (req, res) => {
  try {
    const settings = req.body;

    // Hash admin password if provided
    if (settings.adminPassword) {
      const hashedPassword = await bcrypt.hash(settings.adminPassword, 10);
      settings.adminPassword = hashedPassword;
    }

    db.updateSettings(settings);

    return res.json({ success: true });
  } catch (error) {
    logger.error('updating settings:', error);
    return res.status(500).json({ error: 'Chyba při ukládání nastavení' });
  }
});

// New blockage instance API endpoints
app.post('/api/blockage', requireApiKeyOrSession, (req, res) => {
  try {
    const { blockageId, startDate, endDate, rooms, reason, createdAt } = req.body;

    if (!blockageId || !startDate || !endDate) {
      return res
        .status(400)
        .json({ error: 'Chybí povinné údaje (blockageId, startDate, endDate)' });
    }

    // FIX: Admin can create blockages in the past
    // Check if request has valid session (admin) or API key
    const isAdmin = Boolean(req.session || req.sessionToken);

    // Validate date format (skip past date check for admin)
    const dateValidation = BookingLogic.validateDateRange(startDate, endDate, isAdmin);
    if (!dateValidation.valid) {
      return res.status(400).json({
        error: dateValidation.error || 'Neplatný formát data nebo konec je před začátkem',
      });
    }

    const blockageData = {
      blockageId,
      startDate,
      endDate,
      rooms: rooms || [], // Empty = all rooms
      reason: reason || '',
      createdAt: createdAt || new Date().toISOString(),
    };

    db.createBlockageInstance(blockageData);

    return res.json({ success: true, blockageId });
  } catch (error) {
    logger.error('creating blockage:', error);
    return res.status(500).json({ error: 'Chyba při vytváření blokace' });
  }
});

app.delete('/api/blockage/:blockageId', requireApiKeyOrSession, (req, res) => {
  try {
    const { blockageId } = req.params;

    if (!blockageId) {
      return res.status(400).json({ error: 'Chybí blockageId' });
    }

    db.deleteBlockageInstance(blockageId);

    return res.json({ success: true });
  } catch (error) {
    logger.error('deleting blockage:', error);
    return res.status(500).json({ error: 'Chyba při mazání blokace' });
  }
});

app.get('/api/blockages', readLimiter, (req, res) => {
  try {
    const blockages = db.getAllBlockageInstances();
    return res.json(blockages);
  } catch (error) {
    logger.error('fetching blockages:', error);
    return res.status(500).json({ error: 'Chyba při načítání blokací' });
  }
});

// Legacy admin endpoints for backward compatibility
app.post('/api/admin/block-dates', requireApiKeyOrSession, (req, res) => {
  try {
    const { startDate, endDate, rooms, reason } = req.body;

    if (!startDate || !endDate || !rooms || rooms.length === 0) {
      return res.status(400).json({ error: 'Chybí povinné údaje' });
    }

    const blockageId = `BLK${Math.random().toString(36).slice(2, 11).toUpperCase()}`;
    const blockageData = {
      blockageId,
      startDate,
      endDate,
      rooms,
      reason: reason || '',
      createdAt: new Date().toISOString(),
    };

    db.createBlockageInstance(blockageData);

    return res.json({ success: true, blockageId });
  } catch (error) {
    logger.error('blocking dates:', error);
    return res.status(500).json({ error: 'Chyba při blokování dat' });
  }
});

app.delete('/api/admin/block-dates/:blockageId', requireApiKeyOrSession, (req, res) => {
  try {
    const { blockageId } = req.params;

    db.deleteBlockageInstance(blockageId);

    return res.json({ success: true });
  } catch (error) {
    logger.error('unblocking dates:', error);
    return res.status(500).json({ error: 'Chyba při odblokování dat' });
  }
});

// Christmas periods API endpoints
app.get('/api/admin/christmas-periods', readLimiter, (req, res) => {
  try {
    const periods = db.getAllChristmasPeriods();
    return res.json({ success: true, periods });
  } catch (error) {
    logger.error('fetching Christmas periods:', error);
    return res.status(500).json({ error: 'Chyba při načítání vánočních období' });
  }
});

app.post('/api/admin/christmas-periods', requireApiKeyOrSession, (req, res) => {
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
    return res.json({ success: true });
  } catch (error) {
    logger.error('creating Christmas period:', error);
    return res.status(500).json({ error: 'Chyba při vytváření vánočního období' });
  }
});

app.put('/api/admin/christmas-periods/:periodId', requireApiKeyOrSession, (req, res) => {
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
    return res.json({ success: true });
  } catch (error) {
    logger.error('updating Christmas period:', error);
    return res.status(500).json({ error: 'Chyba při aktualizaci vánočního období' });
  }
});

app.delete('/api/admin/christmas-periods/:periodId', requireApiKeyOrSession, (req, res) => {
  try {
    const { periodId } = req.params;

    db.deleteChristmasPeriod(periodId);

    return res.json({ success: true });
  } catch (error) {
    logger.error('deleting Christmas period:', error);
    return res.status(500).json({ error: 'Chyba při mazání vánočního období' });
  }
});

// Proposed bookings endpoints
app.post('/api/proposed-booking', (req, res) => {
  try {
    const { sessionId, startDate, endDate, rooms } = req.body;

    if (!sessionId || !startDate || !endDate || !rooms || rooms.length === 0) {
      return res.status(400).json({ error: 'Chybí povinné údaje' });
    }

    // Delete any existing proposals for this session
    db.deleteProposedBookingsBySession(sessionId);

    // Create new proposed booking
    const proposalId = db.createProposedBooking(sessionId, startDate, endDate, rooms);

    return res.json({ success: true, proposalId });
  } catch (error) {
    logger.error('creating proposed booking:', error);
    return res.status(500).json({ error: 'Chyba při vytváření navrhované rezervace' });
  }
});

app.get('/api/proposed-bookings', readLimiter, (req, res) => {
  try {
    const proposedBookings = db.getActiveProposedBookings();
    return res.json(proposedBookings);
  } catch (error) {
    logger.error('getting proposed bookings:', error);
    return res.status(500).json({ error: 'Chyba při načítání navrhovaných rezervací' });
  }
});

app.get('/api/proposed-bookings/session/:sessionId', readLimiter, (req, res) => {
  try {
    const { sessionId } = req.params;
    const proposedBookings = db.getProposedBookingsBySession(sessionId);
    return res.json(proposedBookings);
  } catch (error) {
    logger.error('getting proposed bookings by session:', error);
    return res.status(500).json({ error: 'Chyba při načítání navrhovaných rezervací' });
  }
});

app.post('/api/proposed-bookings', writeLimiter, (req, res) => {
  try {
    const { sessionId, startDate, endDate, rooms, guests, guestType, totalPrice } = req.body;

    if (!sessionId || !startDate || !endDate || !rooms) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const proposalId = db.createProposedBooking(
      sessionId,
      startDate,
      endDate,
      rooms,
      guests || {},
      guestType || 'external',
      totalPrice || 0
    );
    return res.json({ success: true, proposalId });
  } catch (error) {
    logger.error('creating proposed booking:', error);
    return res.status(500).json({ error: 'Chyba při vytváření navrhované rezervace' });
  }
});

app.delete('/api/proposed-booking/:proposalId', writeLimiter, (req, res) => {
  try {
    const { proposalId } = req.params;

    db.deleteProposedBooking(proposalId);

    return res.json({ success: true });
  } catch (error) {
    logger.error('deleting proposed booking:', error);
    return res.status(500).json({ error: 'Chyba při mazání navrhované rezervace' });
  }
});

app.delete('/api/proposed-bookings/session/:sessionId', writeLimiter, (req, res) => {
  try {
    const { sessionId } = req.params;

    db.deleteProposedBookingsBySession(sessionId);

    return res.json({ success: true });
  } catch (error) {
    logger.error('deleting proposed bookings by session:', error);
    return res.status(500).json({ error: 'Chyba při mazání navrhovaných rezervací' });
  }
});

// Cleanup expired proposed bookings (run every minute)
setInterval(() => {
  try {
    const result = db.deleteExpiredProposedBookings();
    if (result.changes > 0) {
      logger.info(`Cleaned up ${result.changes} expired proposed bookings`);
    }
  } catch (error) {
    logger.error('cleaning up expired proposed bookings:', error);
  }
}, 60000); // Run every minute

// Error handling middleware
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.logError(err, { url: req.url, method: req.method });
  res.status(500).json({
    error: 'Něco se pokazilo!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server běží na http://localhost:${PORT}`);
  logger.info(`Prostředí: ${process.env.NODE_ENV || 'development'}`);
  logger.info('Database: SQLite (bookings.db)');
  if (process.env.NODE_ENV !== 'production') {
    logger.warn(
      '⚠️  VAROVÁNÍ: Server běží v development módu. Pro produkci nastavte NODE_ENV=production'
    );
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    db.close();
    process.exit(0);
  });
});

module.exports = app;

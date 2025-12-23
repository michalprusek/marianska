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
const DateUtils = require('./js/shared/dateUtils');
const IdGenerator = require('./js/shared/idGenerator');
const PriceCalculator = require('./js/shared/priceCalculator');
const ChristmasUtils = require('./js/shared/christmasUtils');
const EmailService = require('./js/shared/emailService');
const { createLogger } = require('./js/shared/logger');
const { createAccessLogger } = require('./js/shared/accessLogger');
const {
  ValidationError: _ValidationError,
  AuthenticationError: _AuthenticationError,
  NotFoundError: _NotFoundError,
  ConflictError: _ConflictError,
  SessionExpiredError: _SessionExpiredError,
  DatabaseError: _DatabaseError,
} = require('./js/shared/errors');

// Initialize logger - DEBUG level in development
const logger = createLogger(
  'Server',
  process.env.NODE_ENV === 'development' ? 'DEBUG' : process.env.LOG_LEVEL || 'INFO'
);

// Initialize access logger for security audit trail
const accessLogger = createAccessLogger(path.join(__dirname, 'logs'));

// Initialize email service
const emailService = new EmailService({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  from: process.env.EMAIL_FROM,
  appUrl: process.env.APP_URL,
});

// Verify email connection on startup (non-blocking)
emailService
  .verifyConnection()
  .then((verified) => {
    if (verified) {
      logger.info('Email service ready');
    } else {
      logger.warn('Email service verification failed - emails may not be sent');
    }
  })
  .catch((error) => {
    logger.error('Email service initialization error:', error);
  });

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy - required when running behind nginx
app.set('trust proxy', true);

// Session timeout constants
// FIX: Extended from 2 hours to 7 days for better admin experience
const SESSION_TIMEOUT = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

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

// FIX 2025-12-11: Utility function to count guests by type (SSOT - used in multiple endpoints)
function countGuestsByType(guestNames) {
  if (!guestNames || !Array.isArray(guestNames)) {
    return { adults: 0, children: 0, toddlers: 0 };
  }
  return {
    adults: guestNames.filter((g) => g.personType === 'adult').length,
    children: guestNames.filter((g) => g.personType === 'child').length,
    toddlers: guestNames.filter((g) => g.personType === 'toddler').length,
  };
}

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
// SECURITY: Disable trust proxy validation since we're behind nginx reverse proxy
// The 'trust proxy' setting is required for proper IP detection but triggers a warning
// We explicitly disable the validation since we control the proxy configuration
const rateLimitConfig = {
  validate: { trustProxy: false }, // Disable validation - we trust our nginx proxy
};

// Skip rate limiting in test/development mode (high limits)
const isTestMode = process.env.NODE_ENV === 'test' || process.env.SKIP_RATE_LIMIT === 'true';
const testModeMax = 100000; // Effectively unlimited for tests

// Read-only endpoints (GET) - more lenient limit
const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTestMode ? testModeMax : 300, // Increased from 100 to accommodate calendar rendering
  message: 'Příliš mnoho požadavků z této IP adresy, zkuste to prosím později.',
  ...rateLimitConfig,
});

// Write endpoints (POST/PUT/DELETE) - stricter limit
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTestMode ? testModeMax : 500,
  message: 'Příliš mnoho požadavků z této IP adresy, zkuste to prosím později.',
  ...rateLimitConfig,
});

// Stricter rate limit for booking creation
const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 500, // max 500 bookings per hour
  message: 'Překročili jste limit 500 rezervací za hodinu. Zkuste to prosím později.',
  ...rateLimitConfig,
});

// Strict rate limit for admin login (defense against brute-force)
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // max 5 login attempts per 15 minutes
  skipSuccessfulRequests: true, // Don't count successful logins
  message: 'Příliš mnoho neúspěšných pokusů o přihlášení. Zkuste to za 15 minut.',
  ...rateLimitConfig,
});

// Rate limit for test email sending (defense against abuse)
const testEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 500, // max 500 test emails per hour
  message: 'Překročen limit pro odesílání testovacích emailů. Zkuste to za hodinu.',
  ...rateLimitConfig,
});

// Rate limit for contact form (defense against spam)
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 500, // max 500 contact messages per hour
  message: 'Překročen limit pro odesílání zpráv. Zkuste to za hodinu.',
  ...rateLimitConfig,
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

// Access logging middleware - log all HTTP requests
app.use(accessLogger.middleware());

// API Key authentication middleware (deprecated - kept for backward compatibility)
// eslint-disable-next-line no-underscore-dangle
const _requireApiKey = (req, res, next) => {
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
// All ID generation, date formatting, Christmas logic, and price calculation
// have been moved to shared utilities:
// - IdGenerator (js/shared/idGenerator.js)
// - DateUtils (js/shared/dateUtils.js)
// - ChristmasUtils (js/shared/christmasUtils.js)
// - PriceCalculator (js/shared/priceCalculator.js)

// Helper to check if booking price is locked
function isPriceLocked(booking) {
  if (!booking) {
    return false;
  }
  // Check for explicit flag (sqlite uses 1/0 for booleans)
  return (
    booking.price_locked === 1 || booking.price_locked === true || booking.price_locked === 'true'
  );
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

  return next();
}

/**
 * Helper to validate admin session from request headers
 * Returns { isAdmin: boolean, error: { status, message } | null }
 * DRY: Extracted from duplicated validation logic in PUT/DELETE booking endpoints
 */
function validateAdminSession(req) {
  const sessionToken = req.headers['x-session-token'];

  if (!sessionToken) {
    return { isAdmin: false, error: null }; // No session token provided, not an error (user might use editToken)
  }

  const session = db.getAdminSession(sessionToken);

  if (!session) {
    return {
      isAdmin: false,
      error: { status: 401, message: 'Neplatný session token - přihlaste se znovu' },
    };
  }

  // Check if session expired
  const expiresAt = new Date(session.expires_at).getTime();
  if (expiresAt < Date.now()) {
    db.deleteAdminSession(sessionToken);
    return {
      isAdmin: false,
      error: { status: 401, message: 'Session vypršela - přihlaste se znovu' },
    };
  }

  return { isAdmin: true, error: null, session };
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
  return next();
}

// Removed: calculatePrice() - now using PriceCalculator.calculatePriceFromRooms()

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

    // FIX 2025-12-11: Preserve group_id mappings before deletion
    // The insertBooking statement doesn't include group_id, so we need to restore it after re-insert
    const groupIdMap = new Map();
    const existingBookings = db.getAllBookings();
    existingBookings.forEach((b) => {
      if (b.groupId) {
        groupIdMap.set(b.id, b.groupId);
      }
    });
    logger.info('Preserved group_id mappings before data save', { count: groupIdMap.size });

    // Clear existing data
    db.db.exec('DELETE FROM bookings');
    db.db.exec('DELETE FROM booking_rooms');
    db.db.exec('DELETE FROM blockage_instances');
    db.db.exec('DELETE FROM blockage_rooms');

    // Insert bookings
    if (dataToSave.bookings && dataToSave.bookings.length > 0) {
      for (const booking of dataToSave.bookings) {
        db.createBooking(booking);

        // FIX 2025-12-11: Restore group_id if it existed before deletion
        const originalGroupId = groupIdMap.get(booking.id);
        if (originalGroupId) {
          db.statements.updateBookingGroupId.run(
            originalGroupId,
            new Date().toISOString(),
            booking.id
          );
        }
      }
    }

    // Insert blocked dates - PREFER blockageInstances over legacy blockedDates
    // This preserves date ranges correctly instead of collapsing to single days
    if (dataToSave.blockageInstances && dataToSave.blockageInstances.length > 0) {
      // Use modern format with full date ranges
      for (const instance of dataToSave.blockageInstances) {
        db.createBlockageInstance({
          blockageId: instance.blockageId,
          startDate: instance.startDate,
          endDate: instance.endDate,
          reason: instance.reason,
          createdAt: instance.createdAt,
          rooms: instance.rooms || [],
        });
      }
    } else if (dataToSave.blockedDates && dataToSave.blockedDates.length > 0) {
      // Legacy fallback: reconstruct date ranges from expanded single dates
      // Group by blockageId and find min/max dates to restore original range
      const blockageMap = new Map();

      for (const blocked of dataToSave.blockedDates) {
        const id = blocked.blockageId || db.generateBlockageId();
        if (!blockageMap.has(id)) {
          blockageMap.set(id, {
            blockageId: id,
            dates: [],
            reason: blocked.reason,
            createdAt: blocked.blockedAt || new Date().toISOString(),
            rooms: new Set(),
          });
        }
        const entry = blockageMap.get(id);
        entry.dates.push(blocked.date);
        if (blocked.roomId) {
          entry.rooms.add(blocked.roomId);
        }
      }

      for (const entry of blockageMap.values()) {
        const sortedDates = entry.dates.sort();
        db.createBlockageInstance({
          blockageId: entry.blockageId,
          startDate: sortedDates[0],
          endDate: sortedDates[sortedDates.length - 1],
          reason: entry.reason,
          createdAt: entry.createdAt,
          rooms: [...entry.rooms],
        });
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
app.post('/api/booking', bookingLimiter, async (req, res) => {
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

    // Check Christmas period access with date-based rules using shared ChristmasUtils
    const settings = db.getSettings();
    const isChristmas =
      ChristmasUtils.isChristmasPeriod(bookingData.startDate, settings) ||
      ChristmasUtils.isChristmasPeriod(bookingData.endDate, settings);

    if (isChristmas) {
      const christmasPeriodStart = settings.christmasPeriod?.start;
      const isBulkBooking = bookingData.isBulkBooking || false;
      const today = new Date();

      const { codeRequired, bulkBlocked } = ChristmasUtils.checkChristmasAccessRequirement(
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
        const codeLimitCheck = checkChristmasCodeRateLimit(clientIp);
        if (!codeLimitCheck.allowed) {
          logger.warn('Christmas code rate limit exceeded', { ip: clientIp });
          return res.status(429).json({
            error: `Příliš mnoho neplatných pokusů o vánoční kód. Zkuste to za ${codeLimitCheck.minutesLeft} minut.`,
          });
        }

        if (
          !bookingData.christmasCode ||
          !ChristmasUtils.validateChristmasCode(bookingData.christmasCode, settings)
        ) {
          logger.warn('Invalid Christmas code attempt', {
            ip: clientIp,
            remaining: codeLimitCheck.remaining,
          });
          return res
            .status(403)
            .json({ error: 'Rezervace v období vánočních prázdnin vyžaduje přístupový kód' });
        }

        // Valid code - reset rate limit for this IP
        resetChristmasCodeAttempts(clientIp);
      }

      // NEW 2025-10-16: Validate Christmas room limit for ÚTIA employees
      const roomLimitValidation = ChristmasUtils.validateChristmasRoomLimit(
        bookingData,
        today,
        christmasPeriodStart
      );

      if (!roomLimitValidation.valid) {
        return res.status(403).json({ error: roomLimitValidation.error });
      }

      // If there's a warning (e.g., 2 rooms), log it but allow booking
      if (roomLimitValidation.warning) {
        logger.info('Christmas room limit warning', {
          email: bookingData.email,
          rooms: bookingData.rooms,
          warning: roomLimitValidation.warning,
        });
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

    // FIX 2025-12-23: Removed adults < 1 check - business rule changed to allow
    // rooms with children only (e.g., grandparents booking for grandchildren).
    // totalGuests === 0 check below still ensures at least 1 paying guest exists.

    if (bookingData.adults < 0 || bookingData.children < 0 || bookingData.toddlers < 0) {
      return res.status(400).json({ error: 'Počet hostů nemůže být záporný' });
    }

    if (totalGuests === 0) {
      return res.status(400).json({ error: 'Rezervace musí obsahovat alespoň 1 hosta' });
    }

    // Guest names validation moved to frontend (collectGuestNames() in single-room-booking.js)
    // Detailed validation happens when creating temp reservation, before finalization
    // Keep minimal backend check for security (in case of direct API access)
    if (!bookingData.guestNames || !Array.isArray(bookingData.guestNames)) {
      return res.status(400).json({ error: 'Jména hostů jsou povinná' });
    }

    // Basic sanitization for security
    const MAX_NAME_LENGTH = 50;
    bookingData.guestNames.forEach((guest) => {
      if (guest.firstName) {
        // eslint-disable-next-line no-param-reassign -- sanitizing in place is intentional
        guest.firstName = sanitizeInput(guest.firstName.trim(), MAX_NAME_LENGTH);
      }
      if (guest.lastName) {
        // eslint-disable-next-line no-param-reassign -- sanitizing in place is intentional
        guest.lastName = sanitizeInput(guest.lastName.trim(), MAX_NAME_LENGTH);
      }
    });

    // NEW UNIFIED SCHEMA (2025-12-04): Ensure all guests have roomId
    // For single room bookings, assign all guests to that room
    // For bulk bookings, assign all guests to first room (entire chalet is reserved)
    // For multi-room bookings, guests must have roomId from frontend
    if (bookingData.rooms && bookingData.rooms.length === 1) {
      const singleRoomId = bookingData.rooms[0];
      bookingData.guestNames.forEach((guest) => {
        if (!guest.roomId) {
          // eslint-disable-next-line no-param-reassign
          guest.roomId = singleRoomId;
        }
      });
    } else if (bookingData.isBulkBooking) {
      // FIX 2025-12-05: Bulk booking - entire chalet is reserved, assign guests to first room
      // (roomId is required by schema but doesn't matter for bulk bookings)
      const firstRoomId = bookingData.rooms[0];
      bookingData.guestNames.forEach((guest) => {
        if (!guest.roomId) {
          // eslint-disable-next-line no-param-reassign
          guest.roomId = firstRoomId;
        }
      });
    } else {
      // Multi-room booking - validate all guests have roomId
      const missingRoomId = bookingData.guestNames.find((g) => !g.roomId);
      if (missingRoomId) {
        return res.status(400).json({
          error: `Host ${missingRoomId.firstName} ${missingRoomId.lastName} nemá přiřazený pokoj`,
        });
      }
    }

    // CRITICAL FIX 2025-10-07: Server-side capacity validation
    // Prevent users from bypassing client-side checks via direct API calls
    if (bookingData.isBulkBooking) {
      // Bulk booking: Check against total chalet capacity (26 beds)
      if (totalGuests > 26) {
        return res.status(400).json({
          error: `Překročena kapacita chaty (26 lůžek). Máte ${totalGuests} hostů.`,
        });
      }
      // Minimum 10 guests for bulk bookings (2025-12-02)
      if (totalGuests < 10) {
        return res.status(400).json({
          error: 'Hromadná rezervace vyžaduje minimálně 10 osob (dospělí + děti).',
          minimumGuestsRequired: 10,
          actualGuests: totalGuests,
        });
      }
    } else {
      // Individual rooms: Check capacity of selected rooms
      let totalCapacity = 0;
      for (const roomId of bookingData.rooms) {
        const room = settings.rooms.find((r) => r.id === roomId);
        if (!room) {
          return res.status(400).json({
            error: `Pokoj ${roomId} neexistuje`,
          });
        }
        totalCapacity += room.beds || 0;
      }

      if (totalGuests > totalCapacity) {
        return res.status(400).json({
          error: `Počet hostů (${totalGuests}) překračuje kapacitu vybraných pokojů (${totalCapacity} lůžek). Poznámka: Batolata (0-3 roky) se nepočítají.`,
        });
      }
    }

    // CRITICAL FIX: Wrap availability check + booking creation in transaction
    // This prevents race conditions where two users book the same room simultaneously
    const transaction = db.db.transaction(() => {
      // NEW 2025-11-14: Check availability for each room using per-room dates if available
      // INCLUSIVE: Check all dates including the end date
      for (const roomId of bookingData.rooms) {
        // Determine date range for THIS specific room
        let roomStartDate;
        let roomEndDate;
        if (bookingData.perRoomDates && bookingData.perRoomDates[roomId]) {
          // Use per-room date range
          roomStartDate = new Date(bookingData.perRoomDates[roomId].startDate);
          roomEndDate = new Date(bookingData.perRoomDates[roomId].endDate);
        } else {
          // Fallback to booking-level dates (backward compatibility)
          roomStartDate = new Date(bookingData.startDate);
          roomEndDate = new Date(bookingData.endDate);
        }

        const current = new Date(roomStartDate);
        while (current.getTime() <= roomEndDate.getTime()) {
          const dateStr = DateUtils.formatDate(current);
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

      // Calculate price using shared PriceCalculator
      // NEW 2025-11-14: Use booking-level nights only as fallback (for bulk or non-composite bookings)
      const nights = DateUtils.getDaysBetween(bookingData.startDate, bookingData.endDate);

      // CRITICAL FIX: Determine correct guestType based on actual guest names
      // If at least ONE guest has guestPriceType 'utia', use ÚTIA pricing for empty room
      // Otherwise (all external), use external pricing
      const hasUtiaGuest =
        bookingData.guestNames && Array.isArray(bookingData.guestNames)
          ? bookingData.guestNames.some((guest) => guest.guestPriceType === 'utia')
          : false;
      const actualGuestType = hasUtiaGuest ? 'utia' : 'external';

      // CRITICAL FIX: Use correct price calculation based on booking type
      if (bookingData.isBulkBooking) {
        // Bulk booking: Use bulk pricing structure (flat base + per-person charges)
        // FIX 2025-12-06: Derive guestTypeBreakdown from guestNames (SSOT) instead of trusting frontend
        const guestNames = bookingData.guestNames || [];
        const derivedBreakdown = {
          utiaAdults: guestNames.filter(
            (g) => g.personType === 'adult' && g.guestPriceType === 'utia'
          ).length,
          externalAdults: guestNames.filter(
            (g) => g.personType === 'adult' && g.guestPriceType === 'external'
          ).length,
          utiaChildren: guestNames.filter(
            (g) => g.personType === 'child' && g.guestPriceType === 'utia'
          ).length,
          externalChildren: guestNames.filter(
            (g) => g.personType === 'child' && g.guestPriceType === 'external'
          ).length,
        };

        const hasGuestBreakdown =
          derivedBreakdown.utiaAdults +
            derivedBreakdown.externalAdults +
            derivedBreakdown.utiaChildren +
            derivedBreakdown.externalChildren >
          0;

        if (hasGuestBreakdown) {
          const { utiaAdults, externalAdults, utiaChildren, externalChildren } = derivedBreakdown;
          // SSOT: Use PriceCalculator for mixed guest type pricing
          bookingData.totalPrice = PriceCalculator.calculateMixedBulkPrice({
            utiaAdults,
            externalAdults,
            utiaChildren,
            externalChildren,
            nights,
            settings,
          });
          logger.info(
            'Bulk booking price calculated with mixed guest types (derived from guestNames)',
            {
              guestTypeBreakdown: derivedBreakdown,
              nights,
              totalPrice: bookingData.totalPrice,
            }
          );
        } else {
          // Fallback: Use single guestType pricing
          bookingData.totalPrice = PriceCalculator.calculateBulkPrice({
            guestType: actualGuestType,
            adults: bookingData.adults,
            children: bookingData.children || 0,
            toddlers: bookingData.toddlers || 0,
            nights,
            settings,
          });
        }
      } else if (
        // Individual room booking: Use per-guest pricing if guest names available
        bookingData.guestNames &&
        Array.isArray(bookingData.guestNames) &&
        bookingData.guestNames.length > 0
      ) {
        // NEW: Per-guest pricing - correctly handles mixed ÚTIA/external guests
        bookingData.totalPrice = PriceCalculator.calculatePerGuestPrice({
          rooms: bookingData.rooms,
          guestNames: bookingData.guestNames,
          perRoomGuests: bookingData.perRoomGuests, // FIX #4: Pass per-room guest type data
          perRoomDates: bookingData.perRoomDates || null, // NEW 2025-11-14: Pass per-room dates
          nights, // Fallback if no per-room dates
          settings,
          fallbackGuestType: actualGuestType,
        });
      } else {
        // FALLBACK: Legacy pricing for bookings without guest names
        bookingData.totalPrice = PriceCalculator.calculatePriceFromRooms({
          rooms: bookingData.rooms,
          guestType: actualGuestType,
          adults: bookingData.adults,
          children: bookingData.children || 0,
          toddlers: bookingData.toddlers || 0,
          nights,
          settings,
        });
      }

      // Store the actual guest type (not the one from client request)
      bookingData.guestType = actualGuestType;

      // Generate secure IDs
      bookingData.id = IdGenerator.generateBookingId();
      bookingData.editToken = IdGenerator.generateEditToken();
      bookingData.createdAt = new Date().toISOString();
      bookingData.updatedAt = new Date().toISOString();

      // Create the booking (still locked)
      db.createBooking(bookingData);

      return bookingData;
    });

    // Execute transaction atomically
    const booking = transaction();

    // FIX 2025-12-10: Ensure guest counts are derived from guestNames (SSOT) for email template
    // FIX 2025-12-11: Use countGuestsByType utility function
    const guestCounts = countGuestsByType(booking.guestNames);
    booking.adults = guestCounts.adults;
    booking.children = guestCounts.children;
    booking.toddlers = guestCounts.toddlers;

    // FIX 2025-12-02: Send booking confirmation email NON-BLOCKING
    // Previously, awaiting email caused 30+ second delays when SMTP server was slow/unreachable
    // Now we fire-and-forget: booking response is sent immediately, email sent in background
    emailService
      .sendBookingConfirmation(booking, { settings })
      .then((emailResult) => {
        logger.info('Booking confirmation email sent', {
          bookingId: booking.id,
          email: booking.email,
          messageId: emailResult.messageId,
        });
      })
      .catch((emailError) => {
        logger.error('Failed to send booking confirmation email', {
          bookingId: booking.id,
          email: booking.email,
          error: emailError.message,
        });
      });

    // Return success immediately - don't wait for email
    return res.json({
      success: true,
      booking,
      editToken: booking.editToken,
    });
  } catch (error) {
    // P1 FIX: Properly log error with stack trace for debugging
    logger.error('creating booking:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });

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

// ============================================================
// GROUPED BOOKING ENDPOINT (2025-12-09)
// Create multiple bookings in a single transaction, grouped together
// ============================================================
app.post('/api/booking/group', bookingLimiter, async (req, res) => {
  try {
    const { sessionId, reservations, contact, christmasCode } = req.body;

    // Validate required fields
    if (!reservations || !Array.isArray(reservations) || reservations.length === 0) {
      return res.status(400).json({ error: 'Chybí rezervace' });
    }

    // FIX 2025-12-09: Limit maximum number of reservations per group to prevent DoS
    const MAX_RESERVATIONS_PER_GROUP = 50;
    if (reservations.length > MAX_RESERVATIONS_PER_GROUP) {
      return res.status(400).json({
        error: `Příliš mnoho rezervací v jedné skupině (max ${MAX_RESERVATIONS_PER_GROUP})`,
      });
    }

    if (!contact || !contact.name || !contact.email || !contact.phone) {
      return res.status(400).json({ error: 'Chybí kontaktní údaje' });
    }

    // Validate field lengths
    if (contact.name && contact.name.length > MAX_LENGTHS.name) {
      return res
        .status(400)
        .json({ error: `Jméno je příliš dlouhé (max ${MAX_LENGTHS.name} znaků)` });
    }
    if (contact.email && contact.email.length > MAX_LENGTHS.email) {
      return res
        .status(400)
        .json({ error: `Email je příliš dlouhý (max ${MAX_LENGTHS.email} znaků)` });
    }

    // Validate email format
    if (!ValidationUtils.validateEmail(contact.email)) {
      return res.status(400).json({
        error: ValidationUtils.getValidationError('email', contact.email, 'cs'),
      });
    }

    // Validate phone format
    if (!ValidationUtils.validatePhone(contact.phone)) {
      return res.status(400).json({
        error: ValidationUtils.getValidationError('phone', contact.phone, 'cs'),
      });
    }

    // Sanitize inputs
    contact.name = sanitizeInput(contact.name, MAX_LENGTHS.name);
    contact.company = sanitizeInput(contact.company, MAX_LENGTHS.company);
    contact.address = sanitizeInput(contact.address, MAX_LENGTHS.address);
    contact.city = sanitizeInput(contact.city, MAX_LENGTHS.city);
    contact.notes = sanitizeInput(contact.notes, MAX_LENGTHS.notes);

    // Get settings for Christmas period and pricing
    const settings = db.getSettings();

    // Validate each reservation
    for (let i = 0; i < reservations.length; i++) {
      const reservation = reservations[i];

      // Validate dates
      if (!reservation.startDate || !reservation.endDate) {
        return res.status(400).json({ error: `Rezervace ${i + 1}: Chybí datum` });
      }

      // Validate rooms
      if (
        !reservation.rooms ||
        !Array.isArray(reservation.rooms) ||
        reservation.rooms.length === 0
      ) {
        return res.status(400).json({ error: `Rezervace ${i + 1}: Chybí pokoje` });
      }

      // Check Christmas period access
      const isChristmas =
        ChristmasUtils.isChristmasPeriod(reservation.startDate, settings) ||
        ChristmasUtils.isChristmasPeriod(reservation.endDate, settings);

      if (isChristmas) {
        const christmasPeriodStart = settings.christmasPeriod?.start;
        const today = new Date();
        const { codeRequired, bulkBlocked } = ChristmasUtils.checkChristmasAccessRequirement(
          today,
          christmasPeriodStart,
          reservation.isBulkBooking
        );

        if (bulkBlocked && reservation.isBulkBooking) {
          return res.status(403).json({
            error: 'Hromadné rezervace celé chaty nejsou po 1. října povoleny pro vánoční období.',
          });
        }

        if (codeRequired && !ChristmasUtils.validateChristmasCode(christmasCode, settings)) {
          return res.status(403).json({ error: 'Neplatný přístupový kód pro vánoční období' });
        }
      }

      // FIX 2025-12-23: At least 1 paying guest required (adult OR child).
      // Toddlers excluded - they don't pay and don't count toward room capacity.
      const totalGuests = (reservation.guestNames || []).filter(
        (g) => g.personType === 'adult' || g.personType === 'child'
      ).length;
      if (totalGuests < 1) {
        return res
          .status(400)
          .json({ error: `Rezervace ${i + 1}: Je vyžadován alespoň 1 host (dospělý nebo dítě)` });
      }

      // Validate room availability for each room in this reservation
      for (const roomId of reservation.rooms) {
        const roomDates = reservation.perRoomDates?.[roomId] || {
          startDate: reservation.startDate,
          endDate: reservation.endDate,
        };

        // Check availability
        const startDate = new Date(roomDates.startDate);
        const endDate = new Date(roomDates.endDate);

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const dateStr = DateUtils.formatDate(d);
          const availability = db.getRoomAvailability(roomId, dateStr, sessionId);

          // Skip edge days - they are available for booking
          if (availability.status === 'edge') {
            continue;
          }

          if (!availability.available) {
            return res.status(409).json({
              error: `Pokoj ${roomId} není dostupný v termínu ${roomDates.startDate} - ${roomDates.endDate}`,
              room: roomId,
              date: dateStr,
            });
          }
        }
      }
    }

    // Create grouped booking in database transaction
    const result = db.createGroupedBooking({
      sessionId,
      reservations,
      contact,
    });

    logger.info('Grouped booking created', {
      groupId: result.groupId,
      bookingCount: result.bookings.length,
      totalPrice: result.totalPrice,
      email: contact.email,
    });

    // FIX 2025-12-09: Use pre-initialized emailService instance instead of non-existent require
    // Send confirmation email (non-blocking)

    // FIX 2025-12-10: Aggregate guest data from all reservations for email template
    // FIX 2025-12-11: Use countGuestsByType utility function
    const allGuestNames = reservations.flatMap((r) => r.guestNames || []);
    const {
      adults: aggregatedAdults,
      children: aggregatedChildren,
      toddlers: aggregatedToddlers,
    } = countGuestsByType(allGuestNames);
    // Determine guestType: if any ÚTIA guest exists, mark as utia
    const hasUtiaGuest = allGuestNames.some(
      (g) => g.guestPriceType === 'utia' && g.personType !== 'toddler'
    );
    const aggregatedGuestType = hasUtiaGuest ? 'utia' : 'external';
    // Merge perRoomDates and perRoomGuests from all reservations
    const mergedPerRoomDates = {};
    const mergedPerRoomGuests = {};
    for (const r of reservations) {
      Object.assign(mergedPerRoomDates, r.perRoomDates || {});
      Object.assign(mergedPerRoomGuests, r.perRoomGuests || {});
    }

    const combinedBooking = {
      id: result.groupId,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      // FIX 2025-12-10: Add editToken from first booking - required for sendBookingConfirmation
      editToken: result.bookings[0]?.editToken,
      startDate: reservations.reduce(
        (min, r) => (r.startDate < min ? r.startDate : min),
        reservations[0].startDate
      ),
      endDate: reservations.reduce(
        (max, r) => (r.endDate > max ? r.endDate : max),
        reservations[0].endDate
      ),
      rooms: [...new Set(reservations.flatMap((r) => r.rooms))],
      totalPrice: result.totalPrice,
      isBulkBooking: reservations.some((r) => r.isBulkBooking),
      isGroupedBooking: true,
      bookingCount: result.bookings.length,
      // FIX 2025-12-10: Add guest data for email template
      adults: aggregatedAdults,
      children: aggregatedChildren,
      toddlers: aggregatedToddlers,
      guestType: aggregatedGuestType,
      guestNames: allGuestNames,
      perRoomDates: mergedPerRoomDates,
      perRoomGuests: mergedPerRoomGuests,
      intervals: reservations.map((r) => ({
        rooms: r.rooms,
        startDate: r.startDate,
        endDate: r.endDate,
        price: r.totalPrice,
      })),
    };

    emailService.sendBookingConfirmation(combinedBooking, { settings }).catch((emailErr) => {
      logger.error('Failed to send grouped booking confirmation', {
        error: emailErr.message,
        groupId: result.groupId,
      });
    });

    // Delete proposed bookings for this session
    db.deleteProposedBookingsBySession(sessionId);

    return res.status(201).json({
      success: true,
      groupId: result.groupId,
      bookings: result.bookings,
      totalPrice: result.totalPrice,
    });
  } catch (error) {
    logger.error('Error creating grouped booking', {
      error: error.message,
      stack: error.stack,
    });

    const errorMessage = error.message.includes('není dostupný')
      ? error.message
      : 'Nepodařilo se vytvořit skupinovou rezervaci';

    return res
      .status(error.message.includes('není dostupný') ? 409 : 500)
      .json({ error: errorMessage });
  }
});

// Get booking by edit token - for user edit page
app.get('/api/booking-by-token', readLimiter, (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Token je povinný' });
    }

    // Find booking by edit token
    const booking = db.getBookingByEditToken(token);

    if (!booking) {
      return res.status(404).json({ error: 'Rezervace nenalezena' });
    }

    // Return booking data (edit token is validated by existence)
    return res.json(booking);
  } catch (error) {
    logger.error('Error fetching booking by token:', error);
    return res.status(500).json({ error: 'Nepodařilo se načíst rezervaci' });
  }
});

// Update booking - requires edit token or API key
app.put('/api/booking/:id', writeLimiter, async (req, res) => {
  try {
    const bookingId = req.params.id;
    const editToken = req.headers['x-edit-token'] || req.body.editToken;

    // Get existing booking to verify edit token
    const existingBooking = db.getBooking(bookingId);

    if (!existingBooking) {
      return res.status(404).json({ error: 'Rezervace nenalezena' });
    }

    // FIX 2025-12-11: Extract skipOwnerEmail flag before merging (not a booking field)
    // NOTE: This flag is only honored for admin requests (checked later after isAdmin is determined)
    const skipOwnerEmailRequested = req.body.skipOwnerEmail === true;

    // Merge existing booking with incoming changes (partial update support)
    // This allows updating only specific fields like name, email, phone etc.
    const { skipOwnerEmail: _, ...bodyWithoutSkipFlag } = req.body;
    const bookingData = { ...existingBooking, ...bodyWithoutSkipFlag };

    // DRY: Use shared helper for admin session validation
    const { isAdmin, error: sessionError } = validateAdminSession(req);
    if (sessionError) {
      return res.status(sessionError.status).json({ error: sessionError.message });
    }

    // If not admin, verify edit token
    if (!isAdmin) {
      if (!editToken || editToken !== existingBooking.editToken) {
        return res.status(403).json({ error: 'Neplatný editační token' });
      }
    }

    // Check if booking is paid (cannot be edited by users)
    if (!isAdmin && existingBooking.paid) {
      return res.status(403).json({
        error:
          'Tato rezervace byla zaplacena a nelze ji upravit. Pro změny kontaktujte administrátora.',
        isPaid: true,
        paidBooking: true,
      });
    }

    // Check 3-day edit deadline for non-admin users using DateUtils (SSOT)
    if (!isAdmin) {
      const daysUntilStart = DateUtils.calculateDaysUntilStart(existingBooking.startDate);

      if (daysUntilStart < 3) {
        return res.status(403).json({
          error:
            'Úpravy rezervace jsou možné pouze 3 dny před začátkem pobytu. Pro změny kontaktujte administrátora.',
          daysUntilStart,
          editDeadlinePassed: true,
        });
      }
    }

    // SECURITY: Prevent modification of rooms list in edit mode (users can only change dates/guests)
    if (!isAdmin && bookingData.rooms) {
      const originalRooms = existingBooking.rooms.sort().join(',');
      const newRooms = bookingData.rooms.sort().join(',');
      if (originalRooms !== newRooms) {
        return res.status(400).json({
          error: 'V editaci nelze měnit seznam pokojů. Můžete měnit pouze termíny a počty hostů.',
        });
      }
    }

    // Minimum 10 guests validation for bulk bookings (2025-12-02)
    const isBulkBookingEdit = bookingData.isBulkBooking || existingBooking.isBulkBooking;
    if (isBulkBookingEdit) {
      const totalGuestsEdit =
        (bookingData.adults || existingBooking.adults || 0) +
        (bookingData.children || existingBooking.children || 0);
      if (totalGuestsEdit < 10) {
        return res.status(400).json({
          error: 'Hromadná rezervace vyžaduje minimálně 10 osob (dospělí + děti).',
          minimumGuestsRequired: 10,
          actualGuests: totalGuestsEdit,
        });
      }
    }

    // FIX 2025-12-19: Add capacity validation to PUT endpoint (mirror of POST logic)
    // Prevents bypassing client-side capacity checks via direct API calls
    const settings = db.getSettings();
    const totalGuestsForCapacity =
      (bookingData.adults || existingBooking.adults || 0) +
      (bookingData.children || existingBooking.children || 0);
    // Note: toddlers don't count toward capacity (can sleep with parents)

    if (isBulkBookingEdit) {
      // Bulk booking: Check against total cottage capacity (26 beds)
      if (totalGuestsForCapacity > 26) {
        return res.status(400).json({
          error: `Překročena kapacita chaty (26 lůžek). Máte ${totalGuestsForCapacity} hostů.`,
          capacityExceeded: true,
        });
      }
    } else {
      // Individual rooms: Check capacity of selected rooms
      const roomsToCheck = bookingData.rooms || existingBooking.rooms || [];
      let totalCapacity = 0;
      for (const roomId of roomsToCheck) {
        const room = settings.rooms?.find((r) => r.id === roomId);
        if (room) {
          totalCapacity += room.beds || 0;
        }
      }

      if (totalGuestsForCapacity > totalCapacity) {
        return res.status(400).json({
          error: `Počet hostů (${totalGuestsForCapacity}) překračuje kapacitu vybraných pokojů (${totalCapacity} lůžek). Poznámka: Batolata (0-3 roky) se nepočítají.`,
          capacityExceeded: true,
          totalGuests: totalGuestsForCapacity,
          totalCapacity,
        });
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

    // FIX 2025-12-06: Only validate guest names when explicitly provided in request body
    // This prevents validation errors when editing unrelated fields (e.g., payFromBenefit)
    // Previously: bookingData.guestNames included inherited values, triggering false validation
    if (req.body.guestNames) {
      if (!Array.isArray(bookingData.guestNames)) {
        return res.status(400).json({ error: 'Jména hostů musí být pole' });
      }

      // For composite bookings with perRoomGuests, sum up guests from all rooms
      let expectedAdults = bookingData.adults || 0;
      let expectedChildren = bookingData.children || 0;
      let expectedToddlers = bookingData.toddlers || 0;

      if (bookingData.perRoomGuests && typeof bookingData.perRoomGuests === 'object') {
        expectedAdults = 0;
        expectedChildren = 0;
        expectedToddlers = 0;
        for (const roomData of Object.values(bookingData.perRoomGuests)) {
          expectedAdults += roomData.adults || 0;
          expectedChildren += roomData.children || 0;
          expectedToddlers += roomData.toddlers || 0;
        }
      }

      const expectedCount = expectedAdults + expectedChildren + expectedToddlers;
      if (bookingData.guestNames.length !== expectedCount) {
        return res.status(400).json({
          error: `Počet jmen (${bookingData.guestNames.length}) neodpovídá počtu hostů (${expectedCount})`,
        });
      }

      // SECURITY FIX: Validate adult/child/toddler count distribution
      const adultCount = bookingData.guestNames.filter((g) => g.personType === 'adult').length;
      const childCount = bookingData.guestNames.filter((g) => g.personType === 'child').length;
      const toddlerCount = bookingData.guestNames.filter((g) => g.personType === 'toddler').length;

      if (adultCount !== expectedAdults) {
        return res.status(400).json({
          error: `Počet dospělých jmen (${adultCount}) neodpovídá počtu dospělých (${expectedAdults})`,
        });
      }

      if (childCount !== expectedChildren) {
        return res.status(400).json({
          error: `Počet dětských jmen (${childCount}) neodpovídá počtu dětí (${expectedChildren})`,
        });
      }

      if (toddlerCount !== expectedToddlers) {
        return res.status(400).json({
          error: `Počet jmen batolat (${toddlerCount}) neodpovídá počtu batolat (${expectedToddlers})`,
        });
      }

      const MAX_NAME_LENGTH = 50;

      for (let i = 0; i < bookingData.guestNames.length; i++) {
        const guest = bookingData.guestNames[i];

        if (!guest.firstName || !guest.firstName.trim()) {
          return res.status(400).json({ error: `Křestní jméno hosta ${i + 1} je povinné` });
        }

        if (guest.firstName.trim().length < 2) {
          return res
            .status(400)
            .json({ error: `Křestní jméno hosta ${i + 1} musí mít alespoň 2 znaky` });
        }

        // SECURITY FIX: Add maximum length validation
        if (guest.firstName.trim().length > MAX_NAME_LENGTH) {
          return res.status(400).json({
            error: `Křestní jméno hosta ${i + 1} nesmí překročit ${MAX_NAME_LENGTH} znaků`,
          });
        }

        if (!guest.lastName || !guest.lastName.trim()) {
          return res.status(400).json({ error: `Příjmení hosta ${i + 1} je povinné` });
        }

        if (guest.lastName.trim().length < 2) {
          return res
            .status(400)
            .json({ error: `Příjmení hosta ${i + 1} musí mít alespoň 2 znaky` });
        }

        // SECURITY FIX: Add maximum length validation
        if (guest.lastName.trim().length > MAX_NAME_LENGTH) {
          return res.status(400).json({
            error: `Příjmení hosta ${i + 1} nesmí překročit ${MAX_NAME_LENGTH} znaků`,
          });
        }

        if (
          guest.personType !== 'adult' &&
          guest.personType !== 'child' &&
          guest.personType !== 'toddler'
        ) {
          return res.status(400).json({
            error: `Neplatný typ osoby pro hosta ${i + 1} (musí být 'adult', 'child' nebo 'toddler')`,
          });
        }

        // Validate guest price type (NEW 2025-11-04: per-guest pricing)
        const hasGuestType = guest.guestPriceType !== undefined && guest.guestPriceType !== null;
        const isInvalidGuestType =
          hasGuestType && guest.guestPriceType !== 'utia' && guest.guestPriceType !== 'external';
        if (isInvalidGuestType) {
          return res.status(400).json({
            error: `Neplatný typ hosta pro hosta ${i + 1} (musí být 'utia' nebo 'external')`,
          });
        }

        // SECURITY FIX: Sanitize guest names before storing
        guest.firstName = sanitizeInput(guest.firstName.trim(), MAX_NAME_LENGTH);
        guest.lastName = sanitizeInput(guest.lastName.trim(), MAX_NAME_LENGTH);
      }

      // NEW UNIFIED SCHEMA (2025-12-04): Ensure all guests have roomId
      // FIX 2025-12-05: Add isBulkBooking check (was missing - caused "nemá přiřazený pokoj" error)
      const rooms = bookingData.rooms || existingBooking.rooms;
      const isBulkBookingForRoomId = bookingData.isBulkBooking || existingBooking.isBulkBooking;

      if (rooms && rooms.length === 1) {
        // Single room booking - assign all guests to that room
        const singleRoomId = rooms[0];
        bookingData.guestNames.forEach((guest) => {
          if (!guest.roomId) {
            // eslint-disable-next-line no-param-reassign
            guest.roomId = singleRoomId;
          }
        });
      } else if (isBulkBookingForRoomId) {
        // FIX 2025-12-05: Bulk booking - entire chalet is reserved
        // Assign all guests to first room (roomId is schema requirement but doesn't matter for bulk)
        const firstRoomId = rooms[0];
        bookingData.guestNames.forEach((guest) => {
          if (!guest.roomId) {
            // eslint-disable-next-line no-param-reassign
            guest.roomId = firstRoomId;
          }
        });
      } else {
        // Multi-room booking - validate all guests have roomId
        const missingRoomId = bookingData.guestNames.find((g) => !g.roomId);
        if (missingRoomId) {
          return res.status(400).json({
            error: `Host ${missingRoomId.firstName} ${missingRoomId.lastName} nemá přiřazený pokoj`,
          });
        }
      }
    }

    // Validate dates
    const startDate = new Date(bookingData.startDate);
    const endDate = new Date(bookingData.endDate);

    if (startDate >= endDate) {
      return res.status(400).json({ error: 'Datum odjezdu musí být po datu příjezdu' });
    }

    // Check Christmas period access with date-based rules using shared ChristmasUtils
    // Note: settings already loaded above for capacity validation
    const isChristmas =
      ChristmasUtils.isChristmasPeriod(bookingData.startDate, settings) ||
      ChristmasUtils.isChristmasPeriod(bookingData.endDate, settings);

    if (isChristmas) {
      const christmasPeriodStart = settings.christmasPeriod?.start;
      const isBulkBooking = bookingData.isBulkBooking || false;
      const today = new Date();

      const { codeRequired, bulkBlocked } = ChristmasUtils.checkChristmasAccessRequirement(
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
        const codeLimitCheck = checkChristmasCodeRateLimit(clientIp);
        if (!codeLimitCheck.allowed) {
          logger.warn('Christmas code rate limit exceeded', { ip: clientIp });
          return res.status(429).json({
            error: `Příliš mnoho neplatných pokusů o vánoční kód. Zkuste to za ${codeLimitCheck.minutesLeft} minut.`,
          });
        }

        if (
          !bookingData.christmasCode ||
          !ChristmasUtils.validateChristmasCode(bookingData.christmasCode, settings)
        ) {
          logger.warn('Invalid Christmas code attempt', {
            ip: clientIp,
            remaining: codeLimitCheck.remaining,
          });
          return res
            .status(403)
            .json({ error: 'Rezervace v období vánočních prázdnin vyžaduje přístupový kód' });
        }

        // Valid code - reset rate limit for this IP
        resetChristmasCodeAttempts(clientIp);
      }

      // NEW 2025-10-16: Validate Christmas room limit for ÚTIA employees
      const roomLimitValidation = ChristmasUtils.validateChristmasRoomLimit(
        bookingData,
        today,
        christmasPeriodStart
      );

      if (!roomLimitValidation.valid) {
        return res.status(403).json({ error: roomLimitValidation.error });
      }

      // If there's a warning (e.g., 2 rooms), log it but allow booking
      if (roomLimitValidation.warning) {
        logger.info('Christmas room limit warning (edit)', {
          bookingId,
          email: bookingData.email,
          rooms: bookingData.rooms,
          warning: roomLimitValidation.warning,
        });
      }
    }

    // FIX 2025-12-06: Only check room availability when dates or rooms are actually changing
    // This prevents false conflict errors when editing non-date fields (e.g., payFromBenefit, name)
    const datesOrRoomsChanged =
      bookingData.startDate !== existingBooking.startDate ||
      bookingData.endDate !== existingBooking.endDate ||
      JSON.stringify((bookingData.rooms || []).sort()) !==
        JSON.stringify((existingBooking.rooms || []).sort());

    if (datesOrRoomsChanged) {
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
    }

    // Detect if only payment-related fields are changing
    const priceAffectingFieldsChanged =
      bookingData.startDate !== existingBooking.startDate ||
      bookingData.endDate !== existingBooking.endDate ||
      bookingData.adults !== existingBooking.adults ||
      bookingData.children !== existingBooking.children ||
      bookingData.toddlers !== existingBooking.toddlers ||
      JSON.stringify(bookingData.rooms?.sort()) !== JSON.stringify(existingBooking.rooms?.sort()) ||
      bookingData.isBulkBooking !== existingBooking.isBulkBooking ||
      JSON.stringify(bookingData.guestNames) !== JSON.stringify(existingBooking.guestNames);

    const isLocked = isPriceLocked(existingBooking);

    if (isLocked) {
      logger.info('Price recalculation skipped for locked booking', { bookingId });
    }

    // Recalculate price if price-affecting fields changed OR explicitly requested
    // AND price is NOT locked
    if (!isLocked && (req.query.recalculate === 'true' || priceAffectingFieldsChanged)) {
      const nights = DateUtils.getDaysBetween(bookingData.startDate, bookingData.endDate);

      // CRITICAL FIX: Use correct price calculation based on booking type
      if (bookingData.isBulkBooking) {
        // Bulk booking: Use bulk pricing structure (flat base + per-person charges)
        // FIX 2025-12-06: Derive guestTypeBreakdown from guestNames (SSOT) instead of trusting frontend
        const guestNames = bookingData.guestNames || existingBooking.guestNames || [];
        const derivedBreakdown = {
          utiaAdults: guestNames.filter(
            (g) => g.personType === 'adult' && g.guestPriceType === 'utia'
          ).length,
          externalAdults: guestNames.filter(
            (g) => g.personType === 'adult' && g.guestPriceType === 'external'
          ).length,
          utiaChildren: guestNames.filter(
            (g) => g.personType === 'child' && g.guestPriceType === 'utia'
          ).length,
          externalChildren: guestNames.filter(
            (g) => g.personType === 'child' && g.guestPriceType === 'external'
          ).length,
        };

        const hasGuestBreakdown =
          derivedBreakdown.utiaAdults +
            derivedBreakdown.externalAdults +
            derivedBreakdown.utiaChildren +
            derivedBreakdown.externalChildren >
          0;

        if (hasGuestBreakdown) {
          const { utiaAdults, externalAdults, utiaChildren, externalChildren } = derivedBreakdown;
          // SSOT: Use PriceCalculator for mixed guest type pricing
          bookingData.totalPrice = PriceCalculator.calculateMixedBulkPrice({
            utiaAdults,
            externalAdults,
            utiaChildren,
            externalChildren,
            nights,
            settings,
          });
          logger.info(
            'Bulk booking update price calculated with mixed guest types (derived from guestNames)',
            {
              guestTypeBreakdown: derivedBreakdown,
              nights,
              totalPrice: bookingData.totalPrice,
            }
          );
        } else {
          // Fallback: Use single guestType pricing
          bookingData.totalPrice = PriceCalculator.calculateBulkPrice({
            guestType: bookingData.guestType,
            adults: bookingData.adults,
            children: bookingData.children || 0,
            toddlers: bookingData.toddlers || 0,
            nights,
            settings,
          });
        }
      } else if (
        // Individual room booking: Use per-guest pricing if guest names available
        bookingData.guestNames &&
        Array.isArray(bookingData.guestNames) &&
        bookingData.guestNames.length > 0
      ) {
        // FIX 2025-12: Use existing perRoomGuests from request if available,
        // otherwise construct fallback for legacy/single-room bookings
        let perRoomGuests = bookingData.perRoomGuests || existingBooking.perRoomGuests;

        // Only construct fallback if perRoomGuests not provided
        if (!perRoomGuests || Object.keys(perRoomGuests).length === 0) {
          perRoomGuests = {};
          const rooms = bookingData.rooms || existingBooking.rooms || [];
          for (const roomId of rooms) {
            perRoomGuests[roomId] = {
              adults: bookingData.adults || existingBooking.adults || 0,
              children: bookingData.children || existingBooking.children || 0,
              toddlers: bookingData.toddlers || existingBooking.toddlers || 0,
              // FIX: Do not force guestType here. Let PriceCalculator derive it
              // from guestNames (primary) or fallbackGuestType (secondary).
              // guestType: bookingData.guestType,
            };
          }
        }

        // NEW: Per-guest pricing - correctly handles mixed ÚTIA/external guests
        bookingData.totalPrice = PriceCalculator.calculatePerGuestPrice({
          rooms: bookingData.rooms,
          guestNames: bookingData.guestNames,
          perRoomGuests, // FIX 2025-12: Now passed (from request or constructed)
          perRoomDates: bookingData.perRoomDates || null, // FIX 2025-12: Pass if available
          nights,
          settings,
          fallbackGuestType: bookingData.guestType,
        });
      } else {
        // FALLBACK: Legacy pricing for bookings without guest names
        bookingData.totalPrice = PriceCalculator.calculatePriceFromRooms({
          rooms: bookingData.rooms,
          guestType: bookingData.guestType,
          adults: bookingData.adults,
          children: bookingData.children || 0,
          toddlers: bookingData.toddlers || 0,
          nights,
          settings,
        });
      }
    } else {
      // Preserve original price when only non-price-affecting fields changed
      bookingData.totalPrice = existingBooking.totalPrice;
    }

    // Detect what changed for email notification
    const changes = {};

    // Date changes
    if (
      bookingData.startDate !== existingBooking.startDate ||
      bookingData.endDate !== existingBooking.endDate
    ) {
      changes.dates = true;
    }

    // Guest count changes
    if (
      bookingData.adults !== existingBooking.adults ||
      bookingData.children !== existingBooking.children ||
      bookingData.toddlers !== existingBooking.toddlers
    ) {
      changes.guests = true;
    }

    // Room changes (admin only, but include in detection)
    if (
      bookingData.rooms &&
      JSON.stringify(bookingData.rooms.sort()) !== JSON.stringify(existingBooking.rooms.sort())
    ) {
      changes.rooms = true;
    }

    // Payment status changes
    if (bookingData.paid !== existingBooking.paid) {
      changes.payment = true;
    }

    // Payment method changes (benefit vs standard)
    if (bookingData.payFromBenefit !== existingBooking.payFromBenefit) {
      changes.paymentMethod = true;
    }

    // Notes changes
    if (bookingData.notes !== existingBooking.notes) {
      changes.notes = true;
    }

    // Guest names changes (important for cabin managers)
    if (
      bookingData.guestNames &&
      JSON.stringify(bookingData.guestNames) !== JSON.stringify(existingBooking.guestNames || [])
    ) {
      changes.guestNames = true;
    }

    // Other field changes (name, email, phone, etc.)
    const otherFields = [
      'name',
      'email',
      'phone',
      'company',
      'address',
      'city',
      'zip',
      'ico',
      'dic',
    ];
    for (const field of otherFields) {
      if (bookingData[field] !== undefined && bookingData[field] !== existingBooking[field]) {
        changes.other = true;
        break;
      }
    }

    // Update the booking
    db.updateBooking(bookingId, bookingData);
    const updatedBooking = db.getBooking(bookingId);

    // FIX 2025-12-09: Recalculate group price if booking is part of a group
    if (updatedBooking.groupId) {
      const newGroupTotal = db.updateBookingGroupPrice(updatedBooking.groupId);
      logger.info('Group price recalculated after booking update', {
        bookingId,
        groupId: updatedBooking.groupId,
        newGroupTotal,
      });
    }

    // Send notification emails
    // 1. Send to user (booking owner) about the modification (unless skipOwnerEmail is true)
    // 2. Send to admins and cabin managers based on change type
    try {
      // FIX 2025-12-11: Allow admin to skip owner email notification
      // Security: Only honor skipOwnerEmail if request is from admin
      const skipOwnerEmail = isAdmin && skipOwnerEmailRequested;
      if (!skipOwnerEmail) {
        // Send modification email to the user (non-blocking)
        emailService
          .sendBookingModification(updatedBooking, changes, {
            modifiedByAdmin: isAdmin,
            settings,
          })
          .then((userEmailResult) => {
            logger.info('User modification email sent', {
              bookingId: updatedBooking.id,
              email: updatedBooking.email,
              messageId: userEmailResult?.messageId || 'unknown',
            });
          })
          .catch((userEmailError) => {
            logger.error('Failed to send user modification email', {
              bookingId: updatedBooking.id,
              email: updatedBooking.email,
              error: userEmailError.message,
            });
          });
      } else {
        logger.info('Owner email notification skipped by admin request', {
          bookingId: updatedBooking.id,
          email: updatedBooking.email,
        });
      }

      // FIX 2025-12-02: Send to admins and cabin managers NON-BLOCKING
      // Previously, awaiting email caused delays when SMTP was slow/unreachable
      emailService
        .sendBookingNotifications(updatedBooking, changes, settings, 'updated')
        .then((emailResult) => {
          logger.info('Booking notification emails sent', {
            bookingId: updatedBooking.id,
            email: updatedBooking.email,
            modifiedByAdmin: isAdmin,
            changes: Object.keys(changes),
            notificationScope: emailResult.notificationScope,
            results: emailResult.results,
          });
        })
        .catch((emailError) => {
          logger.error('Failed to send booking notification emails', {
            bookingId: updatedBooking.id,
            email: updatedBooking.email,
            error: emailError.message,
          });
        });

      // Return success immediately - don't wait for email
      return res.json({
        success: true,
        booking: updatedBooking,
      });
    } catch (error) {
      // This catch is now only for non-email errors since email is non-blocking
      logger.error('Error in notification block:', {
        bookingId: updatedBooking.id,
        error: error.message,
      });
      // Still return success since booking was updated
      return res.json({
        success: true,
        booking: updatedBooking,
      });
    }
  } catch (error) {
    logger.error('updating booking:', {
      message: error.message,
      stack: error.stack,
      bookingId: req.params.id,
    });
    // SECURITY FIX: Don't expose internal error details in production
    const errorDetails = process.env.NODE_ENV === 'production' ? undefined : error.message;
    return res
      .status(500)
      .json({ error: 'Nepodařilo se aktualizovat rezervaci', details: errorDetails });
  }
});

// Delete booking - requires API key or edit token
app.delete('/api/booking/:id', writeLimiter, async (req, res) => {
  try {
    const bookingId = req.params.id;
    const editToken = req.headers['x-edit-token'];

    // Get existing booking to verify edit token
    const existingBooking = db.getBooking(bookingId);

    if (!existingBooking) {
      return res.status(404).json({ error: 'Rezervace nenalezena' });
    }

    // DRY: Use shared helper for admin session validation
    let { isAdmin, error: sessionError } = validateAdminSession(req);
    if (sessionError) {
      return res.status(sessionError.status).json({ error: sessionError.message });
    }

    // Fallback: Check if API key is provided for admin access (legacy/script access)
    if (!isAdmin) {
      const apiKey = req.headers['x-api-key'];
      if (apiKey && apiKey === process.env.API_KEY) {
        isAdmin = true;
      } else if (!editToken || editToken !== existingBooking.editToken) {
        return res.status(403).json({ error: 'Neplatný editační token' });
      }
    }

    // Check if booking is paid (cannot be deleted by users)
    if (!isAdmin && existingBooking.paid) {
      return res.status(403).json({
        error:
          'Tato rezervace byla zaplacena a nelze ji zrušit. Pro zrušení kontaktujte administrátora.',
        isPaid: true,
        paidBooking: true,
      });
    }

    // Check 3-day delete deadline for non-admin users using DateUtils (SSOT)
    if (!isAdmin) {
      const daysUntilStart = DateUtils.calculateDaysUntilStart(existingBooking.startDate);

      if (daysUntilStart < 3) {
        return res.status(403).json({
          error:
            'Zrušení rezervace je možné pouze 3 dny před začátkem pobytu. Pro zrušení kontaktujte administrátora.',
          daysUntilStart,
          editDeadlinePassed: true,
        });
      }
    }

    // Load settings for email notification
    const settings = db.getSettings();

    // Delete the booking from database
    db.deleteBooking(bookingId);

    // Send deletion notification email (await result)
    try {
      const emailResult = await emailService.sendBookingDeletion(existingBooking, {
        settings,
        deletedByAdmin: isAdmin,
      });
      logger.info('Booking deletion email sent', {
        bookingId: existingBooking.id,
        email: existingBooking.email,
        deletedByAdmin: isAdmin,
        messageId: emailResult.messageId,
      });

      return res.json({ success: true });
    } catch (emailError) {
      // Email failed - log error but still return success (booking was deleted)
      logger.error('Failed to send booking deletion email', {
        bookingId: existingBooking.id,
        email: existingBooking.email,
        error: emailError.message,
      });

      return res.json({
        success: true,
        warning: 'Rezervace byla zrušena, ale nepodařilo se odeslat notifikační email.',
        emailSent: false,
      });
    }
  } catch (error) {
    logger.error('deleting booking:', error);
    return res.status(500).json({ error: 'Nepodařilo se smazat rezervaci' });
  }
});

// Bulk delete bookings endpoint - admin only
// Deletes multiple bookings in single transaction, sends emails in parallel background
app.post('/api/bookings/bulk-delete', writeLimiter, async (req, res) => {
  try {
    const { bookingIds } = req.body;

    // Validate input
    if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
      return res.status(400).json({ error: 'bookingIds must be a non-empty array' });
    }

    // Limit batch size to prevent abuse
    if (bookingIds.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 bookings per batch delete' });
    }

    // Validate admin session (required for bulk delete)
    const { isAdmin, error: sessionError } = validateAdminSession(req);
    if (sessionError) {
      return res.status(sessionError.status).json({ error: sessionError.message });
    }
    if (!isAdmin) {
      return res.status(403).json({ error: 'Bulk delete requires admin access' });
    }

    // Fetch all bookings before deletion (for email notifications)
    const bookingsToDelete = [];
    const notFoundIds = [];
    for (const bookingId of bookingIds) {
      const booking = db.getBooking(bookingId);
      if (booking) {
        bookingsToDelete.push(booking);
      } else {
        notFoundIds.push(bookingId);
      }
    }

    if (bookingsToDelete.length === 0) {
      return res.status(404).json({ error: 'No valid bookings found to delete' });
    }

    // Delete all bookings in a single transaction
    const deleteStmt = db.db.prepare('DELETE FROM bookings WHERE id = ?');
    const deleteRoomsStmt = db.db.prepare('DELETE FROM booking_rooms WHERE booking_id = ?');

    const deleteTransaction = db.db.transaction(() => {
      for (const booking of bookingsToDelete) {
        deleteRoomsStmt.run(booking.id);
        deleteStmt.run(booking.id);
      }
    });

    deleteTransaction();

    logger.info('Bulk delete completed', {
      deletedCount: bookingsToDelete.length,
      notFoundCount: notFoundIds.length,
    });

    // Send email notifications in parallel (fire and forget - don't block response)
    const settings = db.getSettings();
    setImmediate(() => {
      const emailPromises = bookingsToDelete.map((booking) =>
        emailService
          .sendBookingDeletion(booking, { settings, deletedByAdmin: true })
          .catch((err) => {
            logger.error('Bulk delete email failed', {
              bookingId: booking.id,
              error: err.message,
            });
          })
      );
      Promise.all(emailPromises).then(() => {
        logger.info('Bulk delete emails sent', { count: bookingsToDelete.length });
      });
    });

    return res.json({
      success: true,
      deletedCount: bookingsToDelete.length,
      deletedIds: bookingsToDelete.map((b) => b.id),
      notFoundIds,
    });
  } catch (error) {
    logger.error('Bulk delete error:', error);
    return res.status(500).json({ error: 'Nepodařilo se smazat rezervace' });
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
    .replace(/&/gu, '&amp;') // Must be first - escape ampersands
    .replace(/</gu, '&lt;') // Escape less-than
    .replace(/>/gu, '&gt;') // Escape greater-than
    .replace(/"/gu, '&quot;') // Escape double quotes
    .replace(/'/gu, '&#x27;') // Escape single quotes
    .replace(/\//gu, '&#x2F;') // Escape forward slash
    .slice(0, maxLength);
}

// Helper to escape HTML for safe innerHTML usage
// Removed: escapeHtml() - function was never used (sanitizeInput already handles escaping)

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

/**
 * Validate price structure for admin settings
 * Ensures all required fields exist, are numbers, and within valid ranges
 * @param {Object} prices - Price object from settings
 * @returns {Object} {valid: boolean, error?: string}
 */
function validatePriceStructure(prices) {
  if (!prices || typeof prices !== 'object') {
    return { valid: false, error: 'Ceny musí být objekt' };
  }

  const requiredKeys = ['utia', 'external'];
  const requiredSizes = ['small', 'large'];
  const requiredPriceFields = ['empty', 'adult', 'child'];

  for (const guestType of requiredKeys) {
    if (!prices[guestType] || typeof prices[guestType] !== 'object') {
      return { valid: false, error: `Chybí ceny pro typ ${guestType}` };
    }

    for (const roomSize of requiredSizes) {
      if (!prices[guestType][roomSize] || typeof prices[guestType][roomSize] !== 'object') {
        return {
          valid: false,
          error: `Chybí ceny pro ${guestType} pokoje velikosti ${roomSize}`,
        };
      }

      for (const priceField of requiredPriceFields) {
        const value = prices[guestType][roomSize][priceField];

        // Check if value exists and is a number
        if (value === undefined || value === null) {
          return {
            valid: false,
            error: `Chybí hodnota ${guestType}.${roomSize}.${priceField}`,
          };
        }

        if (typeof value !== 'number') {
          return {
            valid: false,
            error: `Hodnota ${guestType}.${roomSize}.${priceField} musí být číslo, je ${typeof value}`,
          };
        }

        // Check range: 0 to 100000 CZK
        if (value < 0 || value > 100000) {
          return {
            valid: false,
            error: `Hodnota ${guestType}.${roomSize}.${priceField} (${value}) je mimo povolený rozsah 0-100000 Kč`,
          };
        }

        // Check for decimal places (prices should be whole numbers in CZK)
        if (!Number.isInteger(value)) {
          return {
            valid: false,
            error: `Cena ${guestType}.${roomSize}.${priceField} (${value}) musí být celé číslo`,
          };
        }
      }
    }
  }

  return { valid: true };
}

/**
 * Validate bulk prices structure
 * @param {Object} bulkPrices - Bulk price object from settings
 * @returns {Object} {valid: boolean, error?: string}
 */
function validateBulkPrices(bulkPrices) {
  if (!bulkPrices || typeof bulkPrices !== 'object') {
    return { valid: false, error: 'Bulk ceny musí být objekt' };
  }

  const requiredFields = ['basePrice', 'utiaAdult', 'utiaChild', 'externalAdult', 'externalChild'];

  for (const field of requiredFields) {
    const value = bulkPrices[field];

    if (value === undefined || value === null) {
      return { valid: false, error: `Chybí hodnota bulkPrices.${field}` };
    }

    if (typeof value !== 'number') {
      return {
        valid: false,
        error: `Hodnota bulkPrices.${field} musí být číslo, je ${typeof value}`,
      };
    }

    if (value < 0 || value > 100000) {
      return {
        valid: false,
        error: `Hodnota bulkPrices.${field} (${value}) je mimo povolený rozsah 0-100000 Kč`,
      };
    }

    if (!Number.isInteger(value)) {
      return {
        valid: false,
        error: `Cena bulkPrices.${field} (${value}) musí být celé číslo`,
      };
    }
  }

  return { valid: true };
}

// Protected admin endpoint - update settings
app.post('/api/admin/settings', requireSession, async (req, res) => {
  try {
    const settings = req.body;

    // Validate prices if provided
    if (settings.prices) {
      const priceValidation = validatePriceStructure(settings.prices);
      if (!priceValidation.valid) {
        logger.warn('Price validation failed:', priceValidation.error);
        return res.status(400).json({
          error: `Neplatná struktura cen: ${priceValidation.error}`,
        });
      }
    }

    // Validate bulk prices if provided
    if (settings.bulkPrices) {
      const bulkPriceValidation = validateBulkPrices(settings.bulkPrices);
      if (!bulkPriceValidation.valid) {
        logger.warn('Bulk price validation failed:', bulkPriceValidation.error);
        return res.status(400).json({
          error: `Neplatná struktura bulk cen: ${bulkPriceValidation.error}`,
        });
      }
    }

    // Hash admin password if provided
    if (settings.adminPassword) {
      const hashedPassword = await bcrypt.hash(settings.adminPassword, 10);
      settings.adminPassword = hashedPassword;
    }

    db.updateSettings(settings);
    logger.info('Settings updated successfully', {
      updatedFields: Object.keys(settings).filter((k) => k !== 'adminPassword'),
    });

    return res.json({ success: true });
  } catch (error) {
    logger.error('updating settings:', error);
    return res.status(500).json({ error: 'Chyba při ukládání nastavení' });
  }
});

// Test email endpoint (admin only) - with rate limiting to prevent abuse
app.post('/api/admin/test-email', testEmailLimiter, requireSession, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email je povinný' });
    }

    // Validate email format
    if (!ValidationUtils.validateEmail(email)) {
      return res.status(400).json({ error: 'Neplatný formát emailu' });
    }

    logger.info('Sending test email', { to: email });

    const result = await emailService.sendTestEmail(email);

    if (result.success) {
      return res.json({
        success: true,
        message: 'Testovací email byl odeslán',
        messageId: result.messageId,
      });
    }
    return res.status(500).json({
      success: false,
      error: 'Nepodařilo se odeslat testovací email',
      details: result.error,
    });
  } catch (error) {
    logger.error('Test email error:', error);
    return res.status(500).json({ error: 'Chyba při odesílání testovacího emailu' });
  }
});

// Contact form endpoint - public with rate limiting
app.post('/api/contact', contactLimiter, async (req, res) => {
  try {
    const { senderName, senderEmail, message, bookingId } = req.body;

    // Validate required fields
    if (!senderEmail || !message) {
      return res.status(400).json({ error: 'Chybí povinné údaje (email, zpráva)' });
    }

    // Validate email format
    if (!ValidationUtils.validateEmail(senderEmail)) {
      return res.status(400).json({
        error: ValidationUtils.getValidationError('email', senderEmail, 'cs'),
      });
    }

    // Validate message length (max 500 chars as per requirement)
    if (message.length < 10) {
      return res.status(400).json({ error: 'Zpráva musí mít alespoň 10 znaků' });
    }

    if (message.length > 500) {
      return res.status(400).json({ error: 'Zpráva je příliš dlouhá (max 500 znaků)' });
    }

    // Sanitize inputs
    const contactData = {
      senderName: sanitizeInput(senderName || 'Neuvedeno', 100),
      senderEmail: sanitizeInput(senderEmail, 254),
      message: sanitizeInput(message, 500),
      bookingId: bookingId ? sanitizeInput(bookingId, 20) : null,
    };

    // Load settings for contact email
    const settings = db.getSettings();

    // If bookingId is provided, send email to booking owner; otherwise send to admin
    if (contactData.bookingId) {
      // Fetch booking to get owner's email
      const booking = db.getBooking(contactData.bookingId);

      if (!booking) {
        return res.status(404).json({ error: 'Rezervace nenalezena' });
      }

      logger.info('Sending contact message to booking owner', {
        from: contactData.senderEmail,
        bookingId: contactData.bookingId,
        to: booking.email,
      });

      // Send email to booking owner using sendCustomEmailToBooker (await for delivery)
      // FIX 2025-12-10: Add editToken for edit link in email
      const emailData = {
        bookingId: booking.id,
        bookingOwnerEmail: booking.email,
        bookingOwnerName: booking.name,
        senderEmail: contactData.senderEmail,
        subject: 'Zpráva ohledně Vaší rezervace - Chata Mariánská',
        message: contactData.message,
        editToken: booking.editToken,
      };

      try {
        const result = await emailService.sendCustomEmailToBooker(emailData, { settings });
        logger.info('Contact message sent to booking owner', {
          from: contactData.senderEmail,
          to: booking.email,
          messageId: result.messageId,
        });

        return res.json({
          success: true,
          message: 'Zpráva byla odeslána. Odpovíme co nejdříve.',
        });
      } catch (emailError) {
        logger.error('Error sending contact message to booking owner', {
          from: contactData.senderEmail,
          to: booking.email,
          error: emailError.message,
        });

        return res.status(500).json({
          error: 'Nepodařilo se odeslat zprávu. Zkuste to prosím později.',
          emailSent: false,
        });
      }
    } else {
      // No bookingId - send to admin (original behavior)
      logger.info('Sending contact message to admin', {
        from: contactData.senderEmail,
      });

      try {
        const result = await emailService.sendContactMessage(contactData, { settings });
        logger.info('Contact message sent to admin', {
          from: contactData.senderEmail,
          messageId: result.messageId,
        });

        return res.json({
          success: true,
          message: 'Zpráva byla odeslána. Odpovíme co nejdříve.',
        });
      } catch (emailError) {
        logger.error('Error sending contact message to admin', {
          from: contactData.senderEmail,
          error: emailError.message,
        });

        return res.status(500).json({
          error: 'Nepodařilo se odeslat zprávu. Zkuste to prosím později.',
          emailSent: false,
        });
      }
    }
  } catch (error) {
    logger.error('Contact form error:', error);
    return res.status(500).json({ error: 'Nepodařilo se odeslat zprávu' });
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

    // CRITICAL FIX 2025-10-07: Use IdGenerator (SSOT) instead of inline generation
    const blockageId = IdGenerator.generateBlockageId();
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

// FIX 2025-12-11: Migration endpoint to fix ungrouped bookings
// Groups bookings by email + created_at timestamp (same moment = same booking session)
app.post('/api/admin/migrate-ungrouped-bookings', requireSession, (req, res) => {
  try {
    const result = db.migrateUngroupedBookings();
    logger.info('Migration completed', result);
    return res.json({
      success: true,
      message: `Migrace dokončena: vytvořeno ${result.groupsCreated} skupin, migrováno ${result.bookingsMigrated} rezervací`,
      ...result,
    });
  } catch (error) {
    logger.error('Migration failed:', error);
    return res.status(500).json({ error: 'Chyba při migraci rezervací' });
  }
});

// Proposed bookings endpoints
app.post('/api/proposed-booking', (req, res) => {
  try {
    const { sessionId, startDate, endDate, rooms, perRoomDates } = req.body;

    if (!sessionId || !startDate || !endDate || !rooms || rooms.length === 0) {
      return res.status(400).json({ error: 'Chybí povinné údaje' });
    }

    // FIX 2025-12-05: Do NOT delete existing proposals - allow multiple proposals per session
    // Users may intentionally create separate reservations (different contacts, payments, etc.)

    // Build per-room dates for this proposal only
    const finalPerRoomDates = {};
    for (const roomId of rooms) {
      finalPerRoomDates[roomId] =
        perRoomDates && perRoomDates[roomId] ? perRoomDates[roomId] : { startDate, endDate };
    }

    // Create new proposed booking (keeping existing proposals intact)
    const proposalId = db.createProposedBooking(sessionId, rooms, finalPerRoomDates);

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
    const { sessionId, startDate, endDate, rooms, perRoomDates } = req.body;

    if (!sessionId || !startDate || !endDate || !rooms) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Build per-room dates - use provided perRoomDates or default to booking-level dates
    const finalPerRoomDates = {};
    for (const roomId of rooms) {
      finalPerRoomDates[roomId] =
        perRoomDates && perRoomDates[roomId] ? perRoomDates[roomId] : { startDate, endDate };
    }

    // Check for conflicts with existing proposed bookings
    const activeProposals = db.getActiveProposedBookings();
    for (const proposal of activeProposals) {
      // Check each room for date conflicts
      for (const roomId of rooms) {
        if (proposal.rooms.includes(roomId)) {
          const newDates = finalPerRoomDates[roomId];
          const existingDates = proposal.perRoomDates[roomId];

          if (existingDates) {
            // FIX 2025-12-06: Use <= and >= to allow consecutive bookings (checkout = checkin)
            const datesOverlap = !(
              newDates.endDate <= existingDates.startDate ||
              newDates.startDate >= existingDates.endDate
            );

            if (datesOverlap) {
              if (proposal.sessionId === sessionId) {
                // Same session - delete old proposal
                db.deleteProposedBooking(proposal.proposalId);
              } else {
                // Different session - conflict error
                return res.status(409).json({
                  error: `Pokoj ${roomId} je již navrhován jiným uživatelem pro termín ${existingDates.startDate} - ${existingDates.endDate}`,
                  conflictingRoom: roomId,
                  conflictDates: existingDates,
                });
              }
            }
          }
        }
      }
    }

    const proposalId = db.createProposedBooking(sessionId, rooms, finalPerRoomDates);
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

// ==========================
// AUDIT LOG ENDPOINTS
// ==========================

/**
 * POST /api/audit-log
 * Create audit log entry for booking changes
 * No authentication required - logs all user and admin actions
 */
app.post('/api/audit-log', writeLimiter, (req, res) => {
  try {
    const {
      bookingId,
      actionType,
      userType,
      userIdentifier,
      roomId,
      beforeState,
      afterState,
      changeDetails,
    } = req.body;

    // Validate required fields
    if (!bookingId || !actionType || !userType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate action type
    const validActionTypes = [
      'room_added',
      'room_removed',
      'room_restored',
      'booking_created',
      'booking_updated',
      'booking_deleted',
    ];
    if (!validActionTypes.includes(actionType)) {
      return res.status(400).json({ error: 'Invalid action type' });
    }

    // Validate user type
    const validUserTypes = ['user', 'admin'];
    if (!validUserTypes.includes(userType)) {
      return res.status(400).json({ error: 'Invalid user type' });
    }

    // Create audit log
    const result = db.createAuditLog({
      bookingId,
      actionType,
      userType,
      userIdentifier,
      roomId,
      beforeState,
      afterState,
      changeDetails,
    });

    logger.info('Audit log created', { logId: result.logId, bookingId, actionType, userType });

    return res.json({ success: true, logId: result.logId });
  } catch (error) {
    logger.error('creating audit log:', error);
    return res.status(500).json({ error: 'Chyba při vytváření audit logu' });
  }
});

/**
 * GET /api/audit-logs/booking/:bookingId
 * Get audit logs for a specific booking
 * No authentication required - allows users to see edit history of their booking
 */
app.get('/api/audit-logs/booking/:bookingId', (req, res) => {
  try {
    const { bookingId } = req.params;

    const logs = db.getAuditLogsByBooking(bookingId);

    return res.json({ success: true, logs });
  } catch (error) {
    logger.error('fetching audit logs by booking:', error);
    return res.status(500).json({ error: 'Chyba při načítání audit logů' });
  }
});

/**
 * GET /api/audit-logs
 * Get all recent audit logs (admin only)
 * Requires admin session
 */
app.get('/api/audit-logs', requireSession, (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;

    const logs = db.getAllAuditLogs(limit);

    return res.json({ success: true, logs });
  } catch (error) {
    logger.error('fetching all audit logs:', error);
    return res.status(500).json({ error: 'Chyba při načítání audit logů' });
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

// FIX 2025-12-23: Automatic daily database backup system
// - Creates backup file: bookings-YYYY-MM-DD.db in ./backups/
// - Retains last 3 backups (older ones deleted automatically)
// - Runs initial backup on startup, then every day at midnight
// - Verifies backup file was created successfully
(function scheduleBackup() {
  const fsSync = require('fs');
  const backupDir = path.join(__dirname, 'backups');

  // Create backup directory if not exists
  if (!fsSync.existsSync(backupDir)) {
    fsSync.mkdirSync(backupDir, { recursive: true });
  }

  const runBackup = async () => {
    const timestamp = new Date().toISOString().split('T')[0];
    const backupPath = path.join(backupDir, `bookings-${timestamp}.db`);

    // Step 1: Create backup (async)
    try {
      await db.backup(backupPath);

      // Step 2: Verify backup was created and is not empty
      const stats = fsSync.statSync(backupPath);
      if (stats.size === 0) {
        throw new Error('Backup file is empty');
      }

      // Step 3: Verify backup integrity (quick check)
      const Database = require('better-sqlite3');
      const testDb = new Database(backupPath, { readonly: true });
      try {
        const result = testDb.pragma('integrity_check', { simple: true });
        if (result !== 'ok') {
          throw new Error(`Backup integrity check failed: ${result}`);
        }
      } finally {
        testDb.close();
      }

      logger.info(`✅ Database backup created: ${backupPath} (${Math.round(stats.size / 1024)} KB)`);
    } catch (backupError) {
      logger.error('Database backup failed', {
        backupPath,
        errorMessage: backupError.message,
        errorCode: backupError.code,
      });
      // Don't proceed to rotation if backup failed
      return;
    }

    // Step 3: Rotate old backups (separate error handling)
    try {
      const files = fsSync.readdirSync(backupDir)
        .filter(f => f.startsWith('bookings-') && f.endsWith('.db'))
        .sort()
        .reverse();

      for (const file of files.slice(3)) {
        const filePath = path.join(backupDir, file);
        try {
          fsSync.unlinkSync(filePath);
          logger.info(`🗑️ Old backup deleted: ${file}`);
        } catch (deleteError) {
          // Log individual file deletion failures but continue
          logger.warn('Failed to delete old backup file', {
            file,
            errorMessage: deleteError.message,
          });
        }
      }
    } catch (rotationError) {
      // Backup succeeded, rotation failed - less critical
      logger.warn('Backup rotation failed (backup was created successfully)', {
        backupDir,
        errorMessage: rotationError.message,
      });
    }
  };

  // Run initial backup on startup (ensures we have a recent backup)
  logger.info('📦 Running initial database backup on startup...');
  runBackup();

  // Calculate ms until next midnight
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const msUntilMidnight = midnight - now;

  // Schedule daily backup at midnight
  setTimeout(() => {
    runBackup();
    setInterval(runBackup, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);

  logger.info(`📅 Daily backup scheduled for midnight (in ${Math.round(msUntilMidnight / 1000 / 60)} minutes)`);
})();

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

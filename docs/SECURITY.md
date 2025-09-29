# Security Documentation

## 🔒 Security Overview

The Mariánská Reservation System implements multiple security layers to protect user data, prevent unauthorized access, and ensure system integrity.

```
┌─────────────────────────────────────┐
│        Security Layers              │
├─────────────────────────────────────┤
│ 1. Input Validation & Sanitization  │
│ 2. Access Control (Token-based)     │
│ 3. Admin Authentication             │
│ 4. Data Encryption (HTTPS)          │
│ 5. Session Management               │
│ 6. Rate Limiting (planned)          │
└─────────────────────────────────────┘
```

## 🛡️ Features

### Input Validation

All user inputs are validated both client-side and server-side:

```javascript
// Client-side validation
const validationRules = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^(\+420|\+421)\d{9}$/,
  zip: /^\d{5}$/,
  ico: /^\d{8}$/,
  dic: /^CZ\d{8}$/,
};

// Server-side validation
function validateBookingData(data) {
  const errors = [];

  if (!data.email?.includes('@')) {
    errors.push('Invalid email format');
  }

  if (!data.phone?.match(/^(\+420|\+421)\d{9}$/)) {
    errors.push('Invalid phone number');
  }

  if (data.zip && !data.zip.match(/^\d{5}$/)) {
    errors.push('ZIP code must be 5 digits');
  }

  return errors;
}
```

### Sanitization

All inputs are sanitized to prevent XSS attacks:

```javascript
// HTML entity encoding
function sanitizeInput(input) {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Applied to all user inputs
booking.name = sanitizeInput(req.body.name);
booking.notes = sanitizeInput(req.body.notes);
```

## 🔑 Access Control

### Edit Token System

Each booking gets a unique edit token for secure modifications:

```javascript
// Token generation
function generateEditToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Token validation
function validateEditToken(bookingId, providedToken) {
  const booking = getBooking(bookingId);
  return booking && booking.editToken === providedToken;
}
```

### Access URLs

- **Public Booking**: `/index.html` (no auth required)
- **Edit Booking**: `/edit.html?token=XXX` (token required)
- **Admin Panel**: `/admin.html` (password required)

### Admin Authentication

Session-based authentication for admin access:

```javascript
// Login validation
function validateAdminLogin(password) {
  const hashedInput = sha256(password);
  const storedHash = getAdminPasswordHash();
  return hashedInput === storedHash;
}

// Session management
function createAdminSession() {
  const sessionId = generateSessionId();
  const expires = Date.now() + 4 * 60 * 60 * 1000; // 4 hours

  sessions[sessionId] = {
    isAdmin: true,
    expires: expires,
  };

  return sessionId;
}

// Session validation
function validateSession(sessionId) {
  const session = sessions[sessionId];
  return session && session.expires > Date.now();
}
```

## 🔐 Data Protection

### Password Security

```javascript
// Never store plain text passwords
const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 512, 'sha512').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 512, 'sha512').toString('hex');
  return hash === verifyHash;
}
```

### Sensitive Data Handling

```javascript
// Mask sensitive data in logs
function maskSensitiveData(data) {
  const masked = { ...data };

  if (masked.email) {
    const [user, domain] = masked.email.split('@');
    masked.email = `${user.substring(0, 2)}***@${domain}`;
  }

  if (masked.phone) {
    masked.phone = masked.phone.substring(0, 6) + '****';
  }

  if (masked.ico) {
    masked.ico = '****' + masked.ico.substring(4);
  }

  return masked;
}
```

## 🌐 Network Security

### HTTPS Configuration

Production deployment must use HTTPS:

```nginx
# nginx.conf
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/ssl/certs/cert.pem;
    ssl_certificate_key /etc/ssl/private/key.pem;

    # Strong SSL Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Content-Security-Policy "default-src 'self'" always;
}
```

### CORS Configuration

```javascript
// Restrict cross-origin requests
const cors = require('cors');

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = ['https://yourdomain.com', 'https://www.yourdomain.com'];

    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
```

## 🚦 Rate Limiting

Prevent abuse and DDoS attacks:

```javascript
const rateLimit = require('express-rate-limit');

// General rate limit
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
});

// Stricter limit for booking creation
const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 bookings per hour
  skipSuccessfulRequests: false,
});

app.use('/api/', limiter);
app.use('/api/booking', bookingLimiter);
```

## 🍪 Session Management

### Session Security

```javascript
const session = require('express-session');

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true, // HTTPS only
      httpOnly: true, // Prevent XSS
      maxAge: 4 * 60 * 60 * 1000, // 4 hours
      sameSite: 'strict', // CSRF protection
    },
  })
);

// Session cleanup
setInterval(
  () => {
    const now = Date.now();
    for (const [id, session] of Object.entries(sessions)) {
      if (session.expires < now) {
        delete sessions[id];
      }
    }
  },
  60 * 60 * 1000
); // Clean every hour
```

## 🔍 Security Monitoring

### Logging Security Events

```javascript
const winston = require('winston');

const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.File({ filename: 'security.log' })],
});

// Log security events
function logSecurityEvent(event, details) {
  securityLogger.info({
    timestamp: new Date().toISOString(),
    event: event,
    details: maskSensitiveData(details),
    ip: details.ip,
    userAgent: details.userAgent,
  });
}

// Usage
logSecurityEvent('LOGIN_ATTEMPT', {
  success: false,
  ip: req.ip,
  userAgent: req.get('user-agent'),
});
```

### Intrusion Detection

```javascript
// Track suspicious patterns
const suspiciousPatterns = {
  sqlInjection: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION)\b)|(--)|(;)|(\||\\)/i,
  xssAttempt: /<script|<iframe|javascript:|onerror=|onload=/i,
  pathTraversal: /\.\.[\/\\]/,
};

function detectSuspiciousInput(input) {
  for (const [type, pattern] of Object.entries(suspiciousPatterns)) {
    if (pattern.test(input)) {
      logSecurityEvent('SUSPICIOUS_INPUT', {
        type: type,
        input: input.substring(0, 100),
      });
      return true;
    }
  }
  return false;
}
```

## 🛑 Security Vulnerabilities & Mitigations

### Common Vulnerabilities

| Vulnerability          | Risk Level | Mitigation                      |
| ---------------------- | ---------- | ------------------------------- |
| XSS                    | High       | Input sanitization, CSP headers |
| CSRF                   | Medium     | CSRF tokens, SameSite cookies   |
| SQL Injection          | N/A        | Using JSON file storage         |
| Session Hijacking      | Medium     | HTTPS, httpOnly cookies         |
| Brute Force            | Medium     | Rate limiting, account lockout  |
| Information Disclosure | Low        | Error message sanitization      |

### Security Headers

```javascript
// Implement security headers
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS filter
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data:; " +
      "font-src 'self';"
  );

  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  next();
});
```

## 🔄 Security Updates

### Dependency Management

```bash
# Regular security audits
npm audit

# Fix vulnerabilities
npm audit fix

# Check for outdated packages
npm outdated

# Update dependencies
npm update

# Use Dependabot or Snyk for automated updates
```

### Security Patches

```javascript
// Version check and update notification
const checkVersion = require('check-node-version');

checkVersion(
  {
    node: '>= 18.0.0',
    npm: '>= 9.0.0',
  },
  (error, result) => {
    if (error) {
      console.error('Version check failed:', error);
      return;
    }

    if (!result.isSatisfied) {
      console.warn('Please update Node.js/npm for security patches');
    }
  }
);
```

## 📋 Security Checklist

### Development

- [ ] Input validation on all forms
- [ ] Output encoding for XSS prevention
- [ ] Use parameterized queries (if using DB)
- [ ] Secure session management
- [ ] Error handling without info leakage

### Deployment

- [ ] HTTPS enabled with valid certificate
- [ ] Security headers configured
- [ ] Admin password changed from default
- [ ] Rate limiting enabled
- [ ] Logging and monitoring active
- [ ] Regular backups configured

### Maintenance

- [ ] Regular security audits
- [ ] Dependency updates
- [ ] Log review for suspicious activity
- [ ] Penetration testing (annually)
- [ ] Security training for team

## 🚨 Incident Response

### Response Plan

1. **Detection**
   - Monitor logs for anomalies
   - Set up alerts for suspicious activity

2. **Containment**
   - Isolate affected systems
   - Disable compromised accounts
   - Block suspicious IPs

3. **Investigation**
   - Analyze logs
   - Identify attack vector
   - Determine data exposure

4. **Recovery**
   - Patch vulnerabilities
   - Restore from backups if needed
   - Reset credentials

5. **Post-Incident**
   - Document incident
   - Update security measures
   - Notify affected users if required

### Contact Information

```
Security Team: security@yourdomain.com
Emergency: +420 XXX XXX XXX
CERT: cert@cert.cz
```

## 📚 Security Best Practices

1. **Principle of Least Privilege**: Grant minimum necessary permissions
2. **Defense in Depth**: Multiple security layers
3. **Zero Trust**: Verify everything, trust nothing
4. **Regular Updates**: Keep all software current
5. **Security by Design**: Build security from the start
6. **User Education**: Train users on security awareness
7. **Incident Preparedness**: Have a response plan ready

## 🔗 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Tips](https://expressjs.com/en/advanced/best-practice-security.html)
- [Mozilla Web Security](https://infosec.mozilla.org/guidelines/web_security)

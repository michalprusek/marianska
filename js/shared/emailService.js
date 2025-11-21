/**
 * Email Service - SMTP email sending for booking confirmations
 * Uses nodemailer to send emails via SMTP server
 *
 * @module emailService
 */

const nodemailer = require('nodemailer');
// Server-side require - not a redeclaration (client-side uses global DateUtils)
// eslint-disable-next-line no-redeclare
const DateUtils = require('./dateUtils');
const { createLogger } = require('./logger');

const logger = createLogger('EmailService');

/**
 * Email Service class for sending booking confirmation emails
 */
class EmailService {
  constructor(config = {}) {
    this.config = {
      host: config.host || process.env.SMTP_HOST || 'hermes.utia.cas.cz',
      port: config.port || parseInt(process.env.SMTP_PORT || '25', 10),
      secure: config.secure || process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: config.auth || null, // No auth for internal SMTP server
      from: config.from || process.env.EMAIL_FROM || 'noreply@chata.utia.cas.cz',
      appUrl: config.appUrl || process.env.APP_URL || 'http://chata.utia.cas.cz',
    };

    this.transporter = null;
    this.initializeTransporter();
  }

  /**
   * Initialize nodemailer transporter
   */
  initializeTransporter() {
    try {
      const transportConfig = {
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 10000, // 10 seconds
        socketTimeout: 30000, // 30 seconds
      };

      // Only add auth if configured
      if (this.config.auth && this.config.auth.user && this.config.auth.pass) {
        transportConfig.auth = this.config.auth;
      }

      this.transporter = nodemailer.createTransport(transportConfig);

      logger.info('Email transporter initialized', {
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
      });
    } catch (error) {
      logger.error('Failed to initialize email transporter:', error);
      throw error;
    }
  }

  /**
   * Verify SMTP connection
   * @returns {Promise<boolean>} True if connection successful
   */
  async verifyConnection() {
    try {
      await this.transporter.verify();
      logger.info('SMTP connection verified successfully');
      return true;
    } catch (error) {
      logger.error('SMTP connection verification failed:', error);
      return false;
    }
  }

  /**
   * Format room list for email display
   * @param {Array<string>} rooms - Room IDs
   * @returns {string} Formatted room list
   */
  formatRoomList(rooms) {
    if (!rooms || rooms.length === 0) {
      return 'Žádné pokoje';
    }
    return rooms.join(', ');
  }

  /**
   * Format price for display
   * @param {number} price - Price in CZK
   * @returns {string} Formatted price
   */
  formatPrice(price) {
    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: 'CZK',
    }).format(price);
  }

  /**
   * Decode HTML entities for plain text email display
   * @param {string} text - Text with HTML entities
   * @returns {string} Decoded text
   * @private
   */
  decodeHtmlEntities(text) {
    if (!text || typeof text !== 'string') {
      return text;
    }
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/');
  }

  /**
   * Format booking details (dates, guests, price, rooms) - helper for email templates
   * @param {Object} booking - Booking data
   * @param {Object} settings - System settings
   * @returns {Object} Formatted booking details
   * @private
   */
  formatBookingDetails(booking, settings = {}) {
    const startDate = DateUtils.parseDate(booking.startDate);
    const endDate = DateUtils.parseDate(booking.endDate);
    const startDateFormatted = DateUtils.formatDateDisplay(startDate, 'cs');
    const endDateFormatted = DateUtils.formatDateDisplay(endDate, 'cs');
    const nights = DateUtils.getDaysBetween(booking.startDate, booking.endDate);
    const roomList = this.formatRoomList(booking.rooms);
    const priceFormatted = this.formatPrice(booking.totalPrice);
    const guestTypeText = booking.guestType === 'utia' ? 'Zaměstnanec ÚTIA' : 'Externí host';
    const contactEmail = settings.contactEmail || 'chata@utia.cas.cz';

    // Decode HTML entities in text fields for plain text emails
    const name = this.decodeHtmlEntities(booking.name);
    const notes = this.decodeHtmlEntities(booking.notes);
    const company = this.decodeHtmlEntities(booking.company);
    const address = this.decodeHtmlEntities(booking.address);
    const city = this.decodeHtmlEntities(booking.city);

    return {
      startDate: booking.startDate,
      endDate: booking.endDate,
      startDateFormatted,
      endDateFormatted,
      nights,
      roomList,
      priceFormatted,
      guestTypeText,
      contactEmail,
      adults: booking.adults,
      children: booking.children || 0,
      toddlers: booking.toddlers || 0,
      notes,
      name,
      company,
      address,
      city,
    };
  }

  /**
   * Generate detailed price breakdown per room
   * @param {Object} booking - Booking data
   * @param {Object} settings - System settings
   * @returns {string} Formatted price breakdown
   * @private
   */
  generatePriceBreakdown(booking, settings = {}) {
    if (!booking || !settings || !settings.prices || !settings.rooms) {
      return 'Rozpis ceny není k dispozici';
    }

    const guestKey = booking.guestType === 'utia' ? 'utia' : 'external';
    const priceConfig = settings.prices[guestKey];
    const nights = DateUtils.getDaysBetween(booking.startDate, booking.endDate);

    // Handle per-room bookings
    if (booking.perRoomDates && booking.perRoomGuests) {
      let breakdown = '';
      let totalPrice = 0;

      for (const roomId of booking.rooms || []) {
        const room = settings.rooms.find((r) => r.id === roomId);
        const roomType = room?.type || 'small';
        const roomBeds = room?.beds || '?';
        const roomPriceConfig = priceConfig?.[roomType];

        if (!roomPriceConfig) {
          continue;
        }

        const roomDates = booking.perRoomDates[roomId];
        const roomGuests = booking.perRoomGuests[roomId] || {};
        const roomNights = roomDates
          ? DateUtils.getDaysBetween(roomDates.startDate, roomDates.endDate)
          : nights;
        const roomAdults = roomGuests.adults || 0;
        const roomChildren = roomGuests.children || 0;

        // Calculate room price
        // NEW MODEL 2025-11-10: Only 'empty' field (room-size based pricing)
        const emptyRoomPrice = roomPriceConfig.empty || 0;
        const basePrice = emptyRoomPrice * roomNights;
        const adultsPrice = roomAdults * (roomPriceConfig.adult || 0) * roomNights;
        const childrenPrice = roomChildren * (roomPriceConfig.child || 0) * roomNights;
        const roomTotal = basePrice + adultsPrice + childrenPrice;

        breakdown += `Pokoj ${roomId} (${roomBeds} lůžka)\n`;
        breakdown += `  Základní cena: ${emptyRoomPrice} Kč/noc × ${roomNights} nocí = ${basePrice} Kč\n`;
        if (roomAdults > 0) {
          breakdown += `  Dospělí: ${roomAdults} × ${roomPriceConfig.adult} Kč/noc × ${roomNights} nocí = ${adultsPrice} Kč\n`;
        }
        if (roomChildren > 0) {
          breakdown += `  Děti: ${roomChildren} × ${roomPriceConfig.child} Kč/noc × ${roomNights} nocí = ${childrenPrice} Kč\n`;
        }
        breakdown += `  Celkem za pokoj: ${roomTotal} Kč\n\n`;
        totalPrice += roomTotal;
      }

      // CRITICAL FIX: Use booking.totalPrice from database, not recalculated value
      // The recalculated value might differ due to rounding or pricing model changes
      const finalPrice = booking.totalPrice || totalPrice;
      breakdown += `CELKOVÁ CENA: ${finalPrice} Kč`;
      return breakdown.trim();
    }

    // Handle single-date bookings (all rooms same dates)
    let breakdown = '';
    let totalPrice = 0;

    for (const roomId of booking.rooms || []) {
      const room = settings.rooms.find((r) => r.id === roomId);
      const roomType = room?.type || 'small';
      const roomBeds = room?.beds || '?';
      const roomPriceConfig = priceConfig?.[roomType];

      if (!roomPriceConfig) {
        continue;
      }

      // NEW MODEL 2025-11-10: Only 'empty' field (room-size based pricing)
      const emptyRoomPrice = roomPriceConfig.empty || 0;
      const basePrice = emptyRoomPrice * nights;

      breakdown += `Pokoj ${roomId} (${roomBeds} lůžka)\n`;
      breakdown += `  Základní cena: ${emptyRoomPrice} Kč/noc × ${nights} nocí = ${basePrice} Kč\n\n`;
      totalPrice += basePrice;
    }

    // Add guests surcharge (distributed across rooms)
    if (booking.adults > 0 || booking.children > 0) {
      // Calculate average price config
      const avgAdult =
        booking.rooms.reduce((sum, roomId) => {
          const room = settings.rooms.find((r) => r.id === roomId);
          const roomType = room?.type || 'small';
          return sum + (priceConfig?.[roomType]?.adult || 0);
        }, 0) / booking.rooms.length;

      const avgChild =
        booking.rooms.reduce((sum, roomId) => {
          const room = settings.rooms.find((r) => r.id === roomId);
          const roomType = room?.type || 'small';
          return sum + (priceConfig?.[roomType]?.child || 0);
        }, 0) / booking.rooms.length;

      breakdown += 'Hosté (napříč všemi pokoji)\n';

      if (booking.adults > 0) {
        const adultsPrice = booking.adults * Math.round(avgAdult) * nights;
        breakdown += `  Dospělí: ${booking.adults} × ${Math.round(avgAdult)} Kč/noc × ${nights} nocí = ${adultsPrice} Kč\n`;
        totalPrice += adultsPrice;
      }

      if (booking.children > 0) {
        const childrenPrice = booking.children * Math.round(avgChild) * nights;
        breakdown += `  Děti: ${booking.children} × ${Math.round(avgChild)} Kč/noc × ${nights} nocí = ${childrenPrice} Kč\n`;
        totalPrice += childrenPrice;
      }

      breakdown += '\n';
    }

    // CRITICAL FIX: Use booking.totalPrice from database, not recalculated value
    // The recalculated value might differ due to rounding or pricing model changes
    const finalPrice = booking.totalPrice || totalPrice;
    breakdown += `CELKOVÁ CENA: ${finalPrice} Kč`;
    return breakdown.trim();
  }

  /**
   * Generate current timestamp in Czech format
   * @returns {string} Formatted timestamp
   * @private
   */
  generateTimestamp() {
    return new Date().toLocaleString('cs-CZ', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Validate email format
   * @param {string} email - Email address to validate
   * @returns {boolean} True if email is valid
   * @private
   */
  isValidEmail(email) {
    if (!email || typeof email !== 'string') {
      return false;
    }
    // RFC 5322 simplified validation + max length check
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) && email.length <= 254;
  }

  /**
   * Validate and throw error if email is invalid
   * @param {string} email - Email address to validate
   * @param {string} field - Field name for error message
   * @throws {Error} If email is invalid
   * @private
   */
  validateEmailOrThrow(email, field = 'email') {
    if (!this.isValidEmail(email)) {
      throw new Error(`Invalid ${field} format: ${email}`);
    }
  }

  /**
   * Create standard mail options with common fields
   * @param {string} to - Recipient email
   * @param {string} subject - Email subject
   * @param {string} text - Email body (plain text)
   * @param {Object} extraOptions - Additional options (replyTo, html, etc.)
   * @returns {Object} Mail options for nodemailer
   * @private
   */
  createMailOptions(to, subject, text, extraOptions = {}) {
    return {
      from: this.config.from,
      to,
      subject,
      text,
      encoding: 'utf-8',
      ...extraOptions,
    };
  }

  /**
   * Send email with unified error handling and logging
   * @param {Object} mailOptions - nodemailer mail options
   * @param {Object} logContext - Logging context (bookingId, etc.)
   * @returns {Promise<Object>} Email sending result
   *   - {boolean} success - True if email sent successfully
   *   - {string} [messageId] - SMTP message ID (on success)
   *   - {Array} [accepted] - Accepted recipients (on success)
   *   - {Array} [rejected] - Rejected recipients (on success)
   * @throws {Error} If email sending fails
   * @private
   */
  async sendEmail(mailOptions, logContext = {}) {
    try {
      logger.info(`Sending email: ${logContext.type || 'unknown'}`, {
        to: mailOptions.to,
        from: mailOptions.from,
        ...logContext,
      });

      const info = await this.transporter.sendMail(mailOptions);

      logger.info(`Email sent successfully: ${logContext.type || 'unknown'}`, {
        messageId: info.messageId,
        accepted: info.accepted,
        ...logContext,
      });

      return {
        success: true,
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
      };
    } catch (error) {
      logger.error(`Failed to send email: ${logContext.type || 'unknown'}`, {
        error: error.message,
        stack: error.stack,
        ...logContext,
      });

      // Throw error instead of returning { success: false }
      // This forces calling code to explicitly handle email failures
      throw new Error(`Email delivery failed: ${error.message}`);
    }
  }

  /**
   * Send email with retry on failure (1 retry after 1 minute)
   * @param {Object} mailOptions - nodemailer mail options
   * @param {Object} logContext - Logging context (bookingId, etc.)
   * @returns {Promise<Object>} Email sending result
   * @throws {Error} If email sending fails after retry
   * @private
   */
  async sendEmailWithRetry(mailOptions, logContext = {}) {
    try {
      // First attempt
      return await this.sendEmail(mailOptions, logContext);
    } catch (firstError) {
      // First attempt failed - log and schedule retry
      logger.warn(`Email sending failed, retrying in 1 minute: ${logContext.type || 'unknown'}`, {
        to: mailOptions.to,
        error: firstError.message,
        ...logContext,
      });

      // Wait 1 minute (60000ms)
      await new Promise((resolve) => {
        setTimeout(resolve, 60000);
      });

      // Retry attempt
      try {
        logger.info(`Retrying email send (2nd attempt): ${logContext.type || 'unknown'}`, {
          to: mailOptions.to,
          ...logContext,
        });

        return await this.sendEmail(mailOptions, { ...logContext, retryAttempt: 2 });
      } catch (retryError) {
        // Both attempts failed
        logger.error(`Email sending failed after retry: ${logContext.type || 'unknown'}`, {
          to: mailOptions.to,
          firstError: firstError.message,
          retryError: retryError.message,
          ...logContext,
        });

        // Throw with both error messages
        throw new Error(
          `Email delivery failed after retry. First: ${firstError.message}, Retry: ${retryError.message}`
        );
      }
    }
  }

  /**
   * Generate HTML email template for booking confirmation
   * @param {Object} booking - Booking data
   * @param {string} editUrl - URL for editing the booking
   * @param {Object} settings - System settings
   * @returns {string} HTML email content
   */
  generateBookingConfirmationHtml(booking, editUrl, settings = {}) {
    const details = this.formatBookingDetails(booking, settings);

    // Generate price breakdown
    const priceBreakdown = this.generatePriceBreakdown(booking, settings);
    const perRoomPriceHtml = priceBreakdown
      ? `<div class="d" style="margin-bottom:10px"><p><b>Rozpis ceny:</b></p><pre style="margin:0;font-family:monospace;font-size:12px;white-space:pre-wrap">${priceBreakdown}</pre></div>`
      : '';

    // Simplified HTML for SMTP size limit (hermes.utia.cas.cz has ~1KB limit)
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px}
.h{background:#2d5016;color:#fff;padding:15px;text-align:center;margin-bottom:20px}
.d{background:#f9f9f9;padding:15px;margin:15px 0;border-left:4px solid #2d5016}
.p{background:#2d5016;color:#fff;padding:12px;text-align:center;font-size:18px;font-weight:bold;margin:15px 0}
.e{background:#fff3cd;padding:15px;margin:15px 0;text-align:center}
.b{display:inline-block;padding:10px 20px;background:#2d5016;color:#fff!important;text-decoration:none;border-radius:4px}
.f{color:#777;font-size:12px;margin-top:20px;border-top:1px solid #eee;padding-top:15px}
</style></head><body>
<div class="h"><h2>Chata Mariánská - Potvrzení rezervace</h2></div>
<p>Dobrý den <b>${details.name}</b>,</p>
<p>Děkujeme za Vaši rezervaci!</p>
<div class="d">
<p><b>Rezervace ${booking.id}</b></p>
<p>Příjezd: ${details.startDateFormatted} (${details.startDate})<br>
Odjezd: ${details.endDateFormatted} (${details.endDate})<br>
Nocí: ${details.nights} | Pokoje: ${details.roomList}<br>
Typ: ${details.guestTypeText}<br>
Osob: ${details.adults} dospělých, ${details.children} dětí${details.notes ? `<br>Poznámka: ${details.notes}` : ''}</p>
</div>
${perRoomPriceHtml}
<div class="p">Celková cena: ${details.priceFormatted}</div>
<div class="e">
<p><b>Editace nebo zrušení rezervace:</b></p>
<a href="${editUrl}" class="b">Upravit rezervaci</a>
<p style="font-size:11px;margin-top:10px;word-break:break-all">${editUrl}</p>
<p><b>Důležité:</b> Uschovejte si tento odkaz!</p>
</div>
<div class="f">
<p>Kontakt: ${details.contactEmail} | ${this.config.appUrl}<br>
---<br>Automatická zpráva</p>
</div>
</body></html>`.trim();
  }

  /**
   * Substitute variables in email template
   * @param {string} template - Email template with variables
   * @param {Object} booking - Booking data
   * @param {string} editUrl - URL for editing the booking
   * @param {Object} settings - System settings (for price breakdown)
   * @returns {string} Email content with substituted variables
   */
  substituteVariables(template, booking, editUrl, settings = {}) {
    // Parse date strings to Date objects for formatting
    const startDate = DateUtils.parseDate(booking.startDate);
    const endDate = DateUtils.parseDate(booking.endDate);

    const startDateFormatted = DateUtils.formatDateDisplay(startDate, 'cs');
    const endDateFormatted = DateUtils.formatDateDisplay(endDate, 'cs');
    const nights = DateUtils.getDaysBetween(booking.startDate, booking.endDate);
    const roomList = this.formatRoomList(booking.rooms);
    const priceFormatted = this.formatPrice(booking.totalPrice);
    const priceBreakdown = this.generatePriceBreakdown(booking, settings);

    // Variable mapping
    const variables = {
      '{booking_id}': booking.id,
      '{name}': booking.name,
      '{start_date}': `${startDateFormatted} (${booking.startDate})`,
      '{end_date}': `${endDateFormatted} (${booking.endDate})`,
      '{rooms}': roomList,
      '{total_price}': priceFormatted,
      '{price_overview}': priceBreakdown,
      '{adults}': booking.adults,
      '{children}': booking.children || 0,
      '{toddlers}': booking.toddlers || 0,
      '{nights}': nights,
      '{edit_url}': editUrl,
    };

    // Substitute all variables
    let result = template;
    for (const [variable, value] of Object.entries(variables)) {
      // Escape special regex characters in variable name
      const escapedVariable = variable.replace(/[{}]/gu, '\\$&');
      result = result.replace(new RegExp(escapedVariable, 'gu'), value);
    }

    return result;
  }

  /**
   * Send notification copies to admin emails
   * @param {Object} booking - Booking data
   * @param {string} subject - Email subject
   * @param {string} textContent - Email body
   * @param {Object} settings - System settings (contains adminEmails array)
   * @returns {Promise<Array>} Array of send results
   * @private
   */
  async sendAdminNotifications(booking, subject, textContent, settings = {}) {
    const adminEmails = settings.adminEmails || [];

    // Filter out invalid emails and duplicates
    const validAdminEmails = [...new Set(adminEmails.filter((email) => this.isValidEmail(email)))];

    if (validAdminEmails.length === 0) {
      logger.info('No admin emails configured, skipping admin notifications', {
        bookingId: booking.id,
      });
      return [];
    }

    logger.info('Sending admin notifications', {
      bookingId: booking.id,
      adminCount: validAdminEmails.length,
    });

    // Send to all admins in parallel
    const sendPromises = validAdminEmails.map(async (adminEmail) => {
      try {
        const adminMailOptions = this.createMailOptions(adminEmail, subject, textContent);

        const result = await this.sendEmail(adminMailOptions, {
          type: 'admin_notification',
          bookingId: booking.id,
          adminEmail,
        });

        return { email: adminEmail, success: true, ...result };
      } catch (error) {
        logger.error('Failed to send admin notification', {
          adminEmail,
          bookingId: booking.id,
          error: error.message,
          smtpCode: error.responseCode || 'unknown',
          stack: error.stack,
        });
        return { email: adminEmail, success: false, error: error.message, smtpCode: error.responseCode };
      }
    });

    // Use allSettled to ensure all promises complete even if some fail
    const settledResults = await Promise.allSettled(sendPromises);
    return settledResults.map((r) =>
      r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message || 'Unknown error' }
    );
  }

  /**
   * Generate plain text email template for booking confirmation
   * @param {Object} booking - Booking data
   * @param {string} editUrl - URL for editing the booking
   * @param {Object} settings - System settings
   * @returns {string} Plain text email content
   */
  generateBookingConfirmationText(booking, editUrl, settings = {}) {
    // Check if custom template exists in settings
    if (settings.emailTemplate && settings.emailTemplate.template) {
      // Use custom template with variable substitution
      let emailContent = this.substituteVariables(
        settings.emailTemplate.template,
        booking,
        editUrl,
        settings
      );

      // Auto-append edit link if not already in template
      if (!emailContent.includes('{edit_url}') && !emailContent.includes(editUrl)) {
        emailContent += `\n\nEDITACE/ZRUŠENÍ REZERVACE:\n${editUrl}`;
      }

      return emailContent;
    }

    // Fallback to default template
    const details = this.formatBookingDetails(booking, settings);
    const priceBreakdown = this.generatePriceBreakdown(booking, settings);

    return `CHATA MARIÁNSKÁ - Potvrzení rezervace ${booking.id}

Dobrý den ${details.name},

Děkujeme za Vaši rezervaci v Chatě Mariánská!

DETAIL REZERVACE:
Příjezd: ${details.startDateFormatted} (${details.startDate})
Odjezd: ${details.endDateFormatted} (${details.endDate})
Nocí: ${details.nights} | Pokoje: ${details.roomList}
Typ: ${details.guestTypeText}
Osob: ${details.adults} dospělých, ${details.children} dětí${details.notes ? `\nPoznámka: ${details.notes}` : ''}

ROZPIS CENY:
${priceBreakdown}

EDITACE/ZRUŠENÍ REZERVACE:
${editUrl}

DŮLEŽITÉ: Uschovejte si tento email a odkaz výše pro případné úpravy.

Kontakt: ${details.contactEmail} | ${this.config.appUrl}

---
Automatická zpráva - neodpovídejte
    `.trim();
  }

  /**
   * Send booking confirmation email
   * @param {Object} booking - Booking data
   * @param {Object} options - Additional options
   * @param {Object} [options.settings] - System settings (includes adminEmails)
   * @returns {Promise<Object>} Email sending result
   *   - {boolean} success - True if email sent successfully
   *   - {string} [messageId] - SMTP message ID (on success)
   * @throws {Error} If email validation fails or sending fails
   */
  async sendBookingConfirmation(booking, options = {}) {
    // Validate input data
    if (!booking || !booking.email || !booking.editToken) {
      throw new Error('Invalid booking data: missing email or editToken');
    }

    this.validateEmailOrThrow(booking.email);

    const editUrl = `${this.config.appUrl}/edit.html?token=${booking.editToken}`;
    const textContent = this.generateBookingConfirmationText(booking, editUrl, options.settings);
    const emailSubject =
      options.settings?.emailTemplate?.subject ||
      `Potvrzení rezervace - Chata Mariánská (${booking.id})`;

    const mailOptions = this.createMailOptions(booking.email, emailSubject, textContent);

    // Send to booking owner
    const result = await this.sendEmailWithRetry(mailOptions, {
      type: 'booking_confirmation',
      bookingId: booking.id,
    });

    // Send copies to admin emails (non-blocking)
    this.sendAdminNotifications(booking, emailSubject, textContent, options.settings).catch(
      (error) => {
        logger.warn('Failed to send admin notification for booking confirmation', {
          bookingId: booking.id,
          error: error.message,
        });
      }
    );

    return result;
  }

  /**
   * Send test email to verify configuration
   * @param {string} recipientEmail - Test recipient email
   * @returns {Promise<Object>} Test result
   * @throws {Error} If email validation fails or sending fails
   */
  sendTestEmail(recipientEmail) {
    this.validateEmailOrThrow(recipientEmail);

    const mailOptions = this.createMailOptions(
      recipientEmail,
      'Test Email - Chata Mariánská Booking System',
      'This is a test email from the Chata Mariánská booking system. If you receive this, the email configuration is working correctly.',
      {
        html: '<p>This is a test email from the <strong>Chata Mariánská</strong> booking system.</p><p>If you receive this, the email configuration is working correctly.</p>',
      }
    );

    return this.sendEmailWithRetry(mailOptions, { type: 'test_email' });
  }

  /**
   * Send contact message email from booking owner
   * @param {Object} contactData - Contact form data
   * @param {string} contactData.senderName - Name of the sender
   * @param {string} contactData.senderEmail - Email of the sender
   * @param {string} contactData.message - Message content (max 500 chars)
   * @param {string} [contactData.bookingId] - Optional booking reference
   * @param {Object} options - Additional options
   * @param {Object} [options.settings] - System settings (for contact email)
   * @returns {Promise<Object>} Email sending result
   * @throws {Error} If validation fails or sending fails
   */
  sendContactMessage(contactData, options = {}) {
    if (!contactData || !contactData.senderEmail || !contactData.message) {
      throw new Error('Invalid contact data: missing required fields (senderEmail, message)');
    }

    this.validateEmailOrThrow(contactData.senderEmail, 'sender email');

    const contactEmail = options.settings?.contactEmail || 'chata@utia.cas.cz';
    const textContent = this.generateContactMessageText(contactData);
    const subject = contactData.bookingId
      ? `Dotaz k rezervaci ${contactData.bookingId}`
      : `Kontakt z webu - ${contactData.senderName || 'Host'}`;

    const mailOptions = this.createMailOptions(contactEmail, subject, textContent, {
      replyTo: contactData.senderEmail,
    });

    return this.sendEmailWithRetry(mailOptions, {
      type: 'contact_message',
      from: contactData.senderEmail,
      bookingId: contactData.bookingId,
    });
  }

  /**
   * Generate plain text template for contact message
   * @param {Object} contactData - Contact form data
   * @returns {string} Plain text email content
   */
  generateContactMessageText(contactData) {
    const bookingRef = contactData.bookingId ? `\nČíslo rezervace: ${contactData.bookingId}` : '';
    const timestamp = this.generateTimestamp();

    return `CHATA MARIÁNSKÁ - Zpráva od hosta

Odesílatel: ${contactData.senderName || 'Neuvedeno'}
Email: ${contactData.senderEmail}${bookingRef}

ZPRÁVA:
${contactData.message}

---
Odesláno z: ${this.config.appUrl}
Čas odeslání: ${timestamp}
Pro odpověď použijte Reply nebo přímo email: ${contactData.senderEmail}
    `.trim();
  }

  /**
   * Send custom email from admin to booking owner
   * @param {Object} emailData - Email data
   * @param {string} emailData.bookingId - Booking ID
   * @param {string} emailData.bookingOwnerEmail - Booking owner's email
   * @param {string} emailData.bookingOwnerName - Booking owner's name
   * @param {string} emailData.senderEmail - Admin's email address
   * @param {string} emailData.subject - Email subject
   * @param {string} emailData.message - Message content
   * @returns {Promise<Object>} Email sending result
   * @throws {Error} If validation fails or sending fails
   */
  sendCustomEmailToBooker(emailData) {
    if (!emailData || !emailData.bookingOwnerEmail || !emailData.message) {
      throw new Error('Invalid email data: missing required fields (bookingOwnerEmail, message)');
    }

    this.validateEmailOrThrow(emailData.bookingOwnerEmail, 'booking owner email');

    const textContent = this.generateCustomEmailToBookerText(emailData);
    const subject = emailData.subject || 'Zpráva ohledně Vaší rezervace - Chata Mariánská';

    const mailOptions = this.createMailOptions(emailData.bookingOwnerEmail, subject, textContent, {
      replyTo: emailData.senderEmail || this.config.from,
    });

    return this.sendEmailWithRetry(mailOptions, {
      type: 'custom_email_to_booker',
      bookingId: emailData.bookingId,
    });
  }

  /**
   * Generate plain text template for custom email to booker
   * @param {Object} emailData - Email data
   * @returns {string} Plain text email content
   */
  generateCustomEmailToBookerText(emailData) {
    const timestamp = this.generateTimestamp();

    return `CHATA MARIÁNSKÁ - Zpráva ohledně Vaší rezervace

Píše Vám uživatel: ${emailData.senderEmail || 'neuvedeno'}

Dobrý den ${emailData.bookingOwnerName || ''},

${emailData.message}

---
Rezervace: ${emailData.bookingId || 'neuvedeno'}
Odesláno: ${timestamp}
Web: ${this.config.appUrl}
    `.trim();
  }

  /**
   * Generate plain text template for booking modification notification
   * @param {Object} booking - Updated booking data
   * @param {Object} changes - Object describing what changed
   * @param {Object} settings - System settings
   * @param {boolean} modifiedByAdmin - Whether change was made by admin
   * @returns {string} Plain text email content
   */
  generateBookingModificationText(booking, changes, settings = {}, modifiedByAdmin = false) {
    const details = this.formatBookingDetails(booking, settings);
    const editUrl = `${this.config.appUrl}/edit.html?token=${booking.editToken}`;

    // Build change summary
    let changeSummary = '';
    if (changes.dates) {
      changeSummary += '\n- Změna termínu rezervace';
    }
    if (changes.guests) {
      changeSummary += '\n- Změna počtu hostů';
    }
    if (changes.rooms) {
      changeSummary += '\n- Změna vybraných pokojů';
    }
    if (changes.status) {
      changeSummary += `\n- Změna stavu: ${changes.status}`;
    }
    if (changes.payment) {
      const paymentStatus = booking.paid ? 'ZAPLACENO ✓' : 'NEZAPLACENO';
      changeSummary += `\n- Platba: ${paymentStatus}`;
    }
    if (changes.paymentMethod) {
      const paymentMethod = booking.payFromBenefit ? 'Z benefitů' : 'Standardní';
      changeSummary += `\n- Způsob platby: ${paymentMethod}`;
    }
    if (changes.notes) {
      changeSummary += '\n- Aktualizace poznámky';
    }
    if (changes.other) {
      changeSummary += '\n- Další změny v údajích';
    }

    const modifiedByText = modifiedByAdmin
      ? '\n⚠️ Tato rezervace byla změněna administrátorem systému.'
      : '';

    return `CHATA MARIÁNSKÁ - Změna rezervace ${booking.id}

Dobrý den ${details.name},

Vaše rezervace byla aktualizována.${modifiedByText}

PROVEDENÉ ZMĚNY:${changeSummary}

AKTUÁLNÍ STAV REZERVACE:
Příjezd: ${details.startDateFormatted} (${details.startDate})
Odjezd: ${details.endDateFormatted} (${details.endDate})
Nocí: ${details.nights} | Pokoje: ${details.roomList}
Typ: ${details.guestTypeText}
Osob: ${details.adults} dospělých, ${details.children} dětí
Cena: ${details.priceFormatted}${details.notes ? `\nPoznámka: ${details.notes}` : ''}

EDITACE/ZRUŠENÍ REZERVACE:
${editUrl}

DŮLEŽITÉ: Uschovejte si tento email a odkaz výše pro případné další úpravy.

Kontakt: ${details.contactEmail} | ${this.config.appUrl}

---
Automatická zpráva - neodpovídejte
    `.trim();
  }

  /**
   * Send booking modification notification email
   * @param {Object} booking - Updated booking data
   * @param {Object} changes - Object describing what changed
   * @param {Object} options - Additional options
   * @param {boolean} options.modifiedByAdmin - Whether change was made by admin
   * @param {Object} [options.settings] - System settings (includes adminEmails)
   * @returns {Promise<Object>} Email sending result
   * @throws {Error} If validation fails or sending fails
   */
  async sendBookingModification(booking, changes, options = {}) {
    if (!booking || !booking.email || !booking.editToken) {
      throw new Error('Invalid booking data: missing email or editToken');
    }

    this.validateEmailOrThrow(booking.email);

    if (!changes || Object.keys(changes).length === 0) {
      throw new Error('No changes specified for modification email');
    }

    const textContent = this.generateBookingModificationText(
      booking,
      changes,
      options.settings,
      options.modifiedByAdmin || false
    );
    const emailSubject = `Změna rezervace - Chata Mariánská (${booking.id})`;

    const mailOptions = this.createMailOptions(booking.email, emailSubject, textContent);

    // Send to booking owner
    const result = await this.sendEmailWithRetry(mailOptions, {
      type: 'booking_modification',
      bookingId: booking.id,
      modifiedByAdmin: options.modifiedByAdmin || false,
      changes: Object.keys(changes),
    });

    // Send copies to admin emails (non-blocking)
    this.sendAdminNotifications(booking, emailSubject, textContent, options.settings).catch(
      (error) => {
        logger.warn('Failed to send admin notification for booking modification', {
          bookingId: booking.id,
          error: error.message,
        });
      }
    );

    return result;
  }

  /**
   * Generate plain text template for booking deletion notification
   * @param {Object} booking - Deleted booking data
   * @param {Object} settings - System settings
   * @param {boolean} deletedByAdmin - Whether deletion was performed by admin
   * @returns {string} Plain text email content
   */
  generateBookingDeletionText(booking, settings = {}, deletedByAdmin = false) {
    const details = this.formatBookingDetails(booking, settings);

    const deletedByText = deletedByAdmin
      ? '\n⚠️ Tato rezervace byla zrušena administrátorem systému.'
      : '\nVaše rezervace byla úspěšně zrušena na Vaši žádost.';

    const timestamp = this.generateTimestamp();

    return `CHATA MARIÁNSKÁ - Zrušení rezervace ${booking.id}

Dobrý den ${details.name},
${deletedByText}

ZRUŠENÁ REZERVACE:
Příjezd: ${details.startDateFormatted} (${details.startDate})
Odjezd: ${details.endDateFormatted} (${details.endDate})
Nocí: ${details.nights} | Pokoje: ${details.roomList}
Typ: ${details.guestTypeText}
Osob: ${details.adults} dospělých, ${details.children} dětí
Cena: ${details.priceFormatted}${details.notes ? `\nPoznámka: ${details.notes}` : ''}

Čas zrušení: ${timestamp}

Pokud máte jakékoliv dotazy, neváhejte nás kontaktovat.

Kontakt: ${details.contactEmail} | ${this.config.appUrl}

---
Automatická zpráva - neodpovídejte
    `.trim();
  }

  /**
   * Send booking deletion notification email
   * @param {Object} booking - Deleted booking data
   * @param {Object} options - Additional options
   * @param {boolean} options.deletedByAdmin - Whether deletion was performed by admin
   * @param {Object} [options.settings] - System settings (includes adminEmails)
   * @returns {Promise<Object>} Email sending result
   * @throws {Error} If validation fails or sending fails
   */
  async sendBookingDeletion(booking, options = {}) {
    if (!booking || !booking.email) {
      throw new Error('Invalid booking data: missing email');
    }

    this.validateEmailOrThrow(booking.email);

    const textContent = this.generateBookingDeletionText(
      booking,
      options.settings,
      options.deletedByAdmin || false
    );
    const emailSubject = `Zrušení rezervace - Chata Mariánská (${booking.id})`;

    const mailOptions = this.createMailOptions(booking.email, emailSubject, textContent);

    // Send to booking owner
    const result = await this.sendEmailWithRetry(mailOptions, {
      type: 'booking_deletion',
      bookingId: booking.id,
      deletedByAdmin: options.deletedByAdmin || false,
    });

    // Send copies to admin emails (non-blocking)
    this.sendAdminNotifications(booking, emailSubject, textContent, options.settings).catch(
      (error) => {
        logger.warn('Failed to send admin notification for booking deletion', {
          bookingId: booking.id,
          error: error.message,
        });
      }
    );

    return result;
  }

  /**
   * Send booking notifications to appropriate recipients based on change type
   * Centralized method that determines who should receive notifications
   *
   * @param {Object} booking - Booking object
   * @param {Object} changes - Object describing what changed
   * @param {Object} settings - System settings (includes adminEmails, cabinManagerEmails)
   * @param {string} eventType - 'created', 'updated', 'deleted'
   * @returns {Promise<Object>} Result with success status and details
   */
  async sendBookingNotifications(booking, changes, settings, eventType = 'updated') {
    const adminEmails = settings.adminEmails || [];
    const cabinManagerEmails = settings.cabinManagerEmails || [];

    if (adminEmails.length === 0 && cabinManagerEmails.length === 0) {
      logger.info('No notification recipients configured', {
        bookingId: booking.id,
      });
      return { success: true, skipped: true, reason: 'no_recipients' };
    }

    // Determine who should receive this notification
    const notificationScope = this._determineNotificationScope(booking, changes, eventType);

    logger.info('Sending booking notifications', {
      bookingId: booking.id,
      eventType,
      scope: notificationScope,
    });

    // Generate email subject based on event type
    const subject = this._generateNotificationSubject(booking, eventType, changes);

    // Generate email content (reuse existing templates)
    const textContent = this._generateNotificationText(booking, changes, eventType, settings);

    const results = [];

    // ALWAYS send to admins (all events)
    if (adminEmails.length > 0) {
      try {
        const adminResult = await this.sendAdminNotifications(
          booking,
          subject,
          textContent,
          settings
        );
        results.push({
          recipientType: 'admins',
          success: true,
          count: adminEmails.length,
          results: adminResult,
        });
      } catch (error) {
        logger.error('Failed to send admin notifications', {
          bookingId: booking.id,
          error: error.message,
        });
        results.push({
          recipientType: 'admins',
          success: false,
          error: error.message,
        });
      }
    }

    // CONDITIONALLY send to cabin managers
    if (cabinManagerEmails.length > 0 && notificationScope.sendToCabinManagers) {
      try {
        const managerResult = await this.sendCabinManagerNotifications(
          booking,
          changes,
          subject,
          textContent,
          settings,
          notificationScope.reason
        );
        results.push({
          recipientType: 'cabin_managers',
          success: managerResult.success,
          count: cabinManagerEmails.length,
          results: managerResult.results,
        });
      } catch (error) {
        logger.error('Failed to send cabin manager notifications', {
          bookingId: booking.id,
          error: error.message,
        });
        results.push({
          recipientType: 'cabin_managers',
          success: false,
          error: error.message,
        });
      }
    }

    const allSuccess = results.every((r) => r.success);
    return {
      success: allSuccess,
      notificationScope,
      results,
    };
  }

  /**
   * Determine who should receive this notification
   *
   * @private
   * @param {Object} booking - Booking object
   * @param {Object} changes - Changes object
   * @param {string} eventType - Event type
   * @returns {Object} Scope object with sendToAdmins, sendToCabinManagers, reason
   */
  _determineNotificationScope(booking, changes, eventType) {
    // Cabin managers get emails for:
    // 1. Payment status changes (any direction: false→true OR true→false)
    // 2. ANY modifications to already-paid bookings

    let sendToCabinManagers = false;
    let reason = 'not_relevant_for_managers';

    // Case 1: Payment status changed
    if (changes.payment) {
      sendToCabinManagers = true;
      reason = 'payment_status_changed';
    }
    // Case 2: Modifying paid booking (and payment didn't change)
    else if (booking.paid && eventType === 'updated') {
      // Check if there are any actual changes
      const hasChanges = Object.keys(changes).some((key) => changes[key] === true);
      if (hasChanges) {
        sendToCabinManagers = true;
        reason = 'paid_booking_modified';
      }
    }

    return {
      sendToAdmins: true, // Always send to admins
      sendToCabinManagers,
      reason,
    };
  }

  /**
   * Generate notification subject based on event type
   *
   * @private
   */
  _generateNotificationSubject(booking, eventType, changes) {
    if (eventType === 'created') {
      return `Nová rezervace - Chata Mariánská (${booking.id})`;
    } else if (eventType === 'deleted') {
      return `Zrušení rezervace - Chata Mariánská (${booking.id})`;
    }
    // Updated - add context if payment changed
    if (changes.payment) {
      return `Změna platby - Chata Mariánská (${booking.id})`;
    }
    return `Změna rezervace - Chata Mariánská (${booking.id})`;
  }

  /**
   * Generate notification text content
   * Reuses existing template generation methods
   *
   * @private
   */
  _generateNotificationText(booking, changes, eventType, settings) {
    if (eventType === 'created') {
      const editUrl = `${this.config.appUrl}/edit.html?token=${booking.editToken}`;
      return this.generateBookingConfirmationText(booking, editUrl, settings);
    } else if (eventType === 'deleted') {
      return this.generateBookingDeletionText(booking, settings, false);
    }
    // Updated
    return this.generateBookingModificationText(booking, changes, settings, false);
  }

  /**
   * Send notifications to cabin managers with special formatting
   *
   * @param {Object} booking - Booking object
   * @param {Object} changes - Changes object
   * @param {string} subject - Email subject
   * @param {string} baseTextContent - Base text content
   * @param {Object} settings - Settings object
   * @param {string} reason - Reason for notification
   * @returns {Promise<Object>} Result object
   */
  async sendCabinManagerNotifications(
    booking,
    changes,
    subject,
    baseTextContent,
    settings,
    reason
  ) {
    const cabinManagerEmails = settings.cabinManagerEmails || [];

    // Filter out invalid emails and duplicates
    const validEmails = [
      ...new Set(cabinManagerEmails.filter((email) => this.isValidEmail(email))),
    ];

    if (validEmails.length === 0) {
      logger.info('No valid cabin manager emails configured', {
        bookingId: booking.id,
      });
      return { success: true, skipped: true, results: [] };
    }

    // Add warning header for cabin managers
    const warningHeader = this._generateCabinManagerWarning(reason, changes, booking);
    const enhancedTextContent = `${warningHeader}\n\n${baseTextContent}`;

    // Modify subject to distinguish in inbox
    const enhancedSubject = `[Správce chaty] ${subject}`;

    logger.info('Sending cabin manager notifications', {
      bookingId: booking.id,
      reason,
      managerCount: validEmails.length,
    });

    // Send to all cabin managers in parallel
    const sendPromises = validEmails.map(async (email) => {
      try {
        const mailOptions = this.createMailOptions(email, enhancedSubject, enhancedTextContent);

        const result = await this.sendEmail(mailOptions, {
          type: 'cabin_manager_notification',
          bookingId: booking.id,
          cabinManagerEmail: email,
          reason,
        });

        return { email, success: true, ...result };
      } catch (error) {
        logger.error('Failed to send cabin manager notification', {
          email,
          bookingId: booking.id,
          error: error.message,
          smtpCode: error.responseCode || 'unknown',
          stack: error.stack,
        });
        return { email, success: false, error: error.message, smtpCode: error.responseCode };
      }
    });

    // Use allSettled to ensure all promises complete even if some fail
    const settledResults = await Promise.allSettled(sendPromises);
    const results = settledResults.map((r) =>
      r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message || 'Unknown error' }
    );

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;
    const allSuccess = successCount === validEmails.length;
    const partialSuccess = successCount > 0 && failureCount > 0;

    return {
      success: allSuccess,
      partialSuccess,
      successCount,
      failureCount,
      results,
    };
  }

  /**
   * Generate warning header for cabin manager emails
   *
   * @private
   */
  _generateCabinManagerWarning(reason, changes, booking) {
    if (reason === 'payment_status_changed') {
      const oldPaid = changes.payment ? !booking.paid : booking.paid;
      const newPaid = booking.paid;

      if (newPaid) {
        return `⚠️ DŮLEŽITÉ: Rezervace byla označena jako ZAPLACENÁ
═══════════════════════════════════════════════════

Platební stav změněn: NEZAPLACENO → ZAPLACENO`;
      }
      return `⚠️ DŮLEŽITÉ: Platba rezervace byla ZRUŠENA
═══════════════════════════════════════════════════

Platební stav změněn: ZAPLACENO → NEZAPLACENO`;
    } else if (reason === 'paid_booking_modified') {
      const changesList = Object.keys(changes)
        .filter((key) => changes[key] === true)
        .map((key) => {
          const labels = {
            dates: 'Termín pobytu',
            rooms: 'Pokoje',
            guests: 'Počet hostů',
            notes: 'Poznámky',
            guestNames: 'Jména hostů',
            other: 'Kontaktní/fakturační údaje',
          };
          return labels[key] || key;
        })
        .join(', ');

      return `⚠️ UPOZORNĚNÍ: Změna v již ZAPLACENÉ rezervaci
═══════════════════════════════════════════════════

Změněné údaje: ${changesList}

Doporučujeme zkontrolovat, zda změny odpovídají zaplacené částce.`;
    }

    return '';
  }
}

module.exports = EmailService;

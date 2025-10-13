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
   * Generate HTML email template for booking confirmation
   * @param {Object} booking - Booking data
   * @param {string} editUrl - URL for editing the booking
   * @param {Object} _settings - System settings (reserved for future custom templates)
   * @returns {string} HTML email content
   */
  // eslint-disable-next-line no-unused-vars
  generateBookingConfirmationHtml(booking, editUrl, _settings = {}) {
    // Parse date strings to Date objects for formatting
    const startDate = DateUtils.parseDate(booking.startDate);
    const endDate = DateUtils.parseDate(booking.endDate);

    const startDateFormatted = DateUtils.formatDateDisplay(startDate, 'cs');
    const endDateFormatted = DateUtils.formatDateDisplay(endDate, 'cs');
    const nights = DateUtils.getDaysBetween(booking.startDate, booking.endDate);
    const roomList = this.formatRoomList(booking.rooms);
    const priceFormatted = this.formatPrice(booking.totalPrice);
    const guestTypeText = booking.guestType === 'utia' ? 'Zaměstnanec ÚTIA' : 'Externí host';

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
<p>Dobrý den <b>${booking.name}</b>,</p>
<p>Děkujeme za Vaši rezervaci!</p>
<div class="d">
<p><b>Rezervace ${booking.id}</b></p>
<p>Příjezd: ${startDateFormatted} (${booking.startDate})<br>
Odjezd: ${endDateFormatted} (${booking.endDate})<br>
Nocí: ${nights} | Pokoje: ${roomList}<br>
Typ: ${guestTypeText}<br>
Osob: ${booking.adults} dospělých, ${booking.children || 0} dětí${booking.notes ? `<br>Poznámka: ${booking.notes}` : ''}</p>
</div>
<div class="p">Cena: ${priceFormatted}</div>
<div class="e">
<p><b>Editace nebo zrušení rezervace:</b></p>
<a href="${editUrl}" class="b">Upravit rezervaci</a>
<p style="font-size:11px;margin-top:10px;word-break:break-all">${editUrl}</p>
<p><b>Důležité:</b> Uschovejte si tento odkaz!</p>
</div>
<div class="f">
<p>Kontakt: chata@utia.cas.cz | ${this.config.appUrl}<br>
---<br>Automatická zpráva</p>
</div>
</body></html>`.trim();
  }

  /**
   * Substitute variables in email template
   * @param {string} template - Email template with variables
   * @param {Object} booking - Booking data
   * @param {string} editUrl - URL for editing the booking
   * @returns {string} Email content with substituted variables
   */
  substituteVariables(template, booking, editUrl) {
    // Parse date strings to Date objects for formatting
    const startDate = DateUtils.parseDate(booking.startDate);
    const endDate = DateUtils.parseDate(booking.endDate);

    const startDateFormatted = DateUtils.formatDateDisplay(startDate, 'cs');
    const endDateFormatted = DateUtils.formatDateDisplay(endDate, 'cs');
    const nights = DateUtils.getDaysBetween(booking.startDate, booking.endDate);
    const roomList = this.formatRoomList(booking.rooms);
    const priceFormatted = this.formatPrice(booking.totalPrice);

    // Variable mapping
    const variables = {
      '{booking_id}': booking.id,
      '{name}': booking.name,
      '{start_date}': `${startDateFormatted} (${booking.startDate})`,
      '{end_date}': `${endDateFormatted} (${booking.endDate})`,
      '{rooms}': roomList,
      '{total_price}': priceFormatted,
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
        editUrl
      );

      // Auto-append edit link if not already in template
      if (!emailContent.includes('{edit_url}') && !emailContent.includes(editUrl)) {
        emailContent += `\n\nEDITACE/ZRUŠENÍ REZERVACE:\n${editUrl}`;
      }

      return emailContent;
    }

    // Fallback to default template
    const startDate = DateUtils.parseDate(booking.startDate);
    const endDate = DateUtils.parseDate(booking.endDate);

    const startDateFormatted = DateUtils.formatDateDisplay(startDate, 'cs');
    const endDateFormatted = DateUtils.formatDateDisplay(endDate, 'cs');
    const nights = DateUtils.getDaysBetween(booking.startDate, booking.endDate);
    const roomList = this.formatRoomList(booking.rooms);
    const priceFormatted = this.formatPrice(booking.totalPrice);
    const guestTypeText = booking.guestType === 'utia' ? 'Zaměstnanec ÚTIA' : 'Externí host';

    return `CHATA MARIÁNSKÁ - Potvrzení rezervace ${booking.id}

Dobrý den ${booking.name},

Děkujeme za Vaši rezervaci v Chatě Mariánská!

DETAIL REZERVACE:
Příjezd: ${startDateFormatted} (${booking.startDate})
Odjezd: ${endDateFormatted} (${booking.endDate})
Nocí: ${nights} | Pokoje: ${roomList}
Typ: ${guestTypeText}
Osob: ${booking.adults} dospělých, ${booking.children || 0} dětí
Cena: ${priceFormatted}${booking.notes ? `\nPoznámka: ${booking.notes}` : ''}

EDITACE/ZRUŠENÍ REZERVACE:
${editUrl}

DŮLEŽITÉ: Uschovejte si tento email a odkaz výše pro případné úpravy.

Kontakt: chata@utia.cas.cz | ${this.config.appUrl}

---
Automatická zpráva - neodpovídejte
    `.trim();
  }

  /**
   * Send booking confirmation email
   * @param {Object} booking - Booking data
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Email sending result
   */
  async sendBookingConfirmation(booking, options = {}) {
    try {
      if (!booking || !booking.email || !booking.editToken) {
        throw new Error('Invalid booking data: missing email or editToken');
      }

      // Generate edit URL
      const editUrl = `${this.config.appUrl}/edit.html?token=${booking.editToken}`;

      // Generate email content
      // HTML version generated but not used due to SMTP size limits (see mailOptions below)
      // eslint-disable-next-line no-unused-vars
      const htmlContent = this.generateBookingConfirmationHtml(booking, editUrl, options.settings);
      const textContent = this.generateBookingConfirmationText(booking, editUrl, options.settings);

      // Get custom subject from settings or use default
      const emailSubject =
        options.settings?.emailTemplate?.subject ||
        `Potvrzení rezervace - Chata Mariánská (${booking.id})`;

      // Email options
      // NOTE: hermes.utia.cas.cz SMTP has ~1KB size limit
      // HTML version causes timeout - use plain text only
      const mailOptions = {
        from: this.config.from,
        to: booking.email,
        subject: emailSubject,
        text: textContent,
        // html: htmlContent, // DISABLED: causes timeout on hermes.utia.cas.cz
        encoding: 'utf-8',
      };

      logger.info('Sending booking confirmation email', {
        bookingId: booking.id,
        to: booking.email,
        from: this.config.from,
      });

      // Send email
      const info = await this.transporter.sendMail(mailOptions);

      logger.info('Booking confirmation email sent successfully', {
        bookingId: booking.id,
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
      });

      return {
        success: true,
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
      };
    } catch (error) {
      logger.error('Failed to send booking confirmation email:', {
        bookingId: booking?.id,
        email: booking?.email,
        error: error.message,
        stack: error.stack,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send test email to verify configuration
   * @param {string} recipientEmail - Test recipient email
   * @returns {Promise<Object>} Test result
   */
  async sendTestEmail(recipientEmail) {
    try {
      const mailOptions = {
        from: this.config.from,
        to: recipientEmail,
        subject: 'Test Email - Chata Mariánská Booking System',
        text: 'This is a test email from the Chata Mariánská booking system. If you receive this, the email configuration is working correctly.',
        html: '<p>This is a test email from the <strong>Chata Mariánská</strong> booking system.</p><p>If you receive this, the email configuration is working correctly.</p>',
      };

      const info = await this.transporter.sendMail(mailOptions);

      logger.info('Test email sent successfully', {
        to: recipientEmail,
        messageId: info.messageId,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      logger.error('Failed to send test email:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = EmailService;

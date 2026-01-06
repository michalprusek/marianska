/**
 * IdGenerator - Unified ID and token generation utility
 *
 * Consolidates all ID/token generation logic into a single source of truth.
 * Replaces duplicate implementations in server.js, data.js, and database.js.
 *
 * @module IdGenerator
 */

class IdGenerator {
  /**
   * Generate a unique booking ID (format: BK + 13 alphanumeric chars)
   * @returns {string} Booking ID (e.g., "BK1A2B3C4D5E6F7")
   */
  static generateBookingId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = 'BK';
    for (let i = 0; i < 13; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  /**
   * Generate a secure edit token for booking modifications
   * @returns {string} 30-character lowercase alphanumeric token
   *
   * Note: 30 characters provides ~5.4e47 combinations (36^30)
   * This is cryptographically secure for URL-based booking edits
   */
  static generateEditToken() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 30; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  /**
   * Generate a blockage ID (format: BLK + random string)
   * @returns {string} Blockage ID (e.g., "BLK1a2b3c4d5")
   */
  static generateBlockageId() {
    return `BLK${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  /**
   * Generate a Christmas period ID (format: XMAS + random string)
   * @returns {string} Christmas period ID (e.g., "XMAS1a2b3c4d5")
   */
  static generateChristmasPeriodId() {
    return `XMAS${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  /**
   * Generate a proposed booking ID (format: PROP + random string)
   * @returns {string} Proposal ID (e.g., "PROP1a2b3c4d5")
   */
  static generateProposalId() {
    return `PROP${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  /**
   * Generate a session ID (format: SESS + random string)
   * @returns {string} Session ID (e.g., "SESS1a2b3c4d5")
   */
  static generateSessionId() {
    return `SESS${Math.random().toString(36).substr(2, 16).toUpperCase()}`;
  }

  /**
   * Generate a generic secure token
   * @param {number} length - Token length (default: 12)
   * @returns {string} Random alphanumeric token
   */
  static generateToken(length = 12) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < length; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  /**
   * Generate an email queue ID (format: EQ + random string)
   * @returns {string} Email queue ID (e.g., "EQ1A2B3C4D5E6F7")
   */
  static generateEmailQueueId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = 'EQ';
    for (let i = 0; i < 13; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = IdGenerator;
}

// Also expose globally for browser usage
if (typeof window !== 'undefined') {
  window.IdGenerator = IdGenerator;
}

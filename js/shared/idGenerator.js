class IdGenerator {
  static generateBookingId() {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 7);
    return `BK${timestamp}${randomStr}`.toUpperCase();
  }

  static generateEditToken() {
    return Array.from({ length: 32 }, () => Math.random().toString(36)[2] || '0').join('');
  }

  static generateBlockageId() {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 5);
    return `BLK${timestamp}${randomStr}`.toUpperCase();
  }

  static generateSessionId() {
    return Array.from({ length: 16 }, () => Math.random().toString(36)[2] || '0').join('');
  }

  static generateRandomCode(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = IdGenerator;
}

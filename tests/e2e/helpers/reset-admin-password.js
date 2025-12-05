/**
 * Reset admin password to 'admin123' before each test
 * This is needed because some tests change the admin password
 */
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');

function resetAdminPassword() {
  const db = new Database('./data/bookings.db');
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(hash, 'adminPassword');
  db.close();
}

module.exports = { resetAdminPassword };

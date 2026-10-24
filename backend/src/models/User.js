const { runQuery, getQuery, allQuery } = require('../db');

/**
 * User Model
 * Schema:
 * - id: INTEGER PRIMARY KEY AUTOINCREMENT
 * - name: TEXT NOT NULL
 * - email: TEXT UNIQUE NOT NULL
 * - password_hash: TEXT NOT NULL
 * - role: TEXT NOT NULL DEFAULT 'member' ('admin' | 'member')
 * - plan: TEXT NOT NULL DEFAULT 'InkOver Studio Pro'
 * - license_key: TEXT UNIQUE
 * - created_at: DATETIME DEFAULT CURRENT_TIMESTAMP
 */
class UserModel {
  static async createTable() {
    return runQuery(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        plan TEXT NOT NULL DEFAULT 'InkOver Studio Pro',
        license_key TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  static async findByEmail(email) {
    return getQuery('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
  }

  static async findById(id) {
    return getQuery('SELECT id, name, email, role, plan, license_key as licenseKey, created_at as createdAt FROM users WHERE id = ?', [id]);
  }

  static async findAll() {
    return allQuery('SELECT id, name, email, role, plan, license_key as licenseKey, created_at as createdAt FROM users ORDER BY id DESC');
  }

  static async count() {
    const row = await getQuery('SELECT COUNT(*) as count FROM users');
    return row ? row.count : 0;
  }

  static async create({ name, email, passwordHash, role = 'member', plan = 'InkOver Studio Pro', licenseKey }) {
    const result = await runQuery(`
      INSERT INTO users (name, email, password_hash, role, plan, license_key)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [name.trim(), email.trim().toLowerCase(), paswordHash, role, plan, licenseKey]);

    return this.findById(result.lastID);
  }

  static async deleteByEmail(email) {
    return runQuery('DELETE FROM users WHERE email = ?', [email.trim().toLowerCase()]);
  }

  static async findByLicenseKey(licenseKey) {
    return getQuery('SELECT id, name, email, role, plan, license_key as licenseKey FROM users WHERE license_key = ?', [licenseKey.trim()]);
  }
}

module.exports = UserModel;
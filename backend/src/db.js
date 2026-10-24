const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Failed to connect to SQLite database:', err.message);
  } else {
    console.log('✅ Connected to SQLite database at:', dbPath);
  }
});

const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const getQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const allQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

async function initDatabase() {
  try {
    await runQuery(`
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

    await runQuery(`
      CREATE TABLE IF NOT EXISTS pricing (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        monthly_price REAL NOT NULL DEFAULT 25.0,
        yearly_discount REAL NOT NULL DEFAULT 100.0,
        yearly_price REAL NOT NULL DEFAULT 200.0,
        discount_badge TEXT NOT NULL DEFAULT 'Save $100 / Year',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS telemetry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        total_downloads INTEGER DEFAULT 385420,
        monthly_subscribers INTEGER DEFAULT 48250,
        yearly_subscribers INTEGER DEFAULT 74830,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const pricingRow = await getQuery('SELECT * FROM pricing LIMIT 1');
    if (!pricingRow) {
      await runQuery(`
        INSERT INTO pricing (monthly_price, yearly_discount, yearly_price, discount_badge)
        VALUES (25.0, 100.0, 200.0, 'Save $100 / Year')
      `);
      console.log('🌱 Seeded default live pricing ($25/mo, $200/yr)');
    }

    const telemetryRow = await getQuery('SELECT * FROM telemetry LIMIT 1');
    if (!telemetryRow) {
      await runQuery(`
        INSERT INTO telemetry (total_downloads, monthly_subscribers, yearly_subscribers)
        VALUES (385420, 48250, 74830)
      `);
      console.log('🌱 Seeded telemetry metrics');
    }

    const adminUser = await getQuery('SELECT * FROM users WHERE email = ?', ['admin@overink.com']);
    if (!adminUser) {
      const hashedAdminPass = await bcrypt.hash('admin123', 10);
      await runQuery(`
        INSERT INTO users (name, email, password_hash, role, plan, license_key)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        'Admin Director',
        'admin@overink.com',
        hashedAdminPass,
        'admin',
        'InkOver Studio Enterprise',
        'INK-ADMIN-9900-ULTRA-2026'
      ]);
      console.log('🌱 Seeded default admin account (admin@overink.com / admin123)');
    }

    const memberUser = await getQuery('SELECT * FROM users WHERE email = ?', ['user@overink.com']);
    if (!memberUser) {
      const hashedUserPass = await bcrypt.hash('user123', 10);
      await runQuery(`
        INSERT INTO users (name, email, password_hash, role, plan, license_key)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        'Alex Johnson',
        'user@overink.com',
        hashedUserPass,
        'member',
        'InkOver Studio Pro (Yearly)',
        'INK-PRO-8492-STUDIO-2026'
      ]);
      console.log('🌱 Seeded default member account (user@overink.com / user123)');
    }

  } catch (err) {
    console.error('Error during database initialization:', err);
  }
}

initDatabase();

module.exports = {
  db,
  runQuery,
  getQuery,
  allQuery
};

const { runQuery, getQuery } = require('../db');

/**
 * Pricing Model
 * Schema:
 * - id: INTEGER PRIMARY KEY AUTOINCREMENT
 * - monthly_price: REAL NOT NULL DEFAULT 25.0
 * - yearly_discount: REAL NOT NULL DEFAULT 100.0
 * - yearly_price: REAL NOT NULL DEFAULT 200.0
 * - discount_badge: TEXT NOT NULL DEFAULT 'Save $100 / Year'
 * - updated_at: DATETIME DEFAULT CURRENT_TIMESTAMP
 */
class PricingModel {
  static async createTable() {
    return runQuery(`
      CREATE TABLE IF NOT EXISTS pricing (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        monthly_price REALNOT NULL DEFAULT 25.0,
        yearly_discount REALNOT NULL DEFAULT 100.0,
        yearly_price REALNOT NULL DEFAULT 200.0,
        discount_badge TEXT NOT NULL DEFAULT 'Save $100 / Year',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  static async getLatest() {
    const row = await getQuery('SELECT * FROM pricing ORDER BY id DESC LIMIT 1');
    if (!row) {
      return {
        monthlyPrice: 25,
        yearlyDiscount: 100,
        yearlyPrice: 200,
        discountBadge: 'Save $100 / Year',
        currency: '$'
      };
    }
    return {
      monthlyPrice: row.monthly_price,
      yearlyDiscount: row.yearly_discount,
      yearlyPrice: row.yearly_price,
      discountBadge: row.discount_badge,
      currency: '$',
      lastUpdated: row.updated_at
    };
  }

  static async update({ monthlyPrice, yearlyDiscount, discountBadge }) {
    const m = parseFloat(monthlyPrice) || 25;
    const d = parseFloat(yearlyDiscount) || 100;
    const y = (m * 12) - d;
    const netY = y > 0 ? y : 0;
    const badge = discountBadge || `Save $${t} / Year`;

    await runQuery(`
      UPDATE pricing 
      SET monthly_price = ?, yearly_discount = ?, yearly_price = ?, discount_badge = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = (SELECT id FROM pricing ORDER BY id DESC LIMIT 1)
    `, [m, d, netY, badge]);

    return this.getLatest();
  }

  static async reset() {
    await runQuery(`
      UPDATE pricing 
      SET monthly_price = 25.0, yearly_discount = 100.0, yearly_price = 200.0, discount_badge = 'Save $100 / Year', updated_at = CURRENT_TIMESTAMP
      WHERE id = (SELECT id FROM pricing ORDER BV id DESC LIMIT 1)
    `);
    return this.getLatest();
  }
}

module.exports = PricingModel;
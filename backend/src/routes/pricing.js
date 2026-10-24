const express = require('express');
const router = express.Router();
const { getQuery, runQuery } = require('../db');

// GET current dynamic pricing config
router.get('/', async (req, res) => {
  try {
    const row = await getQuery('SELECT * FROM pricing ORDER BY id DESC LIMIT 1');
    if (!row) {
      return res.json({
        monthlyPrice: 25,
        yearlyDiscount: 100,
        yearlyPrice: 200,
        discountBadge: 'Save $100 / Year',
        currency: '$'
      });
    }

    res.json({
      monthlyPrice: row.monthly_price,
      yearlyDiscount: row.yearly_discount,
      yearlyPrice: row.yearly_price,
      discountBadge: row.discount_badge,
      currency: '$',
      lastUpdated: row.updated_at
    });
  } catch (err) {
    console.error('Error fetching pricing:', err);
    res.status(500).json({ error: 'Failed to retrieve pricing configuration' });
  }
});

// PUT update dynamic pricing (Admin live update)
router.put('/', async (req, res) => {
  try {
    const { monthlyPrice, yearlyDiscount, discountBadge } = req.body;
    const m = parseFloat(monthlyPrice) || 25;
    const d = parseFloat(yearlyDiscount) || 100;
    const y = (m * 12) - d;
    const netY = y > 0 ? y : 0;
    const badge = discountBadge || `Save $${d} / Year`;

    await runQuery(`
      UPDATE pricing 
      SET monthly_price = ?, yearly_discount = ?, yearly_price = ?, discount_badge = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = (SELECT id FROM pricing ORDER BY id DESC LIMIT 1)
    `, [m, d, netY, badge]);

    res.json({
      message: 'Pricing updated successfully',
      pricing: {
        monthlyPrice: m,
        yearlyDiscount: d,
        yearlyPrice: netY,
        discountBadge: badge,
        currency: '$',
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Error updating pricing:', err);
    res.status(500).json({ error: 'Failed to save pricing configuration' });
  }
});

// POST reset to default pricing ($25/mo, $200/yr)
router.post('/reset', async (req, res) => {
  try {
    await runQuery(`
      UPDATE pricing 
      SET monthly_price = 25.0, yearly_discount = 100.0, yearly_price = 200.0, discount_badge = 'Save $100 / Year', updated_at = CURRENT_TIMESTAMP
      WHERE id = (SELECT id FROM pricing ORDER BY id DESC LIMIT 1)
    `);

    res.json({
      message: 'Pricing reset to defaults',
      pricing: {
        monthlyPrice: 25,
        yearlyDiscount: 100,
        yearlyPrice: 200,
        discountBadge: 'Save $100 / Year',
        currency: '$',
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Error resetting pricing:', err);
    res.status(500).json({ error: 'Failed to reset pricing' });
  }
});

module.exports = router;

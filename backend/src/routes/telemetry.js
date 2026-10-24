const express = require('express');
const router = express.Router();
const { getQuery, runQuery } = require('../db');

// GET dashboard statistics
router.get('/', async (req, res) => {
  try {
    const userCountRow = await getQuery('SELECT COUNT(*) as count FROM users');
    const telemetryRow = await getQuery('SELECT * FROM telemetry ORDER BY id DESC LIMIT 1');

    const totalDbUsers = userCountRow ? userCountRow.count : 0;
    const baseDownloads = telemetryRow ? telemetryRow.total_downloads : 385420;
    const monthlySubs = telemetryRow ? telemetryRow.monthly_subscribers : 48250;
    const yearlySubs = telemetryRow ? telemetryRow.yearly_subscribers : 74830;

    res.json({
      totalUsers: 128490 + totalDbUsers,
      monthlySubscribers: monthlySubs,
      yearlySubscribers: yearlySubs,
      totalDownloads: baseDownloads,
      platformBreakdown: {
        windows11: '68.4%',
        windows10: '29.2%',
        armAndOther: '2.4%'
      }
    });
  } catch (err) {
    console.error('Error fetching telemetry:', err);
    res.status(500).json({ error: 'Failed to retrieve stats' });
  }
});

// POST record download event
router.post('/download', async (req, res) => {
  try {
    const { os, version } = req.body;
    await runQuery(`
      UPDATE telemetry 
      SET total_downloads = total_downloads + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = (SELECT id FROM telemetry ORDER BY id DESC LIMIT 1)
    `);

    res.json({
      success: true,
      message: 'Download event recorded',
      os: os || 'Windows 11 (64-bit)',
      version: version || 'v3.12'
    });
  } catch (err) {
    console.error('Error logging download:', err);
    res.status(500).json({ error: 'Failed to log download' });
  }
});

module.exports = router;

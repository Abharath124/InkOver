const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getQuery, allQuery, runQuery } = require('../db');

// GET all users
router.get('/', async (req, res) => {
  try {
    const rows = await allQuery(`
      SELECT id, name, email, role, plan, license_key as licenseKey, created_at as createdAt 
      FROM users 
      ORDER BY id DESC
    `);
    res.json({ users: rows });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to retrieve user accounts' });
  }
});

// POST create user (Admin action)
router.post('/', async (req, res) => {
  try {
    const { name, email, plan, role, password } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await getQuery('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
    if (existing) {
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }

    const assignedRole = role === 'admin' ? 'admin' : 'member';
    const assignedPlan = plan || 'InkOver Studio Pro (Yearly)';
    const generatedKey = 'INK-' + (assignedRole === 'admin' ? 'ADM' : 'PRO') + '-' + Math.floor(1000 + Math.random() * 9000) + '-STUDIO-2026';
    const hashedPassword = await bcrypt.hash(password || (assignedRole === 'admin' ? 'admin123' : 'user123'), 10);

    const result = await runQuery(`
      INSERT INTO users (name, email, password_hash, role, plan, license_key)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [name.trim(), normalizedEmail, hashedPassword, assignedRole, assignedPlan, generatedKey]);

    const newUser = {
      id: result.lastID,
      name: name.trim(),
      email: normalizedEmail,
      role: assignedRole,
      plan: assignedPlan,
      licenseKey: generatedKey,
      createdAt: new Date().toLocaleDateString()
    };

    res.status(201).json({
      message: 'User created successfully',
      user: newUser
    });
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// DELETE user
router.delete('/:email', async (req, res) => {
  try {
    const targetEmail = req.params.email.toLowerCase().trim();
    if (targetEmail === 'admin@overink.com') {
      return res.status(403).json({ error: 'Cannot delete primary root administrator.' });
    }

    await runQuery('DELETE FROM users WHERE email = ?', [targetEmail]);
    res.json({ message: `User ${targetEmail} removed successfully.` });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Verify license key (Called by Windows Desktop Application)
router.post('/verify-license', async (req, res) => {
  try {
    const { licenseKey } = req.body;
    if (!licenseKey) {
      return res.status(400).json({ valid: false, message: 'License key is required' });
    }

    const user = await getQuery('SELECT id, name, email, plan, role FROM users WHERE license_key = ?', [licenseKey.trim()]);
    if (!user) {
      return res.status(404).json({ valid: false, message: 'Invalid license key' });
    }

    res.json({
      valid: true,
      user: {
        name: user.name,
        plan: user.plan,
        role: user.role
      },
      message: 'License verified successfully'
    });
  } catch (err) {
    console.error('License verify error:', err);
    res.status(500).json({ valid: false, error: 'License verification error' });
  }
});

module.exports = router;

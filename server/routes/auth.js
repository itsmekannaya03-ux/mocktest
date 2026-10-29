const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../models/db');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

// Authorized Administrator Number Registry (Confidential Backend Configuration)
const TONY_ADMIN_NUMBERS = [process.env.TONY_ADMIN_NUMBER || '224488', '224488', '3000', '1001'];
const CAP_ADMIN_NUMBERS = [process.env.CAP_ADMIN_NUMBER || '224489', '1941', '1002'];

// POST /api/auth/entry - Single entry point for Name vs Admin Number routing
router.post('/entry', async (req, res) => {
  try {
    const rawInput = (req.body.input || req.body.nameOrNumber || '').trim();

    if (!rawInput || rawInput.length < 2) {
      return res.status(400).json({ error: 'Please enter your name.' });
    }

    // Check if input is purely numeric (Admin Number check)
    const isNumeric = /^\d+$/.test(rawInput);

    if (isNumeric) {
      // 1. Authorized Administrator 1: Tony Stark (Iron Man) - default: 224488
      if (TONY_ADMIN_NUMBERS.includes(rawInput)) {
        let adminUser = await db.Users.findOne({ email: 'tony@iris.shield' });
        if (!adminUser) {
          const hashedStark = await bcrypt.hash('Jarvis123!', 10);
          adminUser = await db.Users.create({
            name: 'Tony Stark',
            alias: 'Iron Man (Administrator 1)',
            email: 'tony@iris.shield',
            password: hashedStark,
            role: 'admin',
            clearance: 'Level 10 - Stark Command',
            badgeId: 'IRIS-ADMIN-01'
          });
        }

        const token = jwt.sign(
          { id: adminUser._id, role: 'admin', email: adminUser.email },
          JWT_SECRET,
          { expiresIn: '12h' }
        );

        return res.json({
          token,
          room: 'admin-room',
          user: {
            id: adminUser._id,
            name: adminUser.name,
            alias: adminUser.alias,
            email: adminUser.email,
            role: 'admin',
            badgeId: adminUser.badgeId,
            clearance: adminUser.clearance
          },
          message: 'Welcome Administrator Tony Stark (Iron Man). Accessing Admin Command Bridge.'
        });
      }

      // 2. Authorized Administrator 2: Steve Rogers (Captain America)
      if (CAP_ADMIN_NUMBERS.includes(rawInput)) {
        let adminUser = await db.Users.findOne({ email: 'cap@iris.shield' });
        if (!adminUser) {
          const hashedCap = await bcrypt.hash('Vanguard123!', 10);
          adminUser = await db.Users.create({
            name: 'Steve Rogers',
            alias: 'Captain America (Administrator 2)',
            email: 'cap@iris.shield',
            password: hashedCap,
            role: 'admin',
            clearance: 'Level 10 - Vanguard Command',
            badgeId: 'IRIS-ADMIN-02'
          });
        }

        const token = jwt.sign(
          { id: adminUser._id, role: 'admin', email: adminUser.email },
          JWT_SECRET,
          { expiresIn: '12h' }
        );

        return res.json({
          token,
          room: 'admin-room',
          user: {
            id: adminUser._id,
            name: adminUser.name,
            alias: adminUser.alias,
            email: adminUser.email,
            role: 'admin',
            badgeId: adminUser.badgeId,
            clearance: adminUser.clearance
          },
          message: 'Welcome Administrator Steve Rogers (Captain America). Accessing Admin Command Bridge.'
        });
      }

      // 3. Any other number is UNRECOGNIZED -> Reject!
      return res.status(401).json({
        error: 'Access Denied: Unrecognized credentials. Please enter a valid name.'
      });
    }

    // Input is text/name: Common Room Route
    const cleanName = rawInput.replace(/[^a-zA-Z\s.-]/g, '').trim();
    if (!cleanName || cleanName.length < 2) {
      return res.status(400).json({ error: 'Please enter a valid name (at least 2 letters).' });
    }

    // Security Rule: Never grant admin role based on typing an administrator's name
    // Even if someone types "Tony Stark" or "Steve Rogers", role is strictly 'student'
    let studentUser = await db.Users.findOne(u => u.role === 'student' && u.name.toLowerCase() === cleanName.toLowerCase());

    if (!studentUser) {
      const badgeNumber = Math.floor(100 + Math.random() * 900);
      const safeEmail = `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}.${badgeNumber}@iris.shield`;
      const dummyPassword = await bcrypt.hash('IrisMember2026!', 10);

      studentUser = await db.Users.create({
        name: cleanName,
        alias: 'IRIS Operative',
        email: safeEmail,
        password: dummyPassword,
        role: 'student', // ALWAYS STUDENT!
        clearance: 'Level 3 - Operative',
        badgeId: `IRIS-MEMBER-${badgeNumber}`
      });
    }

    const token = jwt.sign(
      { id: studentUser._id, role: 'student', email: studentUser.email },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    return res.json({
      token,
      room: 'common-room',
      user: {
        id: studentUser._id,
        name: studentUser.name,
        alias: studentUser.alias,
        email: studentUser.email,
        role: 'student',
        badgeId: studentUser.badgeId,
        clearance: studentUser.clearance
      },
      message: `Welcome to the Common Room, ${studentUser.name}.`
    });
  } catch (err) {
    console.error('Entry error:', err);
    res.status(500).json({ error: 'Server authentication processing failure.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await db.Users.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid IRIS credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid IRIS credentials.' });
    }

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        alias: user.alias,
        email: user.email,
        role: user.role,
        badgeId: user.badgeId,
        clearance: user.clearance
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server authentication failure.' });
  }
});

// POST /api/auth/register (New IRIS Team Member - Students Only)
router.post('/register', async (req, res) => {
  try {
    const { name, alias, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await db.Users.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({ error: 'An IRIS operative with this email is already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const badgeNumber = Math.floor(100 + Math.random() * 900);

    // SECURITY: Members registering through normal registration are ALWAYS assigned 'student' role.
    // Admin access is strictly reserved for Tony Stark and Steve Rogers!
    const newUser = await db.Users.create({
      name: name.trim(),
      alias: alias ? alias.trim() : 'IRIS Operative',
      email: cleanEmail,
      password: hashedPassword,
      role: 'student',
      clearance: 'Level 3 - Candidate',
      badgeId: `IRIS-MEMBER-${badgeNumber}`
    });

    const token = jwt.sign(
      {
        id: newUser._id,
        role: newUser.role,
        email: newUser.email
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    return res.status(201).json({
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        alias: newUser.alias,
        email: newUser.email,
        role: newUser.role,
        badgeId: newUser.badgeId,
        clearance: newUser.clearance
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Failed to register IRIS member.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await db.Users.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({
      id: user._id,
      name: user.name,
      alias: user.alias,
      email: user.email,
      role: user.role,
      badgeId: user.badgeId,
      clearance: user.clearance
    });
  } catch (err) {
    res.status(500).json({ error: 'Session verification failure.' });
  }
});

module.exports = router;

const jwt = require('jsonwebtoken');
const db = require('../models/db');

const JWT_SECRET = process.env.JWT_SECRET || 'IRIS_CYBER_SHIELD_SECRET_KEY_2026';

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Access denied.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.Users.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'User session no longer valid.' });
    }

    req.user = {
      id: user._id,
      name: user.name,
      alias: user.alias,
      email: user.email,
      role: user.role,
      badgeId: user.badgeId,
      clearance: user.clearance
    };
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired security token.' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Restricted Access: Only authorized administrators (Tony Stark or Steve Rogers) can access this room.' 
    });
  }
  next();
}

module.exports = {
  authenticateToken,
  requireAdmin,
  JWT_SECRET
};

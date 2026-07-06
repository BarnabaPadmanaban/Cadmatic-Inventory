const jwt = require('jsonwebtoken');
const env = require('../config/env');

const JWT_SECRET = env.JWT_SECRET;

// Verifies the JWT from the Authorization header and attaches the decoded user to req.user
const authenticate = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, username, role, full_name }
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError'
      ? 'Session expired. Please log in again.'
      : 'Invalid authentication token.';
    return res.status(401).json({ success: false, message });
  }
};

// Restricts a route to one or more roles, e.g. authorize('Admin')
const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
  }
  next();
};

module.exports = { authenticate, authorize, JWT_SECRET };

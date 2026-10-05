const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ success: false, message: 'Please sign in to continue.' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'Your session has expired. Please sign in again.' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin access is required.' });
  return next();
}

function requireOwner(req, res, next) {
  if (req.user?.role !== 'boat_owner') return res.status(403).json({ success: false, message: 'Boat owner access is required.' });
  return next();
}

function requireCustomer(req, res, next) {
  if (req.user?.role !== 'customer') return res.status(403).json({ success: false, message: 'Customer access is required.' });
  return next();
}

function optionalAuthenticate(req, res, next) {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return next();
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); return next(); }
  catch { return res.status(401).json({ success: false, message: 'Your session has expired. Please sign in again.' }); }
}

module.exports = { authenticate, requireAdmin, requireOwner, requireCustomer, optionalAuthenticate };

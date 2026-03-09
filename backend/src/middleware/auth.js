import crypto from 'crypto';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import * as AuditLog from '../models/AuditLog.js';

export function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  return res.status(401).json({ error: 'Authentication required' });
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still do a comparison to keep constant time, but always return false
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function login(req, res) {
  const { password } = req.body;

  if (!password || typeof password !== 'string') {
    logger.warn(`Failed login attempt: missing password (IP: ${req.ip})`);
    return res.status(400).json({ error: 'Password is required' });
  }

  if (!safeCompare(password, config.masterPassword)) {
    logger.warn(`Failed login attempt: invalid password (IP: ${req.ip})`);
    AuditLog.log('Login failed: invalid password', 'auth', 'warning', null, req.ip);
    return res.status(401).json({ error: 'Invalid password' });
  }

  req.session.authenticated = true;
  logger.info(`Successful login (IP: ${req.ip})`);
  AuditLog.log('Login successful', 'auth', 'info', null, req.ip);
  res.json({ success: true });
}

export function logout(req, res) {
  AuditLog.log('Logout', 'auth', 'info', null, req.ip);
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.clearCookie('deadman.sid');
    res.json({ success: true });
  });
}

export function checkAuth(req, res) {
  res.json({ authenticated: !!(req.session && req.session.authenticated) });
}

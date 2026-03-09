import crypto from 'crypto';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import * as AuditLog from '../models/AuditLog.js';
import * as User from '../models/User.js';

export function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  return res.status(401).json({ error: 'Authentication required' });
}

// ─── Password Hashing (scrypt) ──────────────────────────────────
const SCRYPT_N = 8192;   // 2^13 — secure and low-memory Docker-friendly
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `${salt}:${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const derived = crypto.scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  const hashBuf = Buffer.from(hash, 'hex');
  if (derived.length !== hashBuf.length) {
    crypto.timingSafeEqual(derived, derived);
    return false;
  }
  return crypto.timingSafeEqual(derived, hashBuf);
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

// ─── Login ──────────────────────────────────────────────────────
export function login(req, res) {
  const { password } = req.body;

  if (!password || typeof password !== 'string') {
    logger.warn(`Failed login attempt: missing password (IP: ${req.ip})`);
    return res.status(400).json({ error: 'Password is required' });
  }

  // Check DB-stored hash first, fall back to env var
  const user = User.getUser();
  let valid = false;
  if (user && user.password_hash) {
    valid = verifyPassword(password, user.password_hash);
  } else {
    valid = safeCompare(password, config.masterPassword);
  }

  if (!valid) {
    logger.warn(`Failed login attempt: invalid password (IP: ${req.ip})`);
    AuditLog.log('Login failed: invalid password', 'auth', 'warning', null, req.ip);
    return res.status(401).json({ error: 'Invalid password' });
  }

  req.session.authenticated = true;
  logger.info(`Successful login (IP: ${req.ip})`);
  AuditLog.log('Login successful', 'auth', 'info', null, req.ip);
  res.json({ success: true });
}

// ─── Logout ─────────────────────────────────────────────────────
export function logout(req, res) {
  AuditLog.log('Logout', 'auth', 'info', null, req.ip);
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.clearCookie('deadman.sid');
    res.json({ success: true });
  });
}

// ─── Auth Check ─────────────────────────────────────────────────
export function checkAuth(req, res) {
  const authenticated = !!(req.session && req.session.authenticated);
  let passwordChangeRequired = false;
  if (authenticated) {
    const user = User.getUser();
    passwordChangeRequired = !user.password_changed;
  }
  res.json({ authenticated, passwordChangeRequired });
}

// ─── Change Password ────────────────────────────────────────────
export function changePassword(req, res) {
  const { newPassword } = req.body;

  if (!newPassword || typeof newPassword !== 'string') {
    return res.status(400).json({ error: 'New password is required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const hashed = hashPassword(newPassword);
  User.setPassword(hashed);

  AuditLog.log('Password changed', 'auth', 'warning', null, req.ip);
  logger.info(`Password changed (IP: ${req.ip})`);
  res.json({ success: true });
}

// ─── Skip Password Change ───────────────────────────────────────
export function skipPasswordChange(req, res) {
  User.markPasswordChanged();
  AuditLog.log('Password change skipped', 'auth', 'info', null, req.ip);
  res.json({ success: true });
}

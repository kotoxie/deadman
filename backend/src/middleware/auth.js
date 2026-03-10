import crypto from 'crypto';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import * as AuditLog from '../models/AuditLog.js';
import * as User from '../models/User.js';
import * as Setting from '../models/Setting.js';
import { sendAdminNotificationEmail, isConfigured as emailConfigured } from '../services/emailService.js';
import { sendAdminNotificationTelegram, isConfigured as telegramConfigured } from '../services/telegramService.js';

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
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// ─── IP Rate Limiting ───────────────────────────────────────────
const ipRecords = new Map(); // ip -> { failures, firstFailure, blockedAt }
let lastExcessiveNotification = 0;

function getLoginConfig() {
  return {
    maxAttempts: parseInt(Setting.get('login_max_attempts')) || 5,
    cooloffHours: parseFloat(Setting.get('login_cooloff_hours')) || 4,
    notifyBlock: Setting.get('notify_ip_block') === 'true',
    notifyExcessive: Setting.get('notify_excessive_failures') === 'true',
    excessiveThreshold: parseInt(Setting.get('login_excessive_threshold')) || 20,
  };
}

function isIpBlocked(ip, cooloffMs) {
  const rec = ipRecords.get(ip);
  if (!rec || !rec.blockedAt) return false;
  if (Date.now() - rec.blockedAt >= cooloffMs) {
    // Cooloff expired — unblock
    ipRecords.delete(ip);
    logger.info(`IP ${ip} unblocked (cooloff expired)`);
    return false;
  }
  return true;
}

function remainingCooloffMinutes(ip, cooloffMs) {
  const rec = ipRecords.get(ip);
  if (!rec || !rec.blockedAt) return 0;
  return Math.max(1, Math.ceil((cooloffMs - (Date.now() - rec.blockedAt)) / 60000));
}

function recordFailure(ip, cfg) {
  let rec = ipRecords.get(ip);
  if (!rec) {
    rec = { failures: 0, firstFailure: Date.now(), blockedAt: null };
    ipRecords.set(ip, rec);
  }
  rec.failures++;

  // Block if threshold reached
  if (rec.failures >= cfg.maxAttempts && !rec.blockedAt) {
    rec.blockedAt = Date.now();
    return true; // newly blocked
  }
  return false;
}

function cleanupStaleRecords(cooloffMs) {
  const now = Date.now();
  for (const [ip, rec] of ipRecords) {
    if (rec.blockedAt && now - rec.blockedAt >= cooloffMs) {
      ipRecords.delete(ip);
    } else if (!rec.blockedAt && rec.firstFailure && now - rec.firstFailure > cooloffMs) {
      ipRecords.delete(ip);
    }
  }
}

function getGlobalFailureStats() {
  const oneHourAgo = Date.now() - 3600000;
  let totalFailures = 0;
  let uniqueIps = 0;
  for (const [, rec] of ipRecords) {
    if (rec.firstFailure && rec.firstFailure > oneHourAgo) {
      totalFailures += rec.failures;
      uniqueIps++;
    }
  }
  return { totalFailures, uniqueIps };
}

async function notifyAdmin(subject, emailBody, telegramMsg) {
  const adminEmail = Setting.get('admin_notify_email');
  const adminTelegram = Setting.get('admin_notify_telegram_chat_id');

  if (emailConfigured() && adminEmail) {
    try { await sendAdminNotificationEmail(adminEmail, subject, emailBody); }
    catch (e) { logger.error('Admin notification email failed:', e.message); }
  }
  if (telegramConfigured() && adminTelegram) {
    try { await sendAdminNotificationTelegram(adminTelegram, telegramMsg); }
    catch (e) { logger.error('Admin notification telegram failed:', e.message); }
  }
}

// ─── Login ──────────────────────────────────────────────────────
export function login(req, res) {
  const { password } = req.body;
  const ip = req.ip;
  const cfg = getLoginConfig();
  const cooloffMs = cfg.cooloffHours * 3600000;

  // Lazy cleanup of stale records
  cleanupStaleRecords(cooloffMs);

  // Check if IP is blocked
  if (isIpBlocked(ip, cooloffMs)) {
    const minutesLeft = remainingCooloffMinutes(ip, cooloffMs);
    logger.warn(`Blocked login attempt from banned IP: ${ip}`);
    AuditLog.log(`Login blocked: IP banned (${minutesLeft}m remaining)`, 'auth', 'warning', JSON.stringify({ ip, minutesLeft }), ip);
    return res.status(429).json({
      error: `IP address blocked due to too many failed attempts. Try again in ${minutesLeft} minutes.`,
      blocked: true,
      minutesLeft,
    });
  }

  if (!password || typeof password !== 'string') {
    logger.warn(`Failed login attempt: missing password (IP: ${ip})`);
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
    logger.warn(`Failed login attempt: invalid password (IP: ${ip})`);
    AuditLog.log('Login failed: invalid password', 'auth', 'warning', null, ip);

    // Record failure and check if newly blocked
    const newlyBlocked = recordFailure(ip, cfg);

    if (newlyBlocked) {
      const rec = ipRecords.get(ip);
      AuditLog.log(
        `IP blocked after ${rec.failures} failed login attempts`,
        'auth', 'critical',
        JSON.stringify({ ip, failures: rec.failures, cooloffHours: cfg.cooloffHours }),
        ip
      );
      logger.warn(`IP ${ip} blocked after ${rec.failures} failed attempts`);

      // Admin notification for IP block
      if (cfg.notifyBlock) {
        notifyAdmin(
          `[Dead Man's Switch] IP Blocked: ${ip}`,
          `An IP address has been blocked due to excessive failed login attempts.\n\nIP: ${ip}\nFailed attempts: ${rec.failures}\nCooloff: ${cfg.cooloffHours} hours`,
          `🚫 <b>IP Blocked</b>\n\nIP <code>${ip}</code> blocked after ${rec.failures} failed login attempts.\nCooloff: ${cfg.cooloffHours}h`
        ).catch(e => logger.error('Block notification error:', e));
      }

      // Return blocked message immediately
      const minutesLeft = remainingCooloffMinutes(ip, cooloffMs);
      return res.status(429).json({
        error: `IP address blocked due to too many failed attempts. Try again in ${minutesLeft} minutes.`,
        blocked: true,
        minutesLeft,
      });
    }

    // Check for excessive failures across all IPs
    if (cfg.notifyExcessive) {
      const { totalFailures, uniqueIps } = getGlobalFailureStats();
      if (totalFailures >= cfg.excessiveThreshold) {
        // Only notify once per hour
        if (Date.now() - lastExcessiveNotification > 3600000) {
          lastExcessiveNotification = Date.now();
          AuditLog.log(
            `Excessive login failures detected: ${totalFailures} from ${uniqueIps} IPs`,
            'auth', 'critical',
            JSON.stringify({ totalFailures, uniqueIps }),
            ip
          );
          notifyAdmin(
            `[Dead Man's Switch] Excessive Login Failures`,
            `Warning: Excessive login failures detected.\n\nTotal failures (last hour): ${totalFailures}\nUnique IPs: ${uniqueIps}\n\nThis may indicate a brute-force attack.`,
            `⚠️ <b>Excessive Login Failures</b>\n\n<b>${totalFailures}</b> failed attempts from <b>${uniqueIps}</b> unique IPs in the last hour.`
          ).catch(e => logger.error('Excessive notification error:', e));
        }
      }
    }

    return res.status(401).json({ error: 'Invalid password' });
  }

  // Successful login — clear IP record
  ipRecords.delete(ip);
  req.session.authenticated = true;
  logger.info(`Successful login (IP: ${ip})`);
  AuditLog.log('Login successful', 'auth', 'info', null, ip);
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

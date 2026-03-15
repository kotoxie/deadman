import crypto from 'crypto';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import * as AuditLog from '../models/AuditLog.js';
import * as User from '../models/User.js';
import * as Setting from '../models/Setting.js';
import { sendAdminNotificationEmail, isConfigured as emailConfigured } from '../services/emailService.js';
import { sendAdminNotificationTelegram, isConfigured as telegramConfigured } from '../services/telegramService.js';
import * as IpBlock from '../models/IpBlock.js';

export function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    // Verify session version — password change invalidates all other sessions
    const user = User.getUser();
    const currentVersion = user.session_version || 0;
    if (req.session.sessionVersion !== undefined && req.session.sessionVersion !== currentVersion) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
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
  // scrypt always produces KEY_LEN bytes; a length mismatch means a corrupted stored hash.
  if (derived.length !== hashBuf.length) return false;
  return crypto.timingSafeEqual(derived, hashBuf);
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Both strings are hashed to equal-length SHA-256 digests before comparing,
 * so differing input lengths cannot be detected via timing.
 */
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

// ─── IP Rate Limiting (DB-backed, survives restarts) ────────────
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

  // Lazy cleanup of stale records
  IpBlock.cleanup(cfg.cooloffHours);

  // Check if IP is blocked (persisted in DB — survives restarts)
  if (IpBlock.isBlocked(ip, cfg.cooloffHours)) {
    const minutesLeft = IpBlock.remainingMinutes(ip, cfg.cooloffHours);
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

    // Record failure in DB
    IpBlock.recordFailure(ip);
    const failures = IpBlock.getFailures(ip);

    // Block if threshold reached
    if (failures >= cfg.maxAttempts) {
      const rec = IpBlock.get(ip);
      if (!rec.blocked_at) {
        IpBlock.block(ip);
        AuditLog.log(
          `IP blocked after ${failures} failed login attempts`,
          'auth', 'critical',
          JSON.stringify({ ip, failures, cooloffHours: cfg.cooloffHours }),
          ip
        );
        logger.warn(`IP ${ip} blocked after ${failures} failed attempts`);

        // Admin notification for IP block
        if (cfg.notifyBlock) {
          notifyAdmin(
            `[Dead Man's Switch] IP Blocked: ${ip}`,
            `An IP address has been blocked due to excessive failed login attempts.\n\nIP: ${ip}\nFailed attempts: ${failures}\nCooloff: ${cfg.cooloffHours} hours`,
            `🚫 <b>IP Blocked</b>\n\nIP <code>${ip}</code> blocked after ${failures} failed login attempts.\nCooloff: ${cfg.cooloffHours}h`
          ).catch(e => logger.error('Block notification error:', e));
        }
      }

      // Return blocked message immediately
      const minutesLeft = IpBlock.remainingMinutes(ip, cfg.cooloffHours);
      return res.status(429).json({
        error: `IP address blocked due to too many failed attempts. Try again in ${minutesLeft} minutes.`,
        blocked: true,
        minutesLeft,
      });
    }

    // Check for excessive failures across all IPs
    if (cfg.notifyExcessive) {
      const { totalFailures, uniqueIps } = IpBlock.getGlobalFailureStats(1);
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
  IpBlock.remove(ip);

  // Regenerate session to prevent session fixation
  const oldSession = req.session;
  req.session.regenerate((err) => {
    if (err) {
      logger.error('Session regeneration failed:', err);
      return res.status(500).json({ error: 'Login failed' });
    }
    req.session.authenticated = true;
    // Store session version for invalidation on password change
    const user = User.getUser();
    req.session.sessionVersion = user.session_version || 0;
    // Generate a per-session CSRF token — returned to the frontend via /auth/check
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    logger.info(`Successful login (IP: ${ip})`);
    AuditLog.log('Login successful', 'auth', 'info', null, ip);
    res.json({ success: true });
  });
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
  // Include the CSRF token so the frontend can attach it to mutating requests
  res.json({ authenticated, passwordChangeRequired, csrfToken: req.session?.csrfToken || null });
}

// ─── Change Password ────────────────────────────────────────────
export function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;

  // Always require current password verification
  if (!currentPassword || typeof currentPassword !== 'string') {
    return res.status(400).json({ error: 'Current password is required' });
  }
  if (!newPassword || typeof newPassword !== 'string') {
    return res.status(400).json({ error: 'New password is required' });
  }
  if (newPassword.length < 12) {
    return res.status(400).json({ error: 'Password must be at least 12 characters' });
  }
  const WEAK_PASSWORDS = ['admin', 'admin123', 'password', 'password123', '12345678', 'change_me_to_a_strong_password'];
  if (WEAK_PASSWORDS.includes(newPassword)) {
    return res.status(400).json({ error: 'Password is too weak. Choose a strong, unique password.' });
  }

  // Verify current password — check DB hash first, fall back to env var
  const user = User.getUser();
  let currentValid = false;
  if (user && user.password_hash) {
    currentValid = verifyPassword(currentPassword, user.password_hash);
  } else {
    currentValid = safeCompare(currentPassword, config.masterPassword);
  }
  if (!currentValid) {
    AuditLog.log('Password change failed: wrong current password', 'auth', 'warning', null, req.ip);
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  // Set new password and increment session version (invalidates all other sessions)
  const hashed = hashPassword(newPassword);
  User.setPassword(hashed);
  User.incrementSessionVersion();

  // Update current session with new version so this session stays valid
  const updatedUser = User.getUser();
  req.session.sessionVersion = updatedUser.session_version;

  AuditLog.log('Password changed (all other sessions invalidated)', 'auth', 'warning', null, req.ip);
  logger.info(`Password changed, sessions invalidated (IP: ${req.ip})`);
  res.json({ success: true });
}

// ─── Skip Password Change ───────────────────────────────────────
export function skipPasswordChange(req, res) {
  User.markPasswordChanged();
  AuditLog.log('Password change skipped', 'auth', 'info', null, req.ip);
  res.json({ success: true });
}

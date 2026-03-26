import crypto from 'crypto';
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
      // Destroy session first, then respond — avoids race where next request slips through
      return req.session.destroy((err) => {
        if (err) logger.error('Session destroy failed:', err);
        res.status(401).json({ error: 'Session expired. Please log in again.' });
      });
    }
    return next();
  }
  return res.status(401).json({ error: 'Authentication required' });
}

// ─── Password Hashing (scrypt) ──────────────────────────────────
const SCRYPT_N = 8192;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;
const MIN_PASSWORD_LENGTH = 12;
const WEAK_PASSWORDS = ['admin', 'admin123', 'password', 'password123', '12345678', 'change_me_to_a_strong_password'];

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

  // Check if first-run setup is required (no password set yet)
  const user = User.getUser();
  if (!user || !user.password_hash) {
    return res.status(403).json({ error: 'No password configured. Please complete setup first.', setupRequired: true });
  }

  const valid = verifyPassword(password, user.password_hash);

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
    // Generate a per-session CSRF token — included in response and available via /auth/check
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    logger.info(`Successful login (IP: ${ip})`);
    AuditLog.log('Login successful', 'auth', 'info', null, ip);
    res.json({ success: true, csrfToken: req.session.csrfToken });
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
  const user = User.getUser();
  const setupRequired = !user || !user.password_hash;
  const authenticated = !!(req.session && req.session.authenticated);
  let passwordChangeRequired = false;
  if (authenticated && !setupRequired) {
    passwordChangeRequired = !user.password_changed;
  }
  res.json({ authenticated, passwordChangeRequired, setupRequired, csrfToken: req.session?.csrfToken || null });
}

// ─── Change Password ────────────────────────────────────────────
export function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || typeof currentPassword !== 'string') {
    return res.status(400).json({ error: 'Current password is required' });
  }
  if (!newPassword || typeof newPassword !== 'string') {
    return res.status(400).json({ error: 'New password is required' });
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }
  if (WEAK_PASSWORDS.includes(newPassword)) {
    return res.status(400).json({ error: 'Password is too weak. Choose a strong, unique password.' });
  }

  const user = User.getUser();
  if (!user || !user.password_hash) {
    return res.status(400).json({ error: 'No password configured. Please use the setup page.' });
  }
  const currentValid = verifyPassword(currentPassword, user.password_hash);
  if (!currentValid) {
    AuditLog.log('Password change failed: wrong current password', 'auth', 'warning', null, req.ip);
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const hashed = hashPassword(newPassword);
  User.setPassword(hashed);
  User.incrementSessionVersion();

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

// ─── First-Run Setup Password ───────────────────────────────────
export function setupPassword(req, res) {
  const user = User.getUser();
  if (user && user.password_hash) {
    return res.status(400).json({ error: 'Password already configured. Use the change-password form instead.' });
  }

  const { password, confirmPassword } = req.body;
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password is required' });
  }
  if (!confirmPassword || password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }
  if (WEAK_PASSWORDS.includes(password)) {
    return res.status(400).json({ error: 'Password is too common or weak. Choose a stronger one.' });
  }

  const hashed = hashPassword(password);
  User.setPassword(hashed);
  User.markPasswordChanged();

  // Create authenticated session immediately after setup
  req.session.authenticated = true;
  req.session.sessionVersion = User.getUser().session_version;
  req.session.csrfToken = crypto.randomBytes(32).toString('hex');

  AuditLog.log('Initial password set — first-run setup complete', 'auth', 'info', null, req.ip);
  logger.info(`First-run setup: password configured (IP: ${req.ip})`);
  res.json({ success: true, csrfToken: req.session.csrfToken });
}

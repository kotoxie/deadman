import { getDb } from '../config/database.js';

/**
 * Log an audit event.
 * @param {string} action - Description of the action (e.g., "Login successful")
 * @param {string} category - One of: auth, vault, recipient, delivery, settings, checkin, system
 * @param {string} severity - One of: info, warning, critical
 * @param {string|null} details - Optional extra details (JSON string or plain text)
 * @param {string|null} ipAddress - Request IP address
 */
export function log(action, category, severity = 'info', details = null, ipAddress = null) {
  getDb().prepare(`
    INSERT INTO audit_logs (action, category, severity, details, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `).run(action, category, severity, details, ipAddress);
}

/**
 * Find audit logs with optional filters and pagination.
 */
export function findAll({ category, severity, search, limit = 50, offset = 0 } = {}) {
  let where = 'WHERE 1=1';
  const params = [];

  if (category) { where += ' AND category = ?'; params.push(category); }
  if (severity) { where += ' AND severity = ?'; params.push(severity); }
  if (search) { where += ' AND (action LIKE ? OR details LIKE ? OR ip_address LIKE ?)'; const s = `%${search}%`; params.push(s, s, s); }

  const logs = getDb().prepare(`
    SELECT * FROM audit_logs ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const total = getDb().prepare(`
    SELECT COUNT(*) as count FROM audit_logs ${where}
  `).get(...params);

  return { logs, total: total.count };
}

/**
 * Get recent audit logs (for dashboard widget).
 */
export function getRecent(limit = 10) {
  return getDb().prepare(`
    SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?
  `).all(limit);
}

/**
 * Purge old audit logs (keep last N days).
 */
export function purgeOlderThan(days = 90) {
  return getDb().prepare(`
    DELETE FROM audit_logs WHERE created_at < datetime('now', ? || ' days')
  `).run(`-${days}`);
}

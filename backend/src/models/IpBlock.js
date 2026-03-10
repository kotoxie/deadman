import { getDb } from '../config/database.js';

export function get(ip) {
  return getDb().prepare('SELECT * FROM ip_blocks WHERE ip = ?').get(ip);
}

export function recordFailure(ip) {
  const existing = get(ip);
  if (existing) {
    getDb().prepare(`
      UPDATE ip_blocks SET failures = failures + 1, updated_at = datetime('now') WHERE ip = ?
    `).run(ip);
  } else {
    getDb().prepare(`
      INSERT INTO ip_blocks (ip, failures, first_failure_at, updated_at)
      VALUES (?, 1, datetime('now'), datetime('now'))
    `).run(ip);
  }
}

export function block(ip) {
  getDb().prepare(`
    UPDATE ip_blocks SET blocked_at = datetime('now'), updated_at = datetime('now') WHERE ip = ?
  `).run(ip);
}

export function remove(ip) {
  getDb().prepare('DELETE FROM ip_blocks WHERE ip = ?').run(ip);
}

export function isBlocked(ip, cooloffHours) {
  const rec = get(ip);
  if (!rec || !rec.blocked_at) return false;
  // Check if cooloff has expired
  const row = getDb().prepare(`
    SELECT 1 FROM ip_blocks
    WHERE ip = ? AND blocked_at IS NOT NULL
    AND datetime(blocked_at, '+' || ? || ' hours') > datetime('now')
  `).get(ip, cooloffHours);
  if (!row) {
    // Cooloff expired — clean up
    remove(ip);
    return false;
  }
  return true;
}

export function remainingMinutes(ip, cooloffHours) {
  const rec = get(ip);
  if (!rec || !rec.blocked_at) return 0;
  const row = getDb().prepare(`
    SELECT CAST((julianday(datetime(blocked_at, '+' || ? || ' hours')) - julianday('now')) * 1440 AS INTEGER) AS mins
    FROM ip_blocks WHERE ip = ?
  `).get(cooloffHours, ip);
  return row ? Math.max(1, row.mins) : 0;
}

export function getFailures(ip) {
  const rec = get(ip);
  return rec ? rec.failures : 0;
}

export function cleanup(cooloffHours) {
  // Remove records where cooloff expired (blocked) or stale unblocked records
  getDb().prepare(`
    DELETE FROM ip_blocks
    WHERE (blocked_at IS NOT NULL AND datetime(blocked_at, '+' || ? || ' hours') <= datetime('now'))
    OR (blocked_at IS NULL AND datetime(first_failure_at, '+' || ? || ' hours') <= datetime('now'))
  `).run(cooloffHours, cooloffHours);
}

export function getGlobalFailureStats(sinceHoursAgo = 1) {
  const row = getDb().prepare(`
    SELECT COUNT(DISTINCT ip) AS unique_ips, COALESCE(SUM(failures), 0) AS total_failures
    FROM ip_blocks
    WHERE first_failure_at > datetime('now', '-' || ? || ' hours')
  `).get(sinceHoursAgo);
  return { totalFailures: row.total_failures, uniqueIps: row.unique_ips };
}

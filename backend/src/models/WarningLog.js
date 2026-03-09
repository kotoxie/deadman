import { getDb } from '../config/database.js';

export function create({ hoursBeforeDeadline, method, status }) {
  getDb().prepare(`
    INSERT INTO warning_logs (user_id, hours_before_deadline, method, status)
    VALUES (1, ?, ?, ?)
  `).run(hoursBeforeDeadline, method, status);
}

export function wasWarningSent(hoursBeforeDeadline, sinceHoursAgo = 24) {
  const row = getDb().prepare(`
    SELECT id FROM warning_logs
    WHERE user_id = 1 AND hours_before_deadline = ?
    AND sent_at > datetime('now', ? || ' hours')
    AND status = 'sent'
    LIMIT 1
  `).get(hoursBeforeDeadline, `-${sinceHoursAgo}`);
  return !!row;
}

export function clearRecent() {
  getDb().prepare("DELETE FROM warning_logs WHERE user_id = 1 AND sent_at > datetime('now', '-7 days')").run();
}

import { getDb } from '../config/database.js';

export function getUser() {
  return getDb().prepare('SELECT * FROM users WHERE id = 1').get();
}

export function updateCheckin() {
  const user = getUser();
  const now = new Date().toISOString();
  const nextDeadline = new Date(Date.now() + user.checkin_interval_days * 86400000).toISOString();

  getDb().prepare(`
    UPDATE users SET last_checkin_at = ?, next_deadline_at = ?, updated_at = datetime('now')
    WHERE id = 1
  `).run(now, nextDeadline);

  return getUser();
}

export function updateSettings({ checkinIntervalDays, gracePeriodHours, warningSchedule, isPaused }) {
  const fields = [];
  const values = [];

  if (checkinIntervalDays !== undefined) { fields.push('checkin_interval_days = ?'); values.push(checkinIntervalDays); }
  if (gracePeriodHours !== undefined) { fields.push('grace_period_hours = ?'); values.push(gracePeriodHours); }
  if (warningSchedule !== undefined) { fields.push('warning_schedule = ?'); values.push(JSON.stringify(warningSchedule)); }
  if (isPaused !== undefined) { fields.push('is_paused = ?'); values.push(isPaused ? 1 : 0); }

  if (fields.length === 0) return getUser();

  fields.push("updated_at = datetime('now')");
  getDb().prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = 1`).run(...values);

  // Recalculate deadline if interval changed
  if (checkinIntervalDays !== undefined) {
    const user = getUser();
    const nextDeadline = new Date(
      new Date(user.last_checkin_at).getTime() + checkinIntervalDays * 86400000
    ).toISOString();
    getDb().prepare("UPDATE users SET next_deadline_at = ?, updated_at = datetime('now') WHERE id = 1").run(nextDeadline);
  }

  return getUser();
}

export function setPassword(hash) {
  getDb().prepare("UPDATE users SET password_hash = ?, password_changed = 1, updated_at = datetime('now') WHERE id = 1").run(hash);
}

export function markPasswordChanged() {
  getDb().prepare("UPDATE users SET password_changed = 1, updated_at = datetime('now') WHERE id = 1").run();
}

export function togglePause(paused) {
  const user = getUser();

  if (paused) {
    // Store remaining time as a setting when pausing
    const remaining = new Date(user.next_deadline_at).getTime() - Date.now();
    getDb().prepare("UPDATE users SET is_paused = 1, updated_at = datetime('now') WHERE id = 1").run();
    // Store remaining ms in warning_schedule temporarily is bad, use settings table
    const db = getDb();
    db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('pause_remaining_ms', ?, datetime('now'))").run(String(Math.max(0, remaining)));
  } else {
    // Resume: recalculate deadline from remaining time
    const db = getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key = 'pause_remaining_ms'").get();
    const remaining = row ? parseInt(row.value, 10) : user.checkin_interval_days * 86400000;
    const nextDeadline = new Date(Date.now() + remaining).toISOString();
    db.prepare("UPDATE users SET is_paused = 0, next_deadline_at = ?, updated_at = datetime('now') WHERE id = 1").run(nextDeadline);
    db.prepare("DELETE FROM settings WHERE key = 'pause_remaining_ms'").run();
  }

  return getUser();
}

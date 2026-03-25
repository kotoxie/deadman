import { getDb } from '../config/database.js';

const MAX_ATTEMPTS = 6; // 5 retries after initial failure, then permanent failure

export function create({ recipientId, vaultItemId, method, status, triggeredBy }) {
  const result = getDb().prepare(`
    INSERT INTO delivery_logs (recipient_id, vault_item_id, method, status, triggered_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(recipientId, vaultItemId, method, status || 'pending', triggeredBy);

  return getDb().prepare('SELECT * FROM delivery_logs WHERE id = ?').get(result.lastInsertRowid);
}

export function findById(id) {
  return getDb().prepare(`
    SELECT dl.*, r.name as recipient_name, vi.name as item_name, vi.type as item_type
    FROM delivery_logs dl
    JOIN recipients r ON r.id = dl.recipient_id
    JOIN vault_items vi ON vi.id = dl.vault_item_id
    WHERE dl.id = ?
  `).get(id);
}

export function findAll({ status, method, limit = 50, offset = 0 } = {}) {
  let where = 'WHERE 1=1';
  const params = [];

  if (status) { where += ' AND dl.status = ?'; params.push(status); }
  if (method) { where += ' AND dl.method = ?'; params.push(method); }

  const logs = getDb().prepare(`
    SELECT dl.*, r.name as recipient_name, vi.name as item_name, vi.type as item_type
    FROM delivery_logs dl
    JOIN recipients r ON r.id = dl.recipient_id
    JOIN vault_items vi ON vi.id = dl.vault_item_id
    ${where}
    ORDER BY dl.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const total = getDb().prepare(`
    SELECT COUNT(*) as count FROM delivery_logs dl ${where}
  `).get(...params);

  return { logs, total: total.count };
}

export function updateStatus(id, { status, errorMessage, attemptCount, nextRetryAt }) {
  getDb().prepare(`
    UPDATE delivery_logs SET status = ?, error_message = ?, attempt_count = ?,
    next_retry_at = ?, last_attempt_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(status, errorMessage || null, attemptCount, nextRetryAt || null, id);
}

export function findPendingRetries() {
  return getDb().prepare(`
    SELECT * FROM delivery_logs
    WHERE status = 'retrying'
      AND attempt_count < ?
      AND (next_retry_at IS NULL OR next_retry_at <= datetime('now'))
    ORDER BY created_at ASC
  `).all(MAX_ATTEMPTS);
}

export { MAX_ATTEMPTS };

export function getStats() {
  return getDb().prepare(`
    SELECT status, COUNT(*) as count FROM delivery_logs GROUP BY status
  `).all();
}

export function getRecent(limit = 5) {
  return getDb().prepare(`
    SELECT dl.*, r.name as recipient_name, vi.name as item_name
    FROM delivery_logs dl
    JOIN recipients r ON r.id = dl.recipient_id
    JOIN vault_items vi ON vi.id = dl.vault_item_id
    ORDER BY dl.created_at DESC LIMIT ?
  `).all(limit);
}

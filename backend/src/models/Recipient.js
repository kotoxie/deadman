import { getDb } from '../config/database.js';

export function findAll() {
  const recipients = getDb().prepare(`
    SELECT r.*, COUNT(ri.vault_item_id) as item_count
    FROM recipients r
    LEFT JOIN recipient_items ri ON ri.recipient_id = r.id
    WHERE r.user_id = 1
    GROUP BY r.id
    ORDER BY r.name
  `).all();
  return recipients;
}

export function findById(id) {
  const recipient = getDb().prepare('SELECT * FROM recipients WHERE id = ? AND user_id = 1').get(id);
  if (!recipient) return null;

  recipient.items = getDb().prepare(`
    SELECT vi.id, vi.type, vi.name FROM vault_items vi
    JOIN recipient_items ri ON ri.vault_item_id = vi.id
    WHERE ri.recipient_id = ?
  `).all(id);

  return recipient;
}

export function create({ name, email, telegramChatId, webhookUrl }) {
  const result = getDb().prepare(`
    INSERT INTO recipients (user_id, name, email, telegram_chat_id, webhook_url)
    VALUES (1, ?, ?, ?, ?)
  `).run(name, email || null, telegramChatId || null, webhookUrl || null);

  return findById(result.lastInsertRowid);
}

export function update(id, { name, email, telegramChatId, webhookUrl }) {
  const fields = [];
  const values = [];

  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (email !== undefined) { fields.push('email = ?'); values.push(email || null); }
  if (telegramChatId !== undefined) { fields.push('telegram_chat_id = ?'); values.push(telegramChatId || null); }
  if (webhookUrl !== undefined) { fields.push('webhook_url = ?'); values.push(webhookUrl || null); }

  if (fields.length === 0) return findById(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);

  getDb().prepare(`UPDATE recipients SET ${fields.join(', ')} WHERE id = ? AND user_id = 1`).run(...values);
  return findById(id);
}

export function remove(id) {
  return getDb().prepare('DELETE FROM recipients WHERE id = ? AND user_id = 1').run(id);
}

export function assignItems(recipientId, itemIds) {
  const db = getDb();
  const del = db.prepare('DELETE FROM recipient_items WHERE recipient_id = ?');
  const ins = db.prepare('INSERT INTO recipient_items (recipient_id, vault_item_id) VALUES (?, ?)');

  db.transaction(() => {
    del.run(recipientId);
    for (const itemId of itemIds) {
      ins.run(recipientId, itemId);
    }
  })();

  return findById(recipientId);
}

export function findAllWithItems() {
  const recipients = getDb().prepare('SELECT * FROM recipients WHERE user_id = 1').all();

  for (const r of recipients) {
    r.items = getDb().prepare(`
      SELECT vi.* FROM vault_items vi
      JOIN recipient_items ri ON ri.vault_item_id = vi.id
      WHERE ri.recipient_id = ?
    `).all(r.id);
  }

  return recipients.filter(r => r.items.length > 0);
}

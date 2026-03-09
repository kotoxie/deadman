import { getDb } from '../config/database.js';

export function findAll() {
  return getDb().prepare(`
    SELECT id, type, name, file_name, file_mime_type, file_size, created_at, updated_at
    FROM vault_items WHERE user_id = 1 ORDER BY updated_at DESC
  `).all();
}

export function findById(id) {
  return getDb().prepare('SELECT * FROM vault_items WHERE id = ? AND user_id = 1').get(id);
}

export function create({ type, name, encryptedData, iv, authTag, fileName, fileMimeType, fileSize }) {
  const result = getDb().prepare(`
    INSERT INTO vault_items (user_id, type, name, encrypted_data, iv, auth_tag, file_name, file_mime_type, file_size)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(type, name, encryptedData, iv, authTag, fileName || null, fileMimeType || null, fileSize || null);

  return findById(result.lastInsertRowid);
}

export function update(id, { name, encryptedData, iv, authTag, fileName, fileMimeType, fileSize }) {
  const fields = [];
  const values = [];

  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (encryptedData !== undefined) {
    fields.push('encrypted_data = ?'); values.push(encryptedData);
    fields.push('iv = ?'); values.push(iv);
    fields.push('auth_tag = ?'); values.push(authTag);
  }
  if (fileName !== undefined) { fields.push('file_name = ?'); values.push(fileName); }
  if (fileMimeType !== undefined) { fields.push('file_mime_type = ?'); values.push(fileMimeType); }
  if (fileSize !== undefined) { fields.push('file_size = ?'); values.push(fileSize); }

  if (fields.length === 0) return findById(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);

  getDb().prepare(`UPDATE vault_items SET ${fields.join(', ')} WHERE id = ? AND user_id = 1`).run(...values);
  return findById(id);
}

export function remove(id) {
  return getDb().prepare('DELETE FROM vault_items WHERE id = ? AND user_id = 1').run(id);
}

export function findByIds(ids) {
  if (!ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  return getDb().prepare(`SELECT * FROM vault_items WHERE id IN (${placeholders}) AND user_id = 1`).all(...ids);
}

export function getCountByType() {
  return getDb().prepare(`
    SELECT type, COUNT(*) as count FROM vault_items WHERE user_id = 1 GROUP BY type
  `).all();
}

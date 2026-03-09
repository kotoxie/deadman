import { getDb } from '../config/database.js';
import { encrypt, decrypt, getAppEncryptionKey } from '../services/crypto.js';
import config from '../config/index.js';

function getKey() {
  return getAppEncryptionKey(config.dbEncryptionKey);
}

export function get(key) {
  const row = getDb().prepare('SELECT * FROM settings WHERE key = ?').get(key);
  if (!row) return null;

  if (row.is_sensitive) {
    try {
      const parsed = JSON.parse(row.value);
      return decrypt(parsed.ciphertext, parsed.iv, parsed.authTag, getKey());
    } catch {
      return row.value;
    }
  }
  return row.value;
}

export function set(key, value, isSensitive = false) {
  let storedValue = value;

  if (isSensitive && value) {
    const encrypted = encrypt(value, getKey());
    storedValue = JSON.stringify(encrypted);
  }

  getDb().prepare(`
    INSERT INTO settings (key, value, is_sensitive, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = ?, is_sensitive = ?, updated_at = datetime('now')
  `).run(key, storedValue, isSensitive ? 1 : 0, storedValue, isSensitive ? 1 : 0);
}

export function getAll() {
  const rows = getDb().prepare('SELECT * FROM settings WHERE key NOT LIKE \'pause_%\'').all();
  const result = {};

  for (const row of rows) {
    if (row.is_sensitive) {
      result[row.key] = '********';
    } else {
      result[row.key] = row.value;
    }
  }
  return result;
}

export function getBulk(keys) {
  const result = {};
  for (const key of keys) {
    result[key] = get(key);
  }
  return result;
}

export function initializeSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checkin_interval_days INTEGER NOT NULL DEFAULT 14,
      grace_period_hours INTEGER NOT NULL DEFAULT 48,
      last_checkin_at TEXT NOT NULL DEFAULT (datetime('now')),
      next_deadline_at TEXT NOT NULL DEFAULT (datetime('now', '+14 days')),
      is_paused INTEGER NOT NULL DEFAULT 0,
      warning_schedule TEXT NOT NULL DEFAULT '[72,48,24,12,6,1]',
      master_key_salt TEXT NOT NULL DEFAULT '',
      master_key_check TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vault_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      type TEXT NOT NULL CHECK(type IN ('note','password','wallet','file','custom')),
      name TEXT NOT NULL,
      encrypted_data TEXT NOT NULL,
      iv TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      file_name TEXT,
      file_mime_type TEXT,
      file_size INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS recipients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      email TEXT,
      telegram_chat_id TEXT,
      webhook_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS recipient_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_id INTEGER NOT NULL,
      vault_item_id INTEGER NOT NULL,
      UNIQUE(recipient_id, vault_item_id),
      FOREIGN KEY (recipient_id) REFERENCES recipients(id) ON DELETE CASCADE,
      FOREIGN KEY (vault_item_id) REFERENCES vault_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS delivery_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_id INTEGER NOT NULL,
      vault_item_id INTEGER NOT NULL,
      method TEXT NOT NULL CHECK(method IN ('email','telegram','webhook')),
      status TEXT NOT NULL CHECK(status IN ('pending','success','failed','retrying')) DEFAULT 'pending',
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_attempt_at TEXT,
      error_message TEXT,
      triggered_by TEXT NOT NULL CHECK(triggered_by IN ('deadline','panic','manual_test')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (recipient_id) REFERENCES recipients(id) ON DELETE CASCADE,
      FOREIGN KEY (vault_item_id) REFERENCES vault_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      is_sensitive INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS warning_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      hours_before_deadline INTEGER NOT NULL,
      method TEXT NOT NULL CHECK(method IN ('email','telegram')),
      status TEXT NOT NULL CHECK(status IN ('sent','failed')),
      sent_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('auth','vault','recipient','delivery','settings','checkin','system')),
      severity TEXT NOT NULL CHECK(severity IN ('info','warning','critical')) DEFAULT 'info',
      details TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Ensure default user exists (single-user app)
  const user = db.prepare('SELECT id FROM users WHERE id = 1').get();
  if (!user) {
    db.prepare(`
      INSERT INTO users (id, checkin_interval_days, grace_period_hours, last_checkin_at, next_deadline_at)
      VALUES (1, 14, 48, datetime('now'), datetime('now', '+14 days'))
    `).run();
  }

  // Migration: add password columns if they don't exist
  try {
    db.prepare('SELECT password_hash FROM users LIMIT 1').get();
  } catch {
    db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
    db.exec('ALTER TABLE users ADD COLUMN password_changed INTEGER NOT NULL DEFAULT 0');
  }

  // Migration: session_version for session invalidation on password change
  try {
    db.prepare('SELECT session_version FROM users LIMIT 1').get();
  } catch {
    db.exec('ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0');
  }

  // Migration: ip_blocks table for persistent IP rate limiting
  db.exec(`
    CREATE TABLE IF NOT EXISTS ip_blocks (
      ip TEXT PRIMARY KEY,
      failures INTEGER NOT NULL DEFAULT 0,
      first_failure_at TEXT NOT NULL DEFAULT (datetime('now')),
      blocked_at TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// ─── Migration helpers ────────────────────────────────────────────
function hasColumn(db, table, col) {
  return db.prepare(`PRAGMA table_info("${table}")`).all().some(r => r.name === col);
}

// ─── Versioned migration registry ────────────────────────────────
const MIGRATIONS = [
  {
    version: 1, name: 'add_password_fields',
    up: (db) => {
      if (!hasColumn(db, 'users', 'password_hash')) {
        db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
        db.exec('ALTER TABLE users ADD COLUMN password_changed INTEGER NOT NULL DEFAULT 0');
      }
    }
  },
  {
    version: 2, name: 'add_session_version',
    up: (db) => {
      if (!hasColumn(db, 'users', 'session_version'))
        db.exec('ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0');
    }
  },
  {
    version: 3, name: 'add_ip_blocks_table',
    up: (db) => db.exec(`
      CREATE TABLE IF NOT EXISTS ip_blocks (
        ip TEXT PRIMARY KEY,
        failures INTEGER NOT NULL DEFAULT 0,
        first_failure_at TEXT NOT NULL DEFAULT (datetime('now')),
        blocked_at TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
  },
  {
    version: 4, name: 'add_auto_assign',
    up: (db) => {
      if (!hasColumn(db, 'recipients', 'auto_assign'))
        db.exec('ALTER TABLE recipients ADD COLUMN auto_assign INTEGER NOT NULL DEFAULT 0');
    }
  },
  {
    version: 5, name: 'add_delivery_triggered_at',
    up: (db) => {
      if (!hasColumn(db, 'users', 'delivery_triggered_at'))
        db.exec('ALTER TABLE users ADD COLUMN delivery_triggered_at TEXT');
    }
  },
  {
    version: 6, name: 'add_delivery_log_next_retry_at',
    up: (db) => {
      if (!hasColumn(db, 'delivery_logs', 'next_retry_at'))
        db.exec('ALTER TABLE delivery_logs ADD COLUMN next_retry_at TEXT');
    }
  },
  {
    version: 7, name: 'add_indexes',
    up: (db) => db.exec(`
      CREATE INDEX IF NOT EXISTS idx_vault_items_user_id ON vault_items(user_id);
      CREATE INDEX IF NOT EXISTS idx_recipients_user_id ON recipients(user_id);
      CREATE INDEX IF NOT EXISTS idx_delivery_logs_recipient_id ON delivery_logs(recipient_id);
      CREATE INDEX IF NOT EXISTS idx_delivery_logs_status ON delivery_logs(status);
      CREATE INDEX IF NOT EXISTS idx_warning_logs_user_id ON warning_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    `)
  },
];

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations').all().map(r => r.version)
  );

  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue;
    m.up(db);
    db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(m.version, m.name);
  }
}

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

  // Run all versioned migrations (idempotent — skips already-applied versions)
  runMigrations(db);
}

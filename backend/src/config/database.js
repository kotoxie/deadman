import initSqlJs from 'sql.js';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import config from './index.js';
import { initializeSchema } from '../models/schema.js';
import logger from '../utils/logger.js';

let db;
let dbPath;
let saveInterval;

// ─── Full-file AES-256-GCM encryption ─────────────────────────
// File format: IV (12 bytes) + authTag (16 bytes) + ciphertext
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const SQLITE_MAGIC = Buffer.from('SQLite format 3\0');

function deriveFileKey() {
  const salt = crypto.createHash('sha256').update('deadman-db-file-encryption').digest();
  return crypto.scryptSync(config.dbEncryptionKey, salt, 32, { N: 8192, r: 8, p: 1 });
}

function encryptDb(data) {
  const key = deriveFileKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

function decryptDb(fileBuffer) {
  const key = deriveFileKey();
  const iv = fileBuffer.subarray(0, IV_LENGTH);
  const authTag = fileBuffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = fileBuffer.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function isUnencryptedSqlite(buffer) {
  return buffer.length >= SQLITE_MAGIC.length &&
    buffer.subarray(0, SQLITE_MAGIC.length).equals(SQLITE_MAGIC);
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Wrapper that provides a better-sqlite3-like API on top of sql.js.
 */
class DbWrapper {
  constructor(sqlDb) {
    this._db = sqlDb;
  }

  exec(sql) {
    this._db.run(sql);
  }

  prepare(sql) {
    return new PreparedStatement(this._db, sql);
  }

  pragma(pragma) {
    try { this._db.run(`PRAGMA ${pragma}`); } catch { /* ignore */ }
  }

  transaction(fn) {
    return (...args) => {
      this._db.run('BEGIN');
      try {
        const result = fn(...args);
        this._db.run('COMMIT');
        return result;
      } catch (err) {
        this._db.run('ROLLBACK');
        throw err;
      }
    };
  }

  close() {
    this._db.close();
  }

  export() {
    return this._db.export();
  }
}

class PreparedStatement {
  constructor(sqlDb, sql) {
    this._db = sqlDb;
    this._sql = sql;
  }

  get(...params) {
    const stmt = this._db.prepare(this._sql);
    if (params.length) stmt.bind(params);
    if (stmt.step()) {
      const cols = stmt.getColumnNames();
      const vals = stmt.get();
      stmt.free();
      const row = {};
      cols.forEach((c, i) => row[c] = vals[i]);
      return row;
    }
    stmt.free();
    return undefined;
  }

  all(...params) {
    const results = [];
    const stmt = this._db.prepare(this._sql);
    if (params.length) stmt.bind(params);
    while (stmt.step()) {
      const cols = stmt.getColumnNames();
      const vals = stmt.get();
      const row = {};
      cols.forEach((c, i) => row[c] = vals[i]);
      results.push(row);
    }
    stmt.free();
    return results;
  }

  run(...params) {
    this._db.run(this._sql, params);
    const changes = this._db.getRowsModified();
    // Get last insert rowid
    let lastInsertRowid;
    try {
      const stmt = this._db.prepare('SELECT last_insert_rowid() as id');
      stmt.step();
      lastInsertRowid = stmt.get()[0];
      stmt.free();
    } catch { lastInsertRowid = 0; }
    return { changes, lastInsertRowid };
  }
}

export async function initDatabase() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  dbPath = path.join(config.dataDir, 'deadman.db');
  logger.info(`Opening database at ${dbPath}`);

  const SQL = await initSqlJs();

  let sqlDb;
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);

    if (isUnencryptedSqlite(fileBuffer)) {
      // Legacy unencrypted DB — load directly, next save will encrypt
      logger.warn('Detected unencrypted database — will encrypt on next save');
      sqlDb = new SQL.Database(fileBuffer);
    } else {
      // Encrypted DB — decrypt first
      const decrypted = decryptDb(fileBuffer);
      sqlDb = new SQL.Database(decrypted);
      logger.info('Database decrypted successfully');
    }
  } else {
    sqlDb = new SQL.Database();
  }

  db = new DbWrapper(sqlDb);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initializeSchema(db);

  // Auto-save (encrypted) to disk every 5 seconds
  saveInterval = setInterval(() => saveToDisk(), 5000);

  logger.info('Database initialized successfully');
  return db;
}

export function saveToDisk() {
  if (!db || !dbPath) return;
  try {
    const data = db.export();
    const encrypted = encryptDb(Buffer.from(data));
    fs.writeFileSync(dbPath, encrypted);
  } catch (err) {
    logger.error('Failed to save database:', err.message);
  }
}

export function closeDatabase() {
  if (saveInterval) clearInterval(saveInterval);
  if (db) {
    saveToDisk();
    db.close();
    db = null;
  }
}

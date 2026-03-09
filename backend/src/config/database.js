import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';
import config from './index.js';
import { initializeSchema } from '../models/schema.js';
import logger from '../utils/logger.js';

let db;
let dbPath;
let saveInterval;

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
    try {
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
    } catch (err) {
      throw err;
    }
  }

  all(...params) {
    const results = [];
    try {
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
    } catch (err) {
      throw err;
    }
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
    const buffer = fs.readFileSync(dbPath);
    sqlDb = new SQL.Database(buffer);
  } else {
    sqlDb = new SQL.Database();
  }

  db = new DbWrapper(sqlDb);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initializeSchema(db);

  // Auto-save to disk every 5 seconds
  saveInterval = setInterval(() => saveToDisk(), 5000);

  logger.info('Database initialized successfully');
  return db;
}

export function saveToDisk() {
  if (!db || !dbPath) return;
  try {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
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

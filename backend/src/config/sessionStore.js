import session from 'express-session';
import { getDb } from './database.js';
import logger from '../utils/logger.js';

const Store = session.Store;

/**
 * SQLite-backed session store using the existing sql.js database.
 * Eliminates the MemoryStore production warning and persists sessions
 * across container restarts (the DB is flushed to disk every 5 seconds).
 */
export class SQLiteSessionStore extends Store {
  constructor(options = {}) {
    super();
    this.ttl = options.ttl || 7 * 24 * 60 * 60; // seconds, default 7 days
    this._ensureTable();
    // Prune expired sessions periodically
    this._pruneInterval = setInterval(() => this._prune(), 15 * 60 * 1000);
    this._pruneInterval.unref?.();
  }

  _db() {
    return getDb();
  }

  _ensureTable() {
    this._db().exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    `);
  }

  _prune() {
    try {
      const now = Math.floor(Date.now() / 1000);
      this._db().prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
    } catch (err) {
      logger.debug('Session prune failed:', err.message);
    }
  }

  get(sid, cb) {
    try {
      const now = Math.floor(Date.now() / 1000);
      const row = this._db()
        .prepare('SELECT data FROM sessions WHERE sid = ? AND expires_at > ?')
        .get(sid, now);
      if (!row) return cb(null, null);
      cb(null, JSON.parse(row.data));
    } catch (err) {
      cb(err);
    }
  }

  set(sid, sessionData, cb) {
    try {
      const ttl = sessionData?.cookie?.maxAge
        ? Math.floor(sessionData.cookie.maxAge / 1000)
        : this.ttl;
      const expires = Math.floor(Date.now() / 1000) + ttl;
      const data = JSON.stringify(sessionData);
      this._db()
        .prepare('INSERT OR REPLACE INTO sessions (sid, data, expires_at) VALUES (?, ?, ?)')
        .run(sid, data, expires);
      cb(null);
    } catch (err) {
      cb(err);
    }
  }

  touch(sid, sessionData, cb) {
    try {
      const ttl = sessionData?.cookie?.maxAge
        ? Math.floor(sessionData.cookie.maxAge / 1000)
        : this.ttl;
      const expires = Math.floor(Date.now() / 1000) + ttl;
      this._db()
        .prepare('UPDATE sessions SET expires_at = ? WHERE sid = ?')
        .run(expires, sid);
      cb(null);
    } catch (err) {
      cb(err);
    }
  }

  destroy(sid, cb) {
    try {
      this._db().prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      cb(null);
    } catch (err) {
      cb(err);
    }
  }

  close() {
    clearInterval(this._pruneInterval);
  }
}

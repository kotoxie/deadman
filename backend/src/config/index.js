import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const { version } = JSON.parse(
  readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')
);

// ─── Resolve data directory early (needed for secret file) ────────────────
const dataDir = path.resolve(process.env.DATA_DIR || path.join(__dirname, '../../data'));

// ─── Session secret — load from file or generate once ────────────────────
// If SESSION_SECRET env var is set it takes precedence (backward-compat).
// Otherwise we persist a 64-byte hex secret in DATA_DIR/session.secret.
// The file is created with mode 0o600 (owner-read-only).
function resolveSessionSecret() {
  if (process.env.SESSION_SECRET) {
    if (process.env.SESSION_SECRET.length < 32) {
      console.error('FATAL: SESSION_SECRET env var must be at least 32 characters.');
      process.exit(1);
    }
    return process.env.SESSION_SECRET;
  }

  const secretFile = path.join(dataDir, 'session.secret');
  if (existsSync(secretFile)) {
    const secret = readFileSync(secretFile, 'utf8').trim();
    if (secret.length >= 64) return secret;
    // File exists but is too short — regenerate
    console.warn('session.secret file is too short — regenerating');
  }

  mkdirSync(dataDir, { recursive: true });
  const secret = crypto.randomBytes(64).toString('hex'); // 128 hex chars
  writeFileSync(secretFile, secret, { mode: 0o600, encoding: 'utf8' });
  console.log(`Generated session secret → ${secretFile}`);
  return secret;
}

// ─── Require all security-critical env vars (no defaults) ─────────────────
const WEAK_PASSWORDS = ['admin', 'admin123', 'password', 'password123', '12345678',
  'change_me_to_a_strong_password'];

const required = ['MASTER_PASSWORD', 'DB_ENCRYPTION_KEY'];
const missing = required.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
  console.error('Copy .env.example to .env and set all values before starting.');
  process.exit(1);
}
if (WEAK_PASSWORDS.includes(process.env.MASTER_PASSWORD)) {
  console.error('FATAL: MASTER_PASSWORD is too weak or is a known default. Choose a strong, unique password.');
  process.exit(1);
}
if (process.env.DB_ENCRYPTION_KEY.length < 32) {
  console.error('FATAL: DB_ENCRYPTION_KEY must be at least 32 characters. Use: openssl rand -hex 32');
  process.exit(1);
}

const sessionSecret = resolveSessionSecret();

const config = Object.freeze({
  version,
  repoUrl: 'https://github.com/kotoxie/deadman',
  port: parseInt(process.env.PORT || '6680', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  dataDir,
  masterPassword: process.env.MASTER_PASSWORD,
  sessionSecret,
  dbEncryptionKey: process.env.DB_ENCRYPTION_KEY,
  // Optional: paths to a custom TLS cert/key. If not set, a self-signed cert is auto-generated.
  tlsCertPath: process.env.TLS_CERT_PATH || null,
  tlsKeyPath:  process.env.TLS_KEY_PATH  || null,
});

export default config;

import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// ─── Require all security-critical env vars (no defaults, no dev mode) ───
const WEAK_PASSWORDS = ['admin', 'admin123', 'password', 'password123', '12345678',
  'change_me_to_a_strong_password'];

const required = ['MASTER_PASSWORD', 'SESSION_SECRET', 'DB_ENCRYPTION_KEY'];
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
if (process.env.SESSION_SECRET.length < 32) {
  console.error('FATAL: SESSION_SECRET must be at least 32 characters. Use: openssl rand -hex 32');
  process.exit(1);
}
if (process.env.DB_ENCRYPTION_KEY.length < 32) {
  console.error('FATAL: DB_ENCRYPTION_KEY must be at least 32 characters. Use: openssl rand -hex 32');
  process.exit(1);
}

const config = Object.freeze({
  version: '0.2.9',
  repoUrl: 'https://github.com/kotoxie/deadman',
  port: parseInt(process.env.PORT || '6680', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  secureCookies: process.env.SECURE_COOKIES === 'true',
  dataDir: path.resolve(process.env.DATA_DIR || path.join(__dirname, '../../data')),
  masterPassword: process.env.MASTER_PASSWORD,
  sessionSecret: process.env.SESSION_SECRET,
  dbEncryptionKey: process.env.DB_ENCRYPTION_KEY,
});

export default config;

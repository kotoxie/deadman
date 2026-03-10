import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const isDev = nodeEnv === 'development';

// In production, require all security-critical env vars
if (!isDev) {
  const required = ['MASTER_PASSWORD', 'SESSION_SECRET', 'DB_ENCRYPTION_KEY'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error(`FATAL: Missing required env vars in production: ${missing.join(', ')}`);
    process.exit(1);
  }
  if (process.env.MASTER_PASSWORD === 'admin' || process.env.MASTER_PASSWORD === 'admin123') {
    console.error('FATAL: MASTER_PASSWORD must be changed from default value in production');
    process.exit(1);
  }
}

const config = Object.freeze({
  version: '0.2.5',
  repoUrl: 'https://github.com/kotoxie/deadman',
  port: parseInt(process.env.PORT || '6680', 10),
  nodeEnv,
  isDev,
  secureCookies: process.env.SECURE_COOKIES !== undefined
    ? process.env.SECURE_COOKIES === 'true'
    : !isDev,
  dataDir: path.resolve(process.env.DATA_DIR || path.join(__dirname, '../../data')),
  masterPassword: process.env.MASTER_PASSWORD || 'admin',
  sessionSecret: process.env.SESSION_SECRET || 'dev-session-fallback',
  dbEncryptionKey: process.env.DB_ENCRYPTION_KEY || 'dev-encryption-key-change-in-production',
});

export default config;

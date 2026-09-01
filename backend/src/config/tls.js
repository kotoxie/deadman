/**
 * TLS certificate loader / generator.
 *
 * Priority:
 *  1. Custom cert — TLS_CERT_PATH + TLS_KEY_PATH both set → load from disk, no generation
 *  2. Auto-generated self-signed cert — stored in DATA_DIR/tls/ and reused across restarts
 *     Regenerated automatically when expiry is within 30 days.
 */

import fs from 'fs';
import path from 'path';
import selfsigned from 'selfsigned';
import logger from '../utils/logger.js';

const CERT_VALIDITY_DAYS = 365;
const RENEW_WITHIN_DAYS  = 30;

function certExpiresSoon(certPem) {
  try {
    // Extract the validity period from the PEM using a regex on the raw DER bytes.
    // We use a lightweight approach: parse the notAfter field from the decoded cert.
    // Node 22+ has X509Certificate; for compatibility we use a date heuristic instead:
    // re-generate if the file is older than (CERT_VALIDITY_DAYS - RENEW_WITHIN_DAYS) days.
    const stat = fs.statSync(certPem);
    const ageMs = Date.now() - stat.mtimeMs;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    return ageDays > (CERT_VALIDITY_DAYS - RENEW_WITHIN_DAYS);
  } catch {
    return true;
  }
}

async function generateSelfSigned(tlsDir) {
  fs.mkdirSync(tlsDir, { recursive: true });

  const attrs = [
    { name: 'commonName', value: 'deadman-switch' },
    { name: 'organizationName', value: 'Dead Man\'s Switch' },
  ];
  const opts = {
    keySize: 2048,
    notAfterDate: new Date(Date.now() + CERT_VALIDITY_DAYS * 24 * 60 * 60 * 1000),
    algorithm: 'sha256',
    extensions: [
      { name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }, { type: 7, ip: '127.0.0.1' }] },
    ],
  };

  const pems = await selfsigned.generate(attrs, opts);
  const certPath = path.join(tlsDir, 'cert.pem');
  const keyPath  = path.join(tlsDir, 'key.pem');

  fs.writeFileSync(certPath, pems.cert, { mode: 0o644 });
  fs.writeFileSync(keyPath,  pems.private, { mode: 0o600 });

  logger.info(`Generated self-signed TLS certificate (valid ${CERT_VALIDITY_DAYS} days) → ${tlsDir}`);
  return { cert: pems.cert, key: pems.private };
}

export async function loadTlsCredentials(dataDir) {
  const customCert = process.env.TLS_CERT_PATH;
  const customKey  = process.env.TLS_KEY_PATH;

  // ── Custom certificate ─────────────────────────────────────────
  if (customCert && customKey) {
    if (!fs.existsSync(customCert)) throw new Error(`TLS_CERT_PATH not found: ${customCert}`);
    if (!fs.existsSync(customKey))  throw new Error(`TLS_KEY_PATH not found: ${customKey}`);
    logger.info(`Using custom TLS certificate: ${customCert}`);
    return {
      cert: fs.readFileSync(customCert, 'utf8'),
      key:  fs.readFileSync(customKey,  'utf8'),
    };
  }

  // ── Auto-generated self-signed cert ───────────────────────────
  const tlsDir  = path.join(dataDir, 'tls');
  const certPath = path.join(tlsDir, 'cert.pem');
  const keyPath  = path.join(tlsDir, 'key.pem');

  const exists = fs.existsSync(certPath) && fs.existsSync(keyPath);

  if (exists && !certExpiresSoon(certPath)) {
    logger.info('Loaded existing self-signed TLS certificate');
    return {
      cert: fs.readFileSync(certPath, 'utf8'),
      key:  fs.readFileSync(keyPath,  'utf8'),
    };
  }

  if (exists) {
    logger.warn('TLS certificate expiring soon — regenerating');
  }

  return await generateSelfSigned(tlsDir);
}

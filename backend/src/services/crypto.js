import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

/**
 * Derive a 32-byte encryption key from a password string using scrypt.
 */
export function deriveKey(password, salt) {
  const saltBuf = typeof salt === 'string' ? Buffer.from(salt, 'hex') : salt;
  return crypto.scryptSync(password, saltBuf, KEY_LENGTH, { N: 8192, r: 8, p: 1 });
}

export function generateSalt() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Encrypt plaintext string with AES-256-GCM.
 * Returns { ciphertext, iv, authTag } all as hex strings.
 */
export function encrypt(plaintext, keyBuffer) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);

  const data = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return {
    ciphertext: encrypted,
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
  };
}

/**
 * Decrypt ciphertext with AES-256-GCM.
 * Returns plaintext string.
 */
export function decrypt(ciphertext, iv, authTag, keyBuffer) {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    keyBuffer,
    Buffer.from(iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Encrypt a Buffer (for files).
 */
export function encryptBuffer(buffer, keyBuffer) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);

  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);

  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
  };
}

/**
 * Decrypt a base64 ciphertext back to Buffer (for files).
 */
export function decryptBuffer(ciphertext, iv, authTag, keyBuffer) {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    keyBuffer,
    Buffer.from(iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]);
}

/**
 * Get or create the app encryption key (derived from DB_ENCRYPTION_KEY env).
 * Used for encrypting vault items and sensitive settings.
 */
let _appKey = null;
let _appSalt = null;

export function getAppEncryptionKey(dbEncryptionKey) {
  if (!_appKey) {
    _appSalt = crypto.createHash('sha256').update(dbEncryptionKey).digest('hex').slice(0, 64);
    _appKey = deriveKey(dbEncryptionKey, _appSalt);
  }
  return _appKey;
}

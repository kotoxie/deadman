import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import * as VaultItem from '../models/VaultItem.js';
import { encrypt, decrypt, encryptBuffer, decryptBuffer, getAppEncryptionKey } from '../services/crypto.js';
import config from '../config/index.js';
import * as AuditLog from '../models/AuditLog.js';
import { addItemToAutoAssignRecipients } from '../models/Recipient.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

/**
 * Sanitize an uploaded filename:
 *  - Strip any path component (prevents path traversal in email attachments)
 *  - Remove null bytes and control characters
 *  - Replace remaining slashes/backslashes
 *  - Cap at 255 characters
 */
function sanitizeFileName(name) {
  return path.basename(name)
    .replace(/[\x00-\x1f\x7f]/g, '')  // strip control chars & null bytes
    .replace(/[/\\]/g, '_')            // replace any residual slashes
    .slice(0, 255)
    || 'file';
}

function getKey() {
  return getAppEncryptionKey(config.dbEncryptionKey);
}

// List all vault items (metadata only)
router.get('/', (req, res) => {
  const items = VaultItem.findAll();
  res.json(items);
});

// Get single item with decrypted content
router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
  const item = VaultItem.findById(id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  try {
    const key = getKey();
    if (item.type === 'file') {
      const fileBuffer = decryptBuffer(item.encrypted_data, item.iv, item.auth_tag, key);
      res.json({
        ...item,
        encrypted_data: undefined,
        iv: undefined,
        auth_tag: undefined,
        content: fileBuffer.toString('base64'),
        isFile: true,
      });
    } else {
      const plaintext = decrypt(item.encrypted_data, item.iv, item.auth_tag, key);
      res.json({
        ...item,
        encrypted_data: undefined,
        iv: undefined,
        auth_tag: undefined,
        content: JSON.parse(plaintext),
      });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to decrypt item' });
  }
});

// Create vault item
router.post('/', upload.single('file'), (req, res) => {
  const { type, name } = req.body;
  if (!type || !name) return res.status(400).json({ error: 'type and name are required' });

  const key = getKey();
  let encrypted, fileName, fileMimeType, fileSize;

  if (type === 'file') {
    if (!req.file) return res.status(400).json({ error: 'File is required' });
    encrypted = encryptBuffer(req.file.buffer, key);
    fileName = sanitizeFileName(req.file.originalname);
    fileMimeType = req.file.mimetype; // stored as-is; not used for security decisions
    fileSize = req.file.size;
  } else {
    let content;
    if (typeof req.body.content === 'string') {
      try { content = JSON.parse(req.body.content); } catch { content = req.body.content; }
    } else {
      content = req.body.content;
    }
    if (!content) return res.status(400).json({ error: 'content is required' });
    encrypted = encrypt(JSON.stringify(content), key);
  }

  const item = VaultItem.create({
    type,
    name,
    encryptedData: encrypted.ciphertext,
    iv: encrypted.iv,
    authTag: encrypted.authTag,
    fileName,
    fileMimeType,
    fileSize,
  });

  addItemToAutoAssignRecipients(item.id);
  AuditLog.log(`Vault item created: "${name}"`, 'vault', 'info', JSON.stringify({ id: item.id, type }), req.ip);
  res.status(201).json({ id: item.id, type: item.type, name: item.name, created_at: item.created_at });
});

// Update vault item
router.put('/:id', upload.single('file'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
  const existing = VaultItem.findById(id);
  if (!existing) return res.status(404).json({ error: 'Item not found' });

  const key = getKey();
  const updates = {};

  if (req.body.name) updates.name = req.body.name;

  if (existing.type === 'file' && req.file) {
    const encrypted = encryptBuffer(req.file.buffer, key);
    Object.assign(updates, {
      encryptedData: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      fileName: sanitizeFileName(req.file.originalname),
      fileMimeType: req.file.mimetype, // stored as-is; not used for security decisions
      fileSize: req.file.size,
    });
  } else if (req.body.content) {
    let content = req.body.content;
    if (typeof content === 'string') {
      try { content = JSON.parse(content); } catch { /* keep as string */ }
    }
    const encrypted = encrypt(JSON.stringify(content), key);
    Object.assign(updates, {
      encryptedData: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
    });
  }

  const item = VaultItem.update(id, updates);
  AuditLog.log(`Vault item updated: "${item.name}"`, 'vault', 'info', JSON.stringify({ id }), req.ip);
  res.json({ id: item.id, type: item.type, name: item.name, updated_at: item.updated_at });
});

// Delete vault item
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
  const result = VaultItem.remove(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Item not found' });
  AuditLog.log(`Vault item deleted`, 'vault', 'warning', JSON.stringify({ id }), req.ip);
  res.json({ success: true });
});

export default router;

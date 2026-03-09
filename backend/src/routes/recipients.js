import { Router } from 'express';
import * as Recipient from '../models/Recipient.js';
import { sendTestDelivery } from '../services/deliveryService.js';
import * as AuditLog from '../models/AuditLog.js';

const router = Router();

router.get('/', (req, res) => {
  res.json(Recipient.findAll());
});

router.get('/:id', (req, res) => {
  const recipient = Recipient.findById(parseInt(req.params.id));
  if (!recipient) return res.status(404).json({ error: 'Recipient not found' });
  res.json(recipient);
});

router.post('/', (req, res) => {
  const { name, email, telegramChatId, webhookUrl } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (!email && !telegramChatId && !webhookUrl) {
    return res.status(400).json({ error: 'At least one delivery method is required' });
  }

  const recipient = Recipient.create({ name, email, telegramChatId, webhookUrl });
  AuditLog.log(`Recipient created: "${name}"`, 'recipient', 'info', JSON.stringify({ id: recipient.id }), req.ip);
  res.status(201).json(recipient);
});

router.put('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  const existing = Recipient.findById(id);
  if (!existing) return res.status(404).json({ error: 'Recipient not found' });

  // Whitelist allowed fields to prevent mass assignment
  const allowed = ['name', 'email', 'telegramChatId', 'webhookUrl'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  const recipient = Recipient.update(id, updates);
  AuditLog.log(`Recipient updated: "${recipient.name}"`, 'recipient', 'info', JSON.stringify({ id }), req.ip);
  res.json(recipient);
});

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const result = Recipient.remove(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Recipient not found' });
  AuditLog.log(`Recipient deleted`, 'recipient', 'warning', JSON.stringify({ id }), req.ip);
  res.json({ success: true });
});

// Assign vault items to recipient
router.post('/:id/assign', (req, res) => {
  const id = parseInt(req.params.id);
  const { itemIds } = req.body;
  if (!Array.isArray(itemIds)) return res.status(400).json({ error: 'itemIds must be an array' });

  const existing = Recipient.findById(id);
  if (!existing) return res.status(404).json({ error: 'Recipient not found' });

  const recipient = Recipient.assignItems(id, itemIds);
  AuditLog.log(`Items assigned to recipient "${existing.name}"`, 'recipient', 'info', JSON.stringify({ recipientId: id, itemIds }), req.ip);
  res.json(recipient);
});

// Test delivery
router.post('/:id/test', async (req, res) => {
  const id = parseInt(req.params.id);
  const recipient = Recipient.findById(id);
  if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

  try {
    const results = await sendTestDelivery(recipient);
    AuditLog.log(`Test delivery sent to "${recipient.name}"`, 'delivery', 'info', JSON.stringify({ recipientId: id }), req.ip);
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: 'Test delivery failed', details: err.message });
  }
});

export default router;

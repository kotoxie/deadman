import { Router } from 'express';
import * as User from '../models/User.js';
import * as WarningLog from '../models/WarningLog.js';
import { triggerAllDeliveries } from '../services/deliveryService.js';
import logger from '../utils/logger.js';
import * as AuditLog from '../models/AuditLog.js';

const router = Router();

// Check in - reset countdown
router.post('/', (req, res) => {
  const user = User.updateCheckin();
  WarningLog.clearRecent();
  logger.info('User checked in, deadline reset');
  AuditLog.log('Check-in performed, deadline reset', 'checkin', 'info', null, req.ip);
  res.json({
    success: true,
    nextDeadlineAt: user.next_deadline_at,
    lastCheckinAt: user.last_checkin_at,
  });
});

// Panic - immediately trigger all deliveries
router.post('/panic', async (req, res) => {
  const confirm = req.headers['x-confirm'];
  if (confirm !== 'DELIVER') {
    return res.status(400).json({ error: 'Must send X-Confirm: DELIVER header' });
  }

  logger.warn('PANIC triggered - delivering all items');
  AuditLog.log('PANIC triggered - immediate delivery initiated', 'checkin', 'critical', null, req.ip);
  try {
    const results = await triggerAllDeliveries('panic');
    res.json({ success: true, results });
  } catch (err) {
    logger.error('Panic delivery failed', err);
    res.status(500).json({ error: 'Delivery failed', details: err.message });
  }
});

// Toggle pause
router.post('/pause', (req, res) => {
  const { paused } = req.body;
  if (typeof paused !== 'boolean') {
    return res.status(400).json({ error: 'paused must be a boolean' });
  }

  const user = User.togglePause(paused);
  logger.info(`Dead man's switch ${paused ? 'PAUSED' : 'RESUMED'}`);
  AuditLog.log(`Switch ${paused ? 'paused' : 'resumed'}`, 'checkin', paused ? 'warning' : 'info', null, req.ip);
  res.json({
    success: true,
    isPaused: !!user.is_paused,
    nextDeadlineAt: user.next_deadline_at,
  });
});

export default router;

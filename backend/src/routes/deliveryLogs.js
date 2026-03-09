import { Router } from 'express';
import * as DeliveryLog from '../models/DeliveryLog.js';
import { retryDelivery } from '../services/deliveryService.js';

const router = Router();

router.get('/', (req, res) => {
  const { status, method, limit = 50, offset = 0 } = req.query;
  const result = DeliveryLog.findAll({
    status,
    method,
    limit: parseInt(limit),
    offset: parseInt(offset),
  });
  res.json(result);
});

router.post('/:id/retry', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const result = await retryDelivery(id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

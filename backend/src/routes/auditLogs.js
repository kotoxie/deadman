import { Router } from 'express';
import * as AuditLog from '../models/AuditLog.js';

const router = Router();

router.get('/', (req, res) => {
  const { category, severity, limit = 50, offset = 0 } = req.query;
  const result = AuditLog.findAll({
    category,
    severity,
    limit: Math.min(parseInt(limit, 10) || 50, 200),
    offset: parseInt(offset, 10) || 0,
  });
  res.json(result);
});

export default router;

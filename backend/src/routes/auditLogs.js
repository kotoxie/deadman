import { Router } from 'express';
import * as AuditLog from '../models/AuditLog.js';

const router = Router();

router.get('/', (req, res) => {
  const { category, severity, search, limit = 50, offset = 0 } = req.query;
  const result = AuditLog.findAll({
    category,
    severity,
    // Cap search to 200 chars to prevent expensive LIKE DoS patterns
    search: search ? String(search).slice(0, 200) : undefined,
    limit: Math.min(parseInt(limit, 10) || 50, 200),
    offset: Math.max(parseInt(offset, 10) || 0, 0),
  });
  res.json(result);
});

export default router;

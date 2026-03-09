import { Router } from 'express';
import * as User from '../models/User.js';
import * as VaultItem from '../models/VaultItem.js';
import * as Recipient from '../models/Recipient.js';
import * as DeliveryLog from '../models/DeliveryLog.js';

const router = Router();

router.get('/', (req, res) => {
  const user = User.getUser();
  const itemCounts = VaultItem.getCountByType();
  const recipients = Recipient.findAll();
  const recentLogs = DeliveryLog.getRecent(5);
  const stats = DeliveryLog.getStats();

  const now = Date.now();
  const raw = user.next_deadline_at;
  const deadline = new Date(raw.endsWith('Z') ? raw : raw + 'Z').getTime();
  const remainingMs = Math.max(0, deadline - now);

  res.json({
    checkin: {
      lastCheckinAt: user.last_checkin_at,
      nextDeadlineAt: user.next_deadline_at,
      intervalDays: user.checkin_interval_days,
      gracePeriodHours: user.grace_period_hours,
      isPaused: !!user.is_paused,
      remainingMs,
      warningSchedule: JSON.parse(user.warning_schedule),
    },
    vault: {
      totalItems: itemCounts.reduce((sum, c) => sum + c.count, 0),
      byType: Object.fromEntries(itemCounts.map(c => [c.type, c.count])),
    },
    recipients: {
      total: recipients.length,
    },
    deliveryStats: Object.fromEntries(stats.map(s => [s.status, s.count])),
    recentLogs,
  });
});

export default router;

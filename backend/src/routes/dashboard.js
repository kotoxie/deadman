import { Router } from 'express';
import * as User from '../models/User.js';
import * as VaultItem from '../models/VaultItem.js';
import * as Recipient from '../models/Recipient.js';
import * as DeliveryLog from '../models/DeliveryLog.js';
import * as Setting from '../models/Setting.js';
import { getDb } from '../config/database.js';

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

  // ── Health checks ──────────────────────────────────────────────
  const warnings = [];

  // Recipients with no items assigned
  for (const r of recipients) {
    if (r.item_count === 0) {
      warnings.push({ type: 'recipient_no_items', message: `"${r.name}" has no items assigned`, link: `/recipients/${r.id}` });
    }
  }

  // Vault items assigned to no recipients
  const orphanedItems = getDb().prepare(`
    SELECT id, name FROM vault_items
    WHERE user_id = 1 AND id NOT IN (SELECT vault_item_id FROM recipient_items)
    ORDER BY name
  `).all();
  for (const item of orphanedItems) {
    warnings.push({ type: 'item_no_recipient', message: `"${item.name}" is not assigned to any recipient`, link: `/vault/${item.id}` });
  }

  // No admin notification channels configured (warnings won't be delivered to owner)
  const adminEmail    = Setting.get('admin_notify_email');
  const adminTelegram = Setting.get('admin_notify_telegram_chat_id');
  if (!adminEmail && !adminTelegram) {
    warnings.push({ type: 'no_admin_notifications', message: 'No admin notification email or Telegram configured — you won\'t receive check-in reminders', link: '/settings/notifications' });
  }

  // No delivery channels configured at all (SMTP or Telegram)
  const smtpHost      = Setting.get('smtp_host');
  const telegramToken = Setting.get('telegram_bot_token');
  if (!smtpHost && !telegramToken) {
    warnings.push({ type: 'no_delivery_channel', message: 'No delivery channel configured (no SMTP, no Telegram) — recipients cannot be reached', link: '/settings/smtp' });
  }

  // No recipients at all
  if (recipients.length === 0) {
    warnings.push({ type: 'no_recipients', message: 'No recipients configured — nothing will be delivered when the switch fires', link: '/recipients' });
  }

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
    health: { warnings },
  });
});

export default router;

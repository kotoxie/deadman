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

  // ── Settings snapshot ───────────────────────────────────────────
  const smtpHost      = Setting.get('smtp_host');
  const smtpFrom      = Setting.get('smtp_from');
  const telegramToken = Setting.get('telegram_bot_token');
  const adminEmail    = Setting.get('admin_notify_email');
  const adminTelegram = Setting.get('admin_notify_telegram_chat_id');
  const warningSchedule = JSON.parse(user.warning_schedule || '[]');
  const totalVaultItems = itemCounts.reduce((sum, c) => sum + c.count, 0);

  // Recipient delivery method breakdown
  const emailRecipients   = recipients.filter(r => r.method === 'email');
  const tgRecipients      = recipients.filter(r => r.method === 'telegram');

  // Vault items not assigned to any recipient
  const orphanedItems = getDb().prepare(`
    SELECT id, name FROM vault_items
    WHERE user_id = 1 AND id NOT IN (SELECT vault_item_id FROM recipient_items)
    ORDER BY name
  `).all();

  // ── Health warnings ─────────────────────────────────────────────
  const warnings = [];
  const push = (severity, category, type, message, detail, link, action) =>
    warnings.push({ severity, category, type, message, detail, link, action });

  // ── CRITICAL ───────────────────────────────────────────────────
  if (!smtpHost && !telegramToken) {
    push('critical', 'delivery', 'no_delivery_channel',
      'No delivery channel configured',
      'Recipients cannot receive vault items. Configure SMTP or Telegram to enable delivery.',
      '/settings/smtp', 'Configure SMTP');
  } else {
    // Only show specific channel gaps when at least one channel exists
    if (!smtpHost && emailRecipients.length > 0) {
      const names = emailRecipients.map(r => r.name).join(', ');
      push('critical', 'delivery', 'email_no_smtp',
        `${emailRecipients.length} email recipient${emailRecipients.length > 1 ? 's' : ''} but no SMTP configured`,
        `These recipients cannot be reached: ${names}`,
        '/settings/smtp', 'Configure SMTP');
    }
    if (!telegramToken && tgRecipients.length > 0) {
      const names = tgRecipients.map(r => r.name).join(', ');
      push('critical', 'delivery', 'telegram_no_bot',
        `${tgRecipients.length} Telegram recipient${tgRecipients.length > 1 ? 's' : ''} but no bot configured`,
        `These recipients cannot be reached: ${names}`,
        '/settings/telegram', 'Configure Telegram');
    }
  }

  if (totalVaultItems === 0) {
    push('critical', 'vault', 'no_vault_items',
      'Vault is empty — nothing to deliver',
      'Add notes, passwords, files, wallet keys or custom secrets to your vault.',
      '/vault/new', 'Add Vault Item');
  }

  if (recipients.length === 0) {
    push('critical', 'recipients', 'no_recipients',
      'No recipients configured',
      'Nobody will receive vault items when the switch fires. Add at least one recipient.',
      '/recipients/new', 'Add Recipient');
  }

  // ── WARNING ────────────────────────────────────────────────────
  for (const r of recipients) {
    if (r.item_count === 0) {
      push('warning', 'recipients', 'recipient_no_items',
        `"${r.name}" has no items assigned`,
        'This recipient will receive nothing when the switch fires.',
        `/recipients/${r.id}`, 'Assign Items');
    }
  }

  for (const item of orphanedItems) {
    push('warning', 'vault', 'item_no_recipient',
      `"${item.name}" is not assigned to any recipient`,
      'This item exists in the vault but will never be delivered.',
      `/vault/${item.id}`, 'Assign Recipient');
  }

  if (!adminEmail && !adminTelegram) {
    push('warning', 'notifications', 'no_admin_notifications',
      'No admin notification channel configured',
      "You won't receive check-in reminders or deadline warnings. Configure at least one notification method.",
      '/settings/notifications', 'Configure');
  }

  if (!user.password_changed) {
    push('warning', 'security', 'default_password',
      'Default password has not been changed',
      'You are still using the initial password. Change it immediately to protect your vault.',
      '/settings/security', 'Change Password');
  }

  if (warningSchedule.length === 0) {
    push('warning', 'checkin', 'empty_warning_schedule',
      'No check-in reminders configured',
      "You won't receive any warnings before the delivery deadline fires.",
      '/settings/checkin', 'Configure Reminders');
  }

  // ── INFO ───────────────────────────────────────────────────────
  if (smtpHost && !smtpFrom) {
    push('info', 'delivery', 'smtp_no_from',
      'SMTP configured but no sender address set',
      'Emails may be rejected or flagged without a valid "From" address.',
      '/settings/smtp', 'Set From Address');
  }

  if (adminEmail && !adminTelegram && telegramToken) {
    push('info', 'notifications', 'single_notification_channel',
      'Only email configured for admin notifications',
      'Adding Telegram as a backup ensures you get reminded even if email fails.',
      '/settings/notifications', 'Add Telegram');
  }

  if (user.grace_period_hours < 1) {
    push('info', 'checkin', 'short_grace_period',
      `Grace period is very short (${user.grace_period_hours}h)`,
      'A short grace period leaves little time for delivery retries if something goes wrong.',
      '/settings/checkin', 'Adjust Settings');
  }

  // Sort: critical → warning → info
  const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };
  warnings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  // ── Setup checklist ─────────────────────────────────────────────
  const allItemsAssigned = orphanedItems.length === 0 && totalVaultItems > 0;
  const allRecipientsHaveItems = recipients.length > 0 && recipients.every(r => r.item_count > 0);

  const setupSteps = [
    {
      id: 'delivery_channel',
      label: 'Configure a delivery channel (SMTP or Telegram)',
      done: !!(smtpHost || telegramToken),
      link: '/settings/smtp',
      action: 'Configure SMTP',
    },
    {
      id: 'change_password',
      label: 'Change the default password',
      done: !!user.password_changed,
      link: '/settings/security',
      action: 'Change Password',
    },
    {
      id: 'add_vault_items',
      label: 'Add at least one vault item',
      done: totalVaultItems > 0,
      link: '/vault/new',
      action: 'Add Item',
    },
    {
      id: 'add_recipients',
      label: 'Add at least one recipient',
      done: recipients.length > 0,
      link: '/recipients/new',
      action: 'Add Recipient',
    },
    {
      id: 'assign_items',
      label: 'Assign vault items to all recipients',
      done: allItemsAssigned && allRecipientsHaveItems,
      link: '/recipients',
      action: 'Manage Recipients',
    },
    {
      id: 'admin_notifications',
      label: 'Configure admin notifications',
      done: !!(adminEmail || adminTelegram),
      link: '/settings/notifications',
      action: 'Configure',
    },
    {
      id: 'warning_schedule',
      label: 'Set up check-in reminder schedule',
      done: warningSchedule.length > 0,
      link: '/settings/checkin',
      action: 'Configure',
    },
  ];

  const completedSteps = setupSteps.filter(s => s.done).length;
  const score = Math.round((completedSteps / setupSteps.length) * 100);

  res.json({
    checkin: {
      lastCheckinAt: user.last_checkin_at,
      nextDeadlineAt: user.next_deadline_at,
      intervalDays: user.checkin_interval_days,
      gracePeriodHours: user.grace_period_hours,
      isPaused: !!user.is_paused,
      remainingMs,
      warningSchedule,
    },
    vault: {
      totalItems: totalVaultItems,
      byType: Object.fromEntries(itemCounts.map(c => [c.type, c.count])),
    },
    recipients: {
      total: recipients.length,
    },
    deliveryStats: Object.fromEntries(stats.map(s => [s.status, s.count])),
    recentLogs,
    health: {
      score,
      warnings,
      setup: { score, completed: completedSteps, total: setupSteps.length, steps: setupSteps },
    },
  });
});

export default router;

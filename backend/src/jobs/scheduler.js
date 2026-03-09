import cron from 'node-cron';
import * as User from '../models/User.js';
import * as WarningLog from '../models/WarningLog.js';
import * as AuditLog from '../models/AuditLog.js';
import { triggerAllDeliveries, processRetryQueue } from '../services/deliveryService.js';
import { sendWarningEmail, isConfigured as emailConfigured } from '../services/emailService.js';
import { sendWarningTelegram, isConfigured as telegramConfigured } from '../services/telegramService.js';
import * as Setting from '../models/Setting.js';
import logger from '../utils/logger.js';

export function startScheduler() {
  // Check deadline every minute
  cron.schedule('* * * * *', () => {
    checkDeadline();
  });

  // Send warnings every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    checkWarnings();
  });

  // Process retry queue every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    processRetryQueue().catch(err => logger.error('Retry queue error:', err));
  });

  logger.info('Scheduler started');
}

function parseDeadline(raw) {
  // Handle both SQLite "2026-03-10 15:36:49" and ISO "2026-03-10T15:36:49.000Z"
  const d = new Date(raw.endsWith('Z') ? raw : raw + 'Z');
  if (isNaN(d.getTime())) throw new Error(`Invalid deadline date: ${raw}`);
  return d.getTime();
}

async function checkDeadline() {
  try {
    const user = User.getUser();
    if (!user || user.is_paused) return;

    const now = Date.now();
    const deadline = parseDeadline(user.next_deadline_at);
    const graceEnd = deadline + user.grace_period_hours * 3600000;

    if (now > graceEnd) {
      logger.warn('DEADLINE EXCEEDED - Triggering delivery');
      AuditLog.log('Deadline exceeded — triggering delivery to all recipients', 'delivery', 'critical');
      await triggerAllDeliveries('deadline');
      // Pause after delivery to prevent re-triggering
      User.togglePause(true);
    }
  } catch (err) {
    logger.error('Deadline check error:', err);
  }
}

export async function testWarnings() {
  const user = User.getUser();
  if (!user) throw new Error('No user found');

  const now = Date.now();
  const deadline = parseDeadline(user.next_deadline_at);
  const hoursRemaining = (deadline - now) / 3600000;

  const results = { hoursRemaining: Math.round(hoursRemaining * 100) / 100, deadline: user.next_deadline_at, channels: {} };

  const userEmail = Setting.get('admin_notify_email');
  if (emailConfigured() && userEmail) {
    try {
      await sendWarningEmail(userEmail, Math.round(hoursRemaining));
      results.channels.email = { status: 'sent', to: userEmail };
    } catch (err) {
      results.channels.email = { status: 'failed', to: userEmail, error: err.message };
    }
  } else {
    results.channels.email = { status: 'skipped', configured: emailConfigured(), to: userEmail || null };
  }

  const userTelegramId = Setting.get('admin_notify_telegram_chat_id');
  if (telegramConfigured() && userTelegramId) {
    try {
      await sendWarningTelegram(userTelegramId, Math.round(hoursRemaining));
      results.channels.telegram = { status: 'sent', chatId: userTelegramId };
    } catch (err) {
      results.channels.telegram = { status: 'failed', chatId: userTelegramId, error: err.message };
    }
  } else {
    results.channels.telegram = { status: 'skipped', configured: telegramConfigured(), chatId: userTelegramId || null };
  }

  AuditLog.log('Test warning triggered manually', 'checkin', 'info', JSON.stringify(results));
  return results;
}

async function checkWarnings() {
  try {
    const user = User.getUser();
    if (!user || user.is_paused) return;

    const now = Date.now();
    const deadline = parseDeadline(user.next_deadline_at);
    const hoursRemaining = (deadline - now) / 3600000;

    if (hoursRemaining <= 0) return;

    const schedule = JSON.parse(user.warning_schedule);

    for (const threshold of schedule) {
      if (hoursRemaining <= threshold && !WarningLog.wasWarningSent(threshold)) {
        logger.info(`Sending warning: ${threshold}h before deadline`);

        let sent = false;

        // Send warning to admin only (not recipients)
        const userEmail = Setting.get('admin_notify_email');
        if (emailConfigured() && userEmail) {
          try {
            await sendWarningEmail(userEmail, Math.round(hoursRemaining));
            WarningLog.create({ hoursBeforeDeadline: threshold, method: 'email', status: 'sent' });
            AuditLog.log(`Check-in reminder sent via email (${threshold}h threshold, ${Math.round(hoursRemaining)}h remaining)`, 'checkin', 'warning', JSON.stringify({ to: userEmail, threshold, hoursRemaining: Math.round(hoursRemaining) }));
            sent = true;
          } catch (err) {
            WarningLog.create({ hoursBeforeDeadline: threshold, method: 'email', status: 'failed' });
            AuditLog.log(`Check-in reminder email failed (${threshold}h threshold)`, 'checkin', 'warning', JSON.stringify({ error: err.message, to: userEmail }));
            logger.error(`Warning email failed: ${err.message}`);
          }
        }

        const userTelegramId = Setting.get('admin_notify_telegram_chat_id');
        if (telegramConfigured() && userTelegramId) {
          try {
            await sendWarningTelegram(userTelegramId, Math.round(hoursRemaining));
            WarningLog.create({ hoursBeforeDeadline: threshold, method: 'telegram', status: 'sent' });
            AuditLog.log(`Check-in reminder sent via Telegram (${threshold}h threshold, ${Math.round(hoursRemaining)}h remaining)`, 'checkin', 'warning', JSON.stringify({ chatId: userTelegramId, threshold, hoursRemaining: Math.round(hoursRemaining) }));
            sent = true;
          } catch (err) {
            WarningLog.create({ hoursBeforeDeadline: threshold, method: 'telegram', status: 'failed' });
            AuditLog.log(`Check-in reminder Telegram failed (${threshold}h threshold)`, 'checkin', 'warning', JSON.stringify({ error: err.message, chatId: userTelegramId }));
            logger.error(`Warning telegram failed: ${err.message}`);
          }
        }

        // Log if no notification channels configured
        if (!sent) {
          AuditLog.log(`Check-in reminder skipped — no admin notification channels configured (${threshold}h threshold, ${Math.round(hoursRemaining)}h remaining)`, 'checkin', 'warning', JSON.stringify({ emailConfigured: emailConfigured(), hasAdminEmail: !!userEmail, telegramConfigured: telegramConfigured(), hasAdminTelegram: !!userTelegramId }));
          logger.warn(`Warning for ${threshold}h threshold skipped: no admin notification channels configured`);
        }
      }
    }
  } catch (err) {
    logger.error('Warning check error:', err);
  }
}

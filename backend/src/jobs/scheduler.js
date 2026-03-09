import cron from 'node-cron';
import * as User from '../models/User.js';
import * as WarningLog from '../models/WarningLog.js';
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

async function checkDeadline() {
  try {
    const user = User.getUser();
    if (!user || user.is_paused) return;

    const now = Date.now();
    const deadline = new Date(user.next_deadline_at + 'Z').getTime();
    const graceEnd = deadline + user.grace_period_hours * 3600000;

    if (now > graceEnd) {
      logger.warn('DEADLINE EXCEEDED - Triggering delivery');
      await triggerAllDeliveries('deadline');
      // Pause after delivery to prevent re-triggering
      User.togglePause(true);
    }
  } catch (err) {
    logger.error('Deadline check error:', err);
  }
}

async function checkWarnings() {
  try {
    const user = User.getUser();
    if (!user || user.is_paused) return;

    const now = Date.now();
    const deadline = new Date(user.next_deadline_at + 'Z').getTime();
    const hoursRemaining = (deadline - now) / 3600000;

    if (hoursRemaining <= 0) return;

    const schedule = JSON.parse(user.warning_schedule);

    for (const threshold of schedule) {
      if (hoursRemaining <= threshold && !WarningLog.wasWarningSent(threshold)) {
        logger.info(`Sending warning: ${threshold}h before deadline`);

        // Send warning to admin only (not recipients)
        const userEmail = Setting.get('admin_notify_email');
        if (emailConfigured() && userEmail) {
          try {
            await sendWarningEmail(userEmail, Math.round(hoursRemaining));
            WarningLog.create({ hoursBeforeDeadline: threshold, method: 'email', status: 'sent' });
          } catch (err) {
            WarningLog.create({ hoursBeforeDeadline: threshold, method: 'email', status: 'failed' });
            logger.error(`Warning email failed: ${err.message}`);
          }
        }

        const userTelegramId = Setting.get('admin_notify_telegram_chat_id');
        if (telegramConfigured() && userTelegramId) {
          try {
            await sendWarningTelegram(userTelegramId, Math.round(hoursRemaining));
            WarningLog.create({ hoursBeforeDeadline: threshold, method: 'telegram', status: 'sent' });
          } catch (err) {
            WarningLog.create({ hoursBeforeDeadline: threshold, method: 'telegram', status: 'failed' });
            logger.error(`Warning telegram failed: ${err.message}`);
          }
        }
      }
    }
  } catch (err) {
    logger.error('Warning check error:', err);
  }
}

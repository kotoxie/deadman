import { Router } from 'express';
import * as Setting from '../models/Setting.js';
import * as User from '../models/User.js';
import { initializeEmailService, sendTestEmail } from '../services/emailService.js';
import { initializeTelegram, sendTestTelegram } from '../services/telegramService.js';
import * as AuditLog from '../models/AuditLog.js';

const router = Router();

const SENSITIVE_KEYS = ['smtp_pass', 'telegram_bot_token'];
const SENSITIVE_MASK = '********';
const VALID_KEYS = [
  'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from', 'smtp_secure',
  'telegram_bot_token',
  'admin_notify_email', 'admin_notify_telegram_chat_id',
  'warning_email_subject', 'warning_email_body', 'warning_telegram_template',
  'login_max_attempts', 'login_cooloff_hours',
  'notify_ip_block', 'notify_excessive_failures', 'login_excessive_threshold',
];

router.get('/', (req, res) => {
  const user = User.getUser();
  const settings = Setting.getAll();

  res.json({
    ...settings,
    checkin_interval_days: user.checkin_interval_days,
    grace_period_hours: user.grace_period_hours,
    warning_schedule: JSON.parse(user.warning_schedule),
    is_paused: !!user.is_paused,
  });
});

router.put('/', (req, res) => {
  const userFields = {};
  const settingUpdates = {};

  for (const [key, value] of Object.entries(req.body)) {
    if (key === 'checkin_interval_days') userFields.checkinIntervalDays = parseInt(value);
    else if (key === 'grace_period_hours') userFields.gracePeriodHours = parseInt(value);
    else if (key === 'warning_schedule') userFields.warningSchedule = value;
    else if (VALID_KEYS.includes(key)) {
      // Skip sensitive keys if the value is the mask (unchanged from frontend)
      if (SENSITIVE_KEYS.includes(key) && value === SENSITIVE_MASK) continue;
      settingUpdates[key] = value;
    }
  }

  // Capture old values before updating
  const user = User.getUser();
  const oldValues = {};
  const changes = [];

  if (userFields.checkinIntervalDays !== undefined && userFields.checkinIntervalDays !== user.checkin_interval_days) {
    oldValues.checkin_interval_days = user.checkin_interval_days;
    changes.push({ key: 'checkin_interval_days', from: user.checkin_interval_days, to: userFields.checkinIntervalDays });
  }
  if (userFields.gracePeriodHours !== undefined && userFields.gracePeriodHours !== user.grace_period_hours) {
    oldValues.grace_period_hours = user.grace_period_hours;
    changes.push({ key: 'grace_period_hours', from: user.grace_period_hours, to: userFields.gracePeriodHours });
  }
  if (userFields.warningSchedule !== undefined) {
    const oldSchedule = JSON.parse(user.warning_schedule);
    const newSchedule = userFields.warningSchedule;
    if (JSON.stringify(oldSchedule) !== JSON.stringify(newSchedule)) {
      changes.push({ key: 'warning_schedule', from: oldSchedule, to: newSchedule });
    }
  }

  for (const [key, value] of Object.entries(settingUpdates)) {
    const oldVal = Setting.get(key);
    if (SENSITIVE_KEYS.includes(key)) {
      // Don't log actual values for sensitive keys
      if ((oldVal || '') !== (value || '')) {
        changes.push({ key, from: oldVal ? '••••••' : '(empty)', to: value ? '••••••' : '(empty)' });
      }
    } else if ((oldVal || '') !== (value || '')) {
      changes.push({ key, from: oldVal || '(empty)', to: value || '(empty)' });
    }
  }

  if (Object.keys(userFields).length > 0) {
    User.updateSettings(userFields);
  }

  for (const [key, value] of Object.entries(settingUpdates)) {
    Setting.set(key, value, SENSITIVE_KEYS.includes(key));
  }

  // Re-init services if their settings changed
  if (settingUpdates.smtp_host || settingUpdates.smtp_pass) {
    initializeEmailService();
  }
  if (settingUpdates.telegram_bot_token) {
    initializeTelegram();
  }

  if (changes.length > 0) {
    AuditLog.log('Settings updated', 'settings', 'info', JSON.stringify({ changes }), req.ip);
  }
  res.json({ success: true });
});

router.post('/test-email', async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: 'to email is required' });

  try {
    await sendTestEmail(to);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/test-telegram', async (req, res) => {
  const { chatId } = req.body;
  if (!chatId) return res.status(400).json({ error: 'chatId is required' });

  try {
    await sendTestTelegram(chatId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

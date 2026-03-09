import { Router } from 'express';
import * as Setting from '../models/Setting.js';
import * as User from '../models/User.js';
import { initializeEmailService, sendTestEmail } from '../services/emailService.js';
import { initializeTelegram, sendTestTelegram } from '../services/telegramService.js';
import * as AuditLog from '../models/AuditLog.js';

const router = Router();

const SENSITIVE_KEYS = ['smtp_pass', 'telegram_bot_token'];
const VALID_KEYS = [
  'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from', 'smtp_secure',
  'telegram_bot_token',
  'admin_notify_email', 'admin_notify_telegram_chat_id',
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
    else if (VALID_KEYS.includes(key)) settingUpdates[key] = value;
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

  const changedKeys = [...Object.keys(userFields), ...Object.keys(settingUpdates)];
  AuditLog.log('Settings updated', 'settings', 'info', JSON.stringify({ keys: changedKeys }), req.ip);
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

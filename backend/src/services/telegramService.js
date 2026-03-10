import { Telegraf } from 'telegraf';
import * as Setting from '../models/Setting.js';
import logger from '../utils/logger.js';

let bot = null;

export function initializeTelegram() {
  const token = Setting.get('telegram_bot_token');
  if (!token) {
    logger.debug('Telegram bot token not configured');
    bot = null;
    return;
  }

  bot = new Telegraf(token);
  logger.info('Telegram service initialized');
}

export async function sendDeliveryTelegram(chatId, itemName, itemType, content) {
  if (!bot) throw new Error('Telegram bot not configured');

  if (itemType === 'file' && content.buffer) {
    await bot.telegram.sendDocument(chatId, {
      source: content.buffer,
      filename: content.fileName || 'file',
    }, {
      caption: `🔐 Dead Man's Switch Delivery\n\nItem: ${itemName}\nType: File`,
    });
  } else {
    const text = formatTelegramMessage(itemName, itemType, content);
    await bot.telegram.sendMessage(chatId, text, { parse_mode: 'HTML' });
  }

  logger.info(`Telegram message sent to ${chatId} for item "${itemName}"`);
}

const DEFAULT_WARNING_TELEGRAM = `⚠️ <b>Dead Man's Switch Warning</b>\n\nYour deadline is in <b>{{hours}} hours</b>. Please check in to prevent delivery.`;

export async function sendWarningTelegram(chatId, hoursRemaining) {
  if (!bot) return;
  const template = Setting.get('warning_telegram_template') || DEFAULT_WARNING_TELEGRAM;
  await bot.telegram.sendMessage(
    chatId,
    template.replace(/\{\{hours\}\}/g, hoursRemaining),
    { parse_mode: 'HTML' }
  );
}

export async function sendTestTelegram(chatId) {
  if (!bot) throw new Error('Telegram bot not configured. Set bot token first.');
  await bot.telegram.sendMessage(
    chatId,
    '✅ <b>Dead Man\'s Switch</b>\n\nTest message successful. Telegram delivery is working correctly.',
    { parse_mode: 'HTML' }
  );
}

function formatTelegramMessage(name, type, content) {
  let msg = `🔐 <b>Dead Man's Switch Delivery</b>\n\n`;
  msg += `<b>Item:</b> ${escapeHtml(name)}\n`;
  msg += `<b>Type:</b> ${type}\n\n`;

  if (typeof content === 'string') {
    msg += `<pre>${escapeHtml(content)}</pre>`;
  } else if (typeof content === 'object') {
    for (const [key, value] of Object.entries(content)) {
      if (key === 'buffer' || key === 'fileName') continue;
      msg += `<b>${escapeHtml(key)}:</b> <code>${escapeHtml(String(value))}</code>\n`;
    }
  }

  return msg;
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function sendAdminNotificationTelegram(chatId, message) {
  if (!bot) return;
  await bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML' });
}

export function isConfigured() {
  return bot !== null;
}

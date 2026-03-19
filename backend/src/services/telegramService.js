import { Telegraf } from 'telegraf';
import * as Setting from '../models/Setting.js';
import * as User from '../models/User.js';
import * as WarningLog from '../models/WarningLog.js';
import * as AuditLog from '../models/AuditLog.js';
import logger from '../utils/logger.js';

let bot = null;

export function initializeTelegram() {
  // Stop and discard existing bot before reinitializing
  if (bot) {
    bot.stop('reinit');
    bot = null;
  }

  const token = Setting.get('telegram_bot_token');
  if (!token) {
    logger.debug('Telegram bot token not configured');
    return;
  }

  bot = new Telegraf(token);
  registerHandlers(bot);

  // Start long-polling to receive callback queries (check-in button)
  bot.launch().catch(err => {
    logger.debug('Telegram bot stopped:', err?.message || err);
  });

  logger.info('Telegram service initialized');
}

function registerHandlers(botInstance) {
  botInstance.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery?.data;
    if (data !== 'checkin') return;

    // Verify the interaction comes from the configured admin chat
    const chatId = String(ctx.callbackQuery.message?.chat?.id ?? '');
    const adminChatId = String(Setting.get('admin_notify_telegram_chat_id') ?? '').trim();

    if (!adminChatId || chatId !== adminChatId) {
      await ctx.answerCbQuery('Not authorized.', { show_alert: true });
      return;
    }

    try {
      const user = User.updateCheckin();
      WarningLog.clearRecent();
      AuditLog.log('Check-in performed via Telegram button', 'checkin', 'info', null, 'telegram');
      logger.info(`Check-in performed via Telegram (chat ${chatId})`);

      // Acknowledge the button press (removes loading spinner)
      await ctx.answerCbQuery('✅ Checked in successfully!');

      // Remove the inline keyboard from the warning message so the button can't be reused
      try {
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
      } catch (_) {
        // Message may be too old to edit — ignore silently
      }

      // Send confirmation with new deadline
      const raw = user.next_deadline_at;
      const deadline = new Date(raw.endsWith('Z') ? raw : raw + 'Z')
        .toISOString()
        .replace('T', ' ')
        .slice(0, 16) + ' UTC';

      await ctx.reply(
        `✅ <b>Check-in Successful</b>\n\nYour dead man's switch deadline has been reset.\n<b>New deadline:</b> ${deadline}`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      logger.error('Telegram check-in callback error:', err);
      await ctx.answerCbQuery('Check-in failed. Please use the web interface.', { show_alert: true });
    }
  });
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
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Check In Now', callback_data: 'checkin' },
        ]],
      },
    }
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

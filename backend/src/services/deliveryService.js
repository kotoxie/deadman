import * as Recipient from '../models/Recipient.js';
import * as VaultItem from '../models/VaultItem.js';
import * as DeliveryLog from '../models/DeliveryLog.js';
import { decrypt, decryptBuffer, getAppEncryptionKey } from './crypto.js';
import { sendDeliveryEmail } from './emailService.js';
import { sendDeliveryTelegram } from './telegramService.js';
import { sendDeliveryWebhook } from './webhookService.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

function decryptItem(item) {
  const key = getAppEncryptionKey(config.dbEncryptionKey);

  if (item.type === 'file') {
    const buffer = decryptBuffer(item.encrypted_data, item.iv, item.auth_tag, key);
    return { buffer, fileName: item.file_name };
  }

  const plaintext = decrypt(item.encrypted_data, item.iv, item.auth_tag, key);
  try {
    return JSON.parse(plaintext);
  } catch {
    return plaintext;
  }
}

async function deliverToRecipient(recipient, item, decryptedContent, triggeredBy) {
  const results = [];
  const methods = [];

  if (recipient.email) methods.push('email');
  if (recipient.telegram_chat_id) methods.push('telegram');
  if (recipient.webhook_url) methods.push('webhook');

  for (const method of methods) {
    const log = DeliveryLog.create({
      recipientId: recipient.id,
      vaultItemId: item.id,
      method,
      status: 'pending',
      triggeredBy,
    });

    try {
      switch (method) {
        case 'email':
          await sendDeliveryEmail(recipient.email, item.name, item.type, decryptedContent);
          break;
        case 'telegram':
          await sendDeliveryTelegram(recipient.telegram_chat_id, item.name, item.type, decryptedContent);
          break;
        case 'webhook':
          await sendDeliveryWebhook(recipient.webhook_url, item.name, item.type, decryptedContent);
          break;
      }
      DeliveryLog.updateStatus(log.id, { status: 'success', attemptCount: 1 });
      results.push({ method, recipient: recipient.name, item: item.name, status: 'success' });
    } catch (err) {
      logger.error(`Delivery failed: ${method} -> ${recipient.name} for "${item.name}": ${err.message}`);
      DeliveryLog.updateStatus(log.id, {
        status: 'retrying',
        errorMessage: err.message,
        attemptCount: 1,
      });
      results.push({ method, recipient: recipient.name, item: item.name, status: 'failed', error: err.message });
    }
  }

  return results;
}

export async function triggerAllDeliveries(triggeredBy = 'deadline') {
  const recipients = Recipient.findAllWithItems();
  const allResults = [];

  logger.warn(`Triggering delivery for ${recipients.length} recipients (${triggeredBy})`);

  for (const recipient of recipients) {
    for (const item of recipient.items) {
      try {
        const content = decryptItem(item);
        const results = await deliverToRecipient(recipient, item, content, triggeredBy);
        allResults.push(...results);
      } catch (err) {
        logger.error(`Failed to process item "${item.name}" for ${recipient.name}: ${err.message}`);
        allResults.push({
          recipient: recipient.name,
          item: item.name,
          status: 'failed',
          error: err.message,
        });
      }
    }
  }

  return allResults;
}

export async function sendTestDelivery(recipient) {
  const results = [];
  const testContent = 'This is a test delivery from Dead Man\'s Switch.';

  if (recipient.email) {
    try {
      await sendDeliveryEmail(recipient.email, 'Test Item', 'note', testContent);
      results.push({ method: 'email', status: 'success' });
    } catch (err) {
      results.push({ method: 'email', status: 'failed', error: err.message });
    }
  }

  if (recipient.telegram_chat_id) {
    try {
      await sendDeliveryTelegram(recipient.telegram_chat_id, 'Test Item', 'note', testContent);
      results.push({ method: 'telegram', status: 'success' });
    } catch (err) {
      results.push({ method: 'telegram', status: 'failed', error: err.message });
    }
  }

  if (recipient.webhook_url) {
    try {
      await sendDeliveryWebhook(recipient.webhook_url, 'Test Item', 'note', testContent);
      results.push({ method: 'webhook', status: 'success' });
    } catch (err) {
      results.push({ method: 'webhook', status: 'failed', error: err.message });
    }
  }

  return results;
}

export async function retryDelivery(logId) {
  const log = DeliveryLog.findAll({ limit: 1, offset: 0 });
  // Find the specific log entry
  const { logs } = DeliveryLog.findAll({});
  const entry = logs.find(l => l.id === logId);
  if (!entry) throw new Error('Delivery log not found');
  if (entry.status === 'success') throw new Error('Delivery already succeeded');

  const item = VaultItem.findById(entry.vault_item_id);
  const recipient = Recipient.findById(entry.recipient_id);
  if (!item || !recipient) throw new Error('Item or recipient not found');

  const content = decryptItem(item);

  try {
    switch (entry.method) {
      case 'email':
        await sendDeliveryEmail(recipient.email, item.name, item.type, content);
        break;
      case 'telegram':
        await sendDeliveryTelegram(recipient.telegram_chat_id, item.name, item.type, content);
        break;
      case 'webhook':
        await sendDeliveryWebhook(recipient.webhook_url, item.name, item.type, content);
        break;
    }
    DeliveryLog.updateStatus(logId, { status: 'success', attemptCount: entry.attempt_count + 1 });
    return { status: 'success' };
  } catch (err) {
    DeliveryLog.updateStatus(logId, {
      status: entry.attempt_count + 1 >= 3 ? 'failed' : 'retrying',
      errorMessage: err.message,
      attemptCount: entry.attempt_count + 1,
    });
    throw err;
  }
}

export async function processRetryQueue() {
  const pending = DeliveryLog.findPendingRetries();
  for (const log of pending) {
    try {
      await retryDelivery(log.id);
    } catch {
      // Already handled in retryDelivery
    }
  }
}

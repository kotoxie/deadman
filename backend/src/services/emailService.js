import nodemailer from 'nodemailer';
import * as Setting from '../models/Setting.js';
import logger from '../utils/logger.js';

let transporter = null;

export function initializeEmailService() {
  const host = Setting.get('smtp_host');
  const port = Setting.get('smtp_port');
  const user = Setting.get('smtp_user');
  const pass = Setting.get('smtp_pass');
  const secure = Setting.get('smtp_secure') === 'true';

  if (!host) {
    logger.debug('SMTP not configured, email service disabled');
    transporter = null;
    return;
  }

  transporter = nodemailer.createTransport({
    host,
    port: parseInt(port || '587'),
    secure,
    auth: user ? { user, pass } : undefined,
  });

  logger.info(`Email service initialized (${host}:${port})`);
}

function getFrom() {
  return Setting.get('smtp_from') || Setting.get('smtp_user') || 'deadman@localhost';
}

export async function sendDeliveryEmail(recipientEmail, itemName, itemType, content) {
  if (!transporter) throw new Error('Email service not configured');

  const mailOptions = {
    from: getFrom(),
    to: recipientEmail,
    subject: `[Dead Man's Switch] Delivery: ${itemName}`,
    text: formatContent(itemName, itemType, content),
  };

  // Attach file if it's a file type
  if (itemType === 'file' && content.buffer) {
    mailOptions.attachments = [{
      filename: content.fileName || 'file',
      content: content.buffer,
    }];
    mailOptions.text = `Dead Man's Switch delivery.\n\nItem: ${itemName}\nType: File\n\nThe file is attached.`;
  }

  await transporter.sendMail(mailOptions);
  logger.info(`Email sent to ${recipientEmail} for item "${itemName}"`);
}

const DEFAULT_WARNING_SUBJECT = `[Dead Man's Switch] Warning: {{hours}}h remaining`;
const DEFAULT_WARNING_BODY = `Your Dead Man's Switch deadline is in {{hours}} hours. Please check in to prevent delivery.`;

export async function sendWarningEmail(email, hoursRemaining) {
  if (!transporter) return;

  const subjectTpl = Setting.get('warning_email_subject') || DEFAULT_WARNING_SUBJECT;
  const bodyTpl = Setting.get('warning_email_body') || DEFAULT_WARNING_BODY;

  await transporter.sendMail({
    from: getFrom(),
    to: email,
    subject: subjectTpl.replace(/\{\{hours\}\}/g, hoursRemaining),
    text: bodyTpl.replace(/\{\{hours\}\}/g, hoursRemaining),
  });
}

export async function sendTestEmail(to) {
  if (!transporter) throw new Error('Email service not configured. Set SMTP settings first.');
  await transporter.sendMail({
    from: getFrom(),
    to,
    subject: '[Dead Man\'s Switch] Test Message',
    text: 'This is a test message from your Dead Man\'s Switch application. Email delivery is working correctly.',
  });
}

function formatContent(name, type, content) {
  let body = `Dead Man's Switch - Item Delivery\n${'='.repeat(40)}\n\n`;
  body += `Item: ${name}\nType: ${type}\n\n`;

  if (typeof content === 'string') {
    body += content;
  } else if (typeof content === 'object') {
    for (const [key, value] of Object.entries(content)) {
      if (key === 'buffer' || key === 'fileName') continue;
      body += `${key}: ${value}\n`;
    }
  }

  return body;
}

export function isConfigured() {
  return transporter !== null;
}

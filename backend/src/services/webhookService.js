import crypto from 'crypto';
import dns from 'dns/promises';
import { URL } from 'url';
import config from '../config/index.js';
import logger from '../utils/logger.js';

// Blocked hostname/IP patterns for SSRF prevention
const BLOCKED_PATTERNS = [
  /^127\./,                         // Loopback IPv4
  /^10\./,                          // Private Class A
  /^172\.(1[6-9]|2\d|3[01])\./,    // Private Class B
  /^192\.168\./,                    // Private Class C
  /^169\.254\./,                    // Link-local
  /^0\./,                           // Current network
  /^fc/i,                           // IPv6 ULA
  /^fe80/i,                         // IPv6 link-local
  /^::1$/,                          // IPv6 loopback
  /^localhost$/i,                   // localhost
  /^metadata\.google/i,             // GCP metadata
];

/**
 * Validate webhook URL to prevent SSRF attacks.
 * Exported so routes can enforce SSRF rules at creation time too.
 */
export function validateWebhookUrl(webhookUrl) {
  let parsed;
  try {
    parsed = new URL(webhookUrl);
  } catch {
    throw new Error('Invalid webhook URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Webhook URL must use http or https protocol');
  }
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(parsed.hostname)) {
      throw new Error('Webhook URL points to a blocked address');
    }
  }
  return parsed;
}

/**
 * Resolve the hostname to IPs and verify none are blocked.
 * Guards against DNS rebinding attacks where a hostname passes string validation
 * but resolves to a private IP at send time.
 */
async function validateResolvedIPs(hostname) {
  let addresses = [];
  try {
    const v4 = await dns.resolve4(hostname).catch(() => []);
    const v6 = await dns.resolve6(hostname).catch(() => []);
    addresses = [...v4, ...v6];
  } catch {
    // Fall through — if both fail, block by default (fail-safe)
  }
  if (addresses.length === 0) {
    throw new Error(`Webhook hostname "${hostname}" could not be resolved`);
  }
  for (const addr of addresses) {
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(addr)) {
        throw new Error(`Webhook URL resolves to a blocked IP address (${addr})`);
      }
    }
  }
}

/**
 * Derive webhook signing key from DB_ENCRYPTION_KEY (not hardcoded).
 */
function getSigningKey() {
  return crypto.createHmac('sha256', config.dbEncryptionKey)
    .update('deadman-webhook-signing')
    .digest('hex');
}

export async function sendDeliveryWebhook(webhookUrl, itemName, itemType, content) {
  const parsed = validateWebhookUrl(webhookUrl);  // string-level validation
  await validateResolvedIPs(parsed.hostname);      // DNS-level SSRF guard at send time

  const payload = {
    event: 'deadman_switch_delivery',
    timestamp: new Date().toISOString(),
    item: {
      name: itemName,
      type: itemType,
      content: itemType === 'file' && content.buffer
        ? { fileName: content.fileName, base64: content.buffer.toString('base64') }
        : content,
    },
  };

  const body = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', getSigningKey())
    .update(body)
    .digest('hex');

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': signature,
      'X-Event': 'delivery',
    },
    body,
    signal: AbortSignal.timeout(30000),
    redirect: 'error',  // SSRF defense-in-depth: don't follow redirects
  });

  if (!response.ok) {
    throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
  }

  logger.info(`Webhook sent to ${webhookUrl} for item "${itemName}"`);
}

export async function sendTestWebhook(webhookUrl) {
  validateWebhookUrl(webhookUrl);

  const payload = {
    event: 'deadman_switch_test',
    timestamp: new Date().toISOString(),
    message: 'Test webhook from Dead Man\'s Switch',
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
    redirect: 'error',
  });

  if (!response.ok) {
    throw new Error(`Webhook returned ${response.status}`);
  }
}

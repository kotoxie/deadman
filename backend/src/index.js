import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import crypto from 'crypto';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import config from './config/index.js';
import { initDatabase, closeDatabase } from './config/database.js';
import { requireAuth, login, logout, checkAuth, changePassword, skipPasswordChange } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { initializeEmailService } from './services/emailService.js';
import { initializeTelegram } from './services/telegramService.js';
import { startScheduler } from './jobs/scheduler.js';
import logger from './utils/logger.js';

import dashboardRoutes from './routes/dashboard.js';
import checkinRoutes from './routes/checkin.js';
import vaultRoutes from './routes/vault.js';
import recipientRoutes from './routes/recipients.js';
import deliveryLogRoutes from './routes/deliveryLogs.js';
import createSettingsRouter from './routes/settings.js';
import * as Setting from './models/Setting.js';
import auditLogRoutes from './routes/auditLogs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  // Initialize database (async for sql.js WASM init)
  await initDatabase();

  // Initialize delivery services
  try { initializeEmailService(); } catch (e) { logger.debug('Email service not configured:', e.message); }
  try { initializeTelegram(); } catch (e) { logger.debug('Telegram service not configured:', e.message); }

  // Create Express app
  const app = express();

  // Apply stored trust proxy setting (configurable via Settings → Login & Security)
  const storedTrustProxy = Setting.get('trust_proxy');
  if (storedTrustProxy && storedTrustProxy !== 'false') {
    app.set('trust proxy', storedTrustProxy);
  }

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'", "https://api.github.com"],
        upgradeInsecureRequests: config.secureCookies ? [] : null,
      },
    },
    // Disable HSTS when not using HTTPS to prevent browsers from force-upgrading to https://
    strictTransportSecurity: config.secureCookies ? undefined : false,
  }));
  // This app is a same-origin SPA (frontend served by the same Express server).
  // No cross-origin access is needed or allowed.
  app.use(cors({ origin: false }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Session — secure cookie in production
  app.use(session({
    name: 'deadman.sid',
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: config.secureCookies,  // Requires HTTPS; override with SECURE_COOKIES=false for plain HTTP
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'strict',      // Strict CSRF protection (upgraded from 'lax')
    },
  }));

  // ─── Rate Limiters ──────────────────────────────────────────
  // Login rate limiting is handled by custom IP blocking in auth.js
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,       // 1-minute window
    max: 120,                   // 120 requests per minute
    message: { error: 'Too many requests. Please slow down.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // ─── API routes ───────────────────────────────────────────────
  // Version (public)
  app.get('/api/version', (req, res) => res.json({
    version: config.version,
    repoUrl: config.repoUrl,
  }));

  // Auth (public — login has custom IP blocking in auth.js)
  app.post('/api/auth/login', login);
  app.post('/api/auth/logout', logout);
  app.get('/api/auth/check', checkAuth);
  app.post('/api/auth/change-password', requireAuth, changePassword);
  app.post('/api/auth/skip-password-change', requireAuth, skipPasswordChange);

  // ─── CSRF Protection ───────────────────────────────────────────
  // For every mutating API call (non-GET/HEAD/OPTIONS) the frontend must include
  // the X-CSRF-Token header containing the per-session token issued at login.
  // Safe methods are exempt because they carry no side-effects.
  function csrfProtect(req, res, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    // Public auth endpoints that have their own protections (login, logout)
    if (req.path === '/api/auth/login' || req.path === '/api/auth/logout') return next();
    const sessionToken = req.session?.csrfToken;
    const headerToken  = req.headers['x-csrf-token'];
    if (!sessionToken || !headerToken) {
      return res.status(403).json({ error: 'CSRF token missing' });
    }
    // Constant-time comparison to prevent timing attacks
    const a = Buffer.from(sessionToken);
    const b = Buffer.from(headerToken);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }
    next();
  }
  app.use('/api', csrfProtect);

  // Protected (rate-limited)
  app.use('/api/dashboard', requireAuth, apiLimiter, dashboardRoutes);
  app.use('/api/checkin', requireAuth, apiLimiter, checkinRoutes);
  app.use('/api/vault', requireAuth, apiLimiter, vaultRoutes);
  app.use('/api/recipients', requireAuth, apiLimiter, recipientRoutes);
  app.use('/api/delivery-logs', requireAuth, apiLimiter, deliveryLogRoutes);
  app.use('/api/settings', requireAuth, apiLimiter, createSettingsRouter(app));
  app.use('/api/audit-logs', requireAuth, apiLimiter, auditLogRoutes);

  // 404 for unknown API routes
  app.all('/api/*', (req, res) => res.status(404).json({ error: 'Not found' }));

  // ─── Frontend serving (pre-built static files) ──────────────
  const publicDir = path.join(__dirname, '../public');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
    app.get('*', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
  } else {
    logger.warn('No public/ directory found — run "npm run build" first');
  }

  // Error handler
  app.use(errorHandler);

  // Start scheduler
  startScheduler();

  // Start server
  app.listen(config.port, () => {
    logger.info(`Dead Man's Switch v${config.version} running on port ${config.port}`);
  });
}

main().catch(err => {
  logger.error('Failed to start:', err);
  process.exit(1);
});

// ─── Graceful Shutdown ─────────────────────────────────────────
function gracefulShutdown(signal) {
  logger.info(`${signal} received. Shutting down gracefully...`);
  try {
    closeDatabase();
    logger.info('Database saved and closed.');
  } catch (err) {
    logger.error('Error during shutdown:', err);
  }
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

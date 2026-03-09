import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
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
import settingsRoutes from './routes/settings.js';
import auditLogRoutes from './routes/auditLogs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../..');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');

async function main() {
  // Initialize database (async for sql.js WASM init)
  await initDatabase();

  // Initialize delivery services
  try { initializeEmailService(); } catch (e) { logger.debug('Email service not configured:', e.message); }
  try { initializeTelegram(); } catch (e) { logger.debug('Telegram service not configured:', e.message); }

  // Create Express app
  const app = express();

  // Trust proxy for correct IP detection behind reverse proxy / Docker
  app.set('trust proxy', 1);

  // Security headers — CSP configured for production, relaxed for dev
  app.use(helmet({
    contentSecurityPolicy: config.isDev ? false : {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        // Only upgrade insecure requests when HTTPS is available
        ...(config.secureCookies ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    // Disable HSTS when not using HTTPS to prevent browsers from force-upgrading to https://
    strictTransportSecurity: config.secureCookies ? undefined : false,
  }));
  app.use(cors({ origin: config.isDev ? true : false, credentials: true }));

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
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15-minute window
    max: 10,                    // 10 attempts per window
    message: { error: 'Too many login attempts. Try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,       // 1-minute window
    max: 120,                   // 120 requests per minute
    message: { error: 'Too many requests. Please slow down.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // ─── API routes ───────────────────────────────────────────────
  // Auth (public, rate-limited)
  app.post('/api/auth/login', loginLimiter, login);
  app.post('/api/auth/logout', logout);
  app.get('/api/auth/check', checkAuth);
  app.post('/api/auth/change-password', requireAuth, changePassword);
  app.post('/api/auth/skip-password-change', requireAuth, skipPasswordChange);

  // Protected (rate-limited)
  app.use('/api/dashboard', requireAuth, apiLimiter, dashboardRoutes);
  app.use('/api/checkin', requireAuth, apiLimiter, checkinRoutes);
  app.use('/api/vault', requireAuth, apiLimiter, vaultRoutes);
  app.use('/api/recipients', requireAuth, apiLimiter, recipientRoutes);
  app.use('/api/delivery-logs', requireAuth, apiLimiter, deliveryLogRoutes);
  app.use('/api/settings', requireAuth, apiLimiter, settingsRoutes);
  app.use('/api/audit-logs', requireAuth, apiLimiter, auditLogRoutes);

  // 404 for unknown API routes
  app.all('/api/*', (req, res) => res.status(404).json({ error: 'Not found' }));

  // ─── Frontend serving ─────────────────────────────────────────
  if (config.isDev) {
    // Development: Vite dev server as middleware (HMR, instant reload)
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      root: FRONTEND_DIR,
      server: { middlewareMode: true, hmr: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    logger.info('Vite dev server attached (HMR enabled)');
  } else {
    // Production: serve pre-built static files
    const publicDir = path.join(__dirname, '../public');
    if (fs.existsSync(publicDir)) {
      app.use(express.static(publicDir));
      app.get('*', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
    } else {
      logger.warn('No public/ directory found — run "npm run build" first');
    }
  }

  // Error handler
  app.use(errorHandler);

  // Start scheduler
  startScheduler();

  // Start server
  app.listen(config.port, () => {
    logger.info(`Dead Man's Switch running on http://localhost:${config.port}`);
    logger.info(`Environment: ${config.nodeEnv}`);
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

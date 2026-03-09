# Dead Man's Switch

A self-hosted Dead Man's Switch application that securely stores sensitive data (passwords, notes, crypto wallets, files) and automatically delivers them to designated recipients if you fail to check in within a configurable time window.

> **Disclaimer:** This is a vibe coding project, built entirely through AI-assisted development (Claude). While functional and security-hardened, it has not been formally audited. Use at your own risk, especially for anything mission-critical. Always maintain separate backups of truly important data.

---

## How It Works

1. **Store secrets** in an encrypted vault (notes, passwords, crypto wallet seeds, files up to 50 MB).
2. **Add recipients** who should receive your data (via email, Telegram, or webhook).
3. **Assign vault items** to specific recipients -- each person only gets what you intended.
4. **Check in periodically** (default: every 14 days) to prove you are alive and well.
5. **If you miss the deadline**, the system sends configurable warnings (72h, 48h, 24h, 12h, 6h, 1h before expiry). If the grace period also passes with no check-in, all assigned items are automatically decrypted and delivered to their recipients.

A **Panic** button is available to trigger immediate delivery of everything, and a **Pause** toggle lets you freeze the countdown when needed (e.g., going on a trip without internet).

---

## Features

- **Encrypted Vault** -- AES-256-GCM encryption at rest, scrypt key derivation (N=65536)
- **Multi-channel Delivery** -- Email (SMTP), Telegram bot, and webhook support
- **Countdown Timer** -- Real-time dashboard showing time remaining until delivery
- **Warning System** -- Configurable alerts at multiple thresholds before deadline
- **Automatic Retries** -- Failed deliveries are retried every 5 minutes (up to 3 attempts)
- **Audit Log** -- Full security event log with category/severity filtering
- **Delivery Logs** -- Complete history of all deliveries with retry capability
- **Single-user Design** -- One master password, no account management complexity
- **Dark UI** -- Clean, modern interface built with React and TailwindCSS v4
- **Docker-ready** -- Single-container deployment with persistent volume
- **Security Hardened** -- Rate limiting, CSRF protection, timing-safe auth, SSRF prevention, Helmet CSP headers

---

## Screenshots

The application includes the following pages:

- **Dashboard** -- Countdown timer, check-in/pause/panic controls, quick stats
- **Vault** -- Create and manage encrypted items (notes, passwords, wallets, files)
- **Recipients** -- Manage people who will receive your data, with test delivery
- **Delivery Logs** -- History of all deliveries with status and retry options
- **Audit Log** -- Security event trail with filtering by category and severity
- **Settings** -- Configure check-in interval, grace period, SMTP, Telegram

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js, Express |
| Frontend | React 19, Vite 6 |
| Styling | TailwindCSS v4 |
| Database | SQLite via sql.js (in-process, zero native deps) |
| Auth | Session-based (express-session), master password |
| Encryption | AES-256-GCM, scrypt (N=65536, r=8, p=1) |
| Email | Nodemailer (any SMTP provider) |
| Telegram | Telegraf |
| Scheduling | node-cron |

---

## Quick Start (Docker Compose)

### 1. Create your project directory

```bash
mkdir deadman-switch && cd deadman-switch
```

### 2. Create a `.env` file

```env
# Server
PORT=6680
NODE_ENV=production

# Authentication - CHANGE THIS (app refuses to start with defaults in production)
MASTER_PASSWORD=your_strong_master_password_here

# Security keys - CHANGE THESE (generate with: openssl rand -hex 32)
SESSION_SECRET=your_random_64_char_hex_string_here
DB_ENCRYPTION_KEY=your_random_64_char_hex_string_here

# Data directory (inside container)
DATA_DIR=/app/data

# Optional: SMTP configuration (can also be set in the Settings UI)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=you@gmail.com
# SMTP_PASS=your_app_password
# SMTP_FROM=you@gmail.com
# SMTP_SECURE=false

# Optional: Telegram bot (can also be set in the Settings UI)
# TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
```

### 3. Create `docker-compose.yml`

```yaml
version: '3.8'
services:
  deadman:
    build: .
    container_name: deadman-switch
    restart: unless-stopped
    ports:
      - "${PORT:-6680}:6680"
    volumes:
      - deadman_data:/app/data
    env_file:
      - .env
    environment:
      - NODE_ENV=production
      - DATA_DIR=/app/data

volumes:
  deadman_data:
    driver: local
```

### 4. Build and run

```bash
docker compose up -d
```

The app will be available at `http://localhost:6680`.

---

## Quick Start (Local Development)

### Prerequisites

- Node.js 20+
- npm

### 1. Clone and install

```bash
git clone <your-repo-url> deadman-switch
cd deadman-switch

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your settings (defaults work for development)
```

### 3. Start the dev server

```bash
cd backend
node src/index.js
```

This starts both the Express API and Vite dev server (with HMR) on a single port. Open `http://localhost:6680` in your browser.

Default development credentials:
- **Password:** `admin123`

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `6680` | HTTP server port |
| `NODE_ENV` | No | `development` | `development` or `production` |
| `MASTER_PASSWORD` | **Yes (prod)** | `admin` (dev only) | Master login password. App refuses to start in production with default values. |
| `SESSION_SECRET` | **Yes (prod)** | Auto-generated (dev) | Secret for signing session cookies. Use `openssl rand -hex 32` to generate. |
| `DB_ENCRYPTION_KEY` | **Yes (prod)** | Auto-generated (dev) | Key used to derive vault encryption keys. Use `openssl rand -hex 32` to generate. |
| `DATA_DIR` | No | `./data` | Directory for the SQLite database file |
| `SMTP_HOST` | No | -- | SMTP server hostname (e.g., `smtp.gmail.com`) |
| `SMTP_PORT` | No | `587` | SMTP server port |
| `SMTP_USER` | No | -- | SMTP username/email |
| `SMTP_PASS` | No | -- | SMTP password or app-specific password |
| `SMTP_FROM` | No | -- | Sender email address |
| `SMTP_SECURE` | No | `false` | Set to `true` for port 465 (SSL) |
| `TELEGRAM_BOT_TOKEN` | No | -- | Telegram bot token from @BotFather |

> **Production safety:** The app will refuse to start in `NODE_ENV=production` if `MASTER_PASSWORD`, `SESSION_SECRET`, or `DB_ENCRYPTION_KEY` are missing or still set to default values.

SMTP and Telegram settings can also be configured through the Settings page in the UI. Values set in the UI are stored encrypted in the database and take precedence.

---

## Architecture

```
deadman/
├── backend/
│   └── src/
│       ├── config/          # App config, database initialization (sql.js)
│       ├── jobs/            # Cron scheduler (deadline check, warnings, retries)
│       ├── middleware/       # Auth (session + timing-safe), error handler
│       ├── models/          # Data models (User, VaultItem, Recipient, etc.)
│       ├── routes/          # Express API routes
│       ├── services/        # Crypto, email, Telegram, webhook, delivery orchestration
│       └── utils/           # Logger (Winston)
├── frontend/
│   └── src/
│       ├── components/      # Reusable UI components (Card, Badge, Button, etc.)
│       ├── context/         # React auth context (session-based)
│       ├── hooks/           # Custom hooks (countdown timer)
│       ├── pages/           # Page components (Dashboard, Vault, Recipients, etc.)
│       └── services/        # Axios API client
├── Dockerfile               # Multi-stage build (build frontend, run backend)
├── docker-compose.yml       # Production deployment config
└── .env.example             # Environment variable template
```

### Database

SQLite via **sql.js** (WebAssembly-based, zero native dependencies). The database runs in-memory with auto-save to disk every 5 seconds, plus explicit save on graceful shutdown (SIGTERM/SIGINT).

### Encryption

- Vault items are encrypted with **AES-256-GCM**
- Encryption key is derived from `DB_ENCRYPTION_KEY` using **scrypt** (N=65536, r=8, p=1)
- Each item has its own random IV and authentication tag
- Sensitive settings (SMTP password, Telegram token) are also encrypted at rest

### Scheduled Jobs

| Job | Interval | Purpose |
|-----|----------|---------|
| Deadline check | Every 1 minute | Triggers delivery if deadline + grace period exceeded |
| Warning check | Every 15 minutes | Sends warning notifications at configured thresholds |
| Retry queue | Every 5 minutes | Retries failed deliveries (up to 3 attempts) |

---

## API Endpoints

All API routes are prefixed with `/api` and require authentication (except login/check).

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Login with master password (rate limited: 10/15min) |
| `POST` | `/api/auth/logout` | End session |
| `GET` | `/api/auth/check` | Check authentication status |
| `GET` | `/api/dashboard` | Dashboard stats and countdown |
| `POST` | `/api/checkin` | Check in (reset deadline) |
| `POST` | `/api/checkin/panic` | Trigger immediate delivery (requires `X-Confirm: DELIVER` header) |
| `POST` | `/api/checkin/pause` | Pause/resume the countdown |
| `GET` | `/api/vault` | List vault items (metadata only) |
| `POST` | `/api/vault` | Create vault item |
| `GET` | `/api/vault/:id` | Get vault item (decrypted) |
| `PUT` | `/api/vault/:id` | Update vault item |
| `DELETE` | `/api/vault/:id` | Delete vault item |
| `GET` | `/api/recipients` | List recipients |
| `POST` | `/api/recipients` | Create recipient |
| `GET` | `/api/recipients/:id` | Get recipient with assigned items |
| `PUT` | `/api/recipients/:id` | Update recipient |
| `DELETE` | `/api/recipients/:id` | Delete recipient |
| `POST` | `/api/recipients/:id/assign` | Assign vault items to recipient |
| `POST` | `/api/recipients/:id/test` | Send test delivery |
| `GET` | `/api/delivery-logs` | List delivery logs (filterable) |
| `POST` | `/api/delivery-logs/:id/retry` | Retry a failed delivery |
| `GET` | `/api/audit-logs` | List audit logs (filterable by category/severity) |
| `GET` | `/api/settings` | Get all settings |
| `PUT` | `/api/settings` | Update settings |
| `POST` | `/api/settings/test-email` | Send test email |
| `POST` | `/api/settings/test-telegram` | Send test Telegram message |

---

## Security

This application has been through a code-level security review. Implemented protections include:

- **Timing-safe password comparison** (`crypto.timingSafeEqual`) to prevent timing attacks
- **Rate limiting** on login (10 attempts per 15 minutes) and API (120 requests per minute)
- **Session cookies** with `httpOnly`, `secure` (in production), and `sameSite: strict`
- **Helmet** with Content Security Policy in production
- **SSRF prevention** on webhook URLs (blocks private IPs, localhost, metadata endpoints)
- **Mass assignment protection** on recipient updates (field whitelist)
- **Input validation** with `parseInt` NaN guards on all ID parameters
- **Production env var enforcement** (refuses to start without proper secrets)
- **HMAC webhook signing** with key derived from DB_ENCRYPTION_KEY
- **Graceful shutdown** (SIGTERM/SIGINT handlers save and close the database)
- **Audit logging** of all security-relevant events

---

## Delivery Channels

### Email (SMTP)

Works with any SMTP provider. For Gmail, use an [App Password](https://support.google.com/accounts/answer/185833):

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
SMTP_FROM=you@gmail.com
```

### Telegram

1. Create a bot with [@BotFather](https://t.me/BotFather) and get the token
2. Start a chat with your bot and get your chat ID (use [@userinfobot](https://t.me/userinfobot))
3. Set the bot token in Settings or `.env`, and add the chat ID to recipients

### Webhook

Add a webhook URL to a recipient. When delivery triggers, a POST request is sent with:

```json
{
  "event": "deadman_delivery",
  "recipientName": "John",
  "triggeredBy": "deadline",
  "items": [
    {
      "name": "My Password",
      "type": "password",
      "content": { "username": "...", "password": "..." }
    }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

The request includes an `X-Webhook-Signature` HMAC-SHA256 header for verification.

---

## License

MIT

---

## Disclaimer

This software is provided as-is, without warranty of any kind. This is a **vibe coding project** -- built rapidly through AI-assisted development as a proof of concept. While security best practices have been applied, the codebase has **not undergone a formal security audit**.

Do not rely on this as your sole method of transmitting critical information. Always:

- Keep separate, redundant backups of important data
- Test the delivery flow thoroughly before depending on it
- Regularly verify your SMTP/Telegram configuration still works
- Consider the legal implications of automated posthumous data transfer in your jurisdiction

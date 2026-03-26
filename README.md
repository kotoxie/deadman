<div align="center">

# 💀 Dead Man's Switch

**Your digital legacy, on your terms.**

A self-hosted, encrypted vault that automatically delivers your most sensitive data — passwords, crypto wallets, private notes, files — to the right people if you're ever unreachable.

[![Docker Image](https://img.shields.io/badge/ghcr.io-kotoxie%2Fdeadman-blue?logo=docker&logoColor=white)](https://ghcr.io/kotoxie/deadman)
[![Latest Release](https://img.shields.io/github/v/release/kotoxie/deadman?color=brightgreen&logo=github)](https://github.com/kotoxie/deadman/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)

</div>

---

## What is this?

A **Dead Man's Switch** is a mechanism that activates when you *stop* doing something — in this case, checking in. If you miss your check-in window, the system automatically delivers your designated secrets to the people you trust.

Think of it as a digital will for your online life: your family gets the crypto wallet, your business partner gets the server credentials, your lawyer gets the private documents — all encrypted until the moment it matters.

> ⚠️ **Disclaimer:** Built with AI assistance (Claude) as a functional proof of concept. Security best practices are applied, but no formal audit has been conducted. Use at your own risk for mission-critical data. Always maintain offline backups.

---

## ✨ Features

| Feature | Details |
|---|---|
| 🔐 **Encrypted Vault** | Store notes, passwords, crypto seeds, and files (up to 50 MB) with AES encryption |
| 👥 **Per-Recipient Delivery** | Assign specific items to specific people — no one sees more than intended |
| 📬 **Multi-Channel Delivery** | Email (SMTP), Telegram bot, or custom webhook |
| ⏱️ **Countdown Timer** | Configurable check-in window (default: 14 days) with live countdown |
| 🔔 **Warning Cascade** | Automated alerts at 72h, 48h, 24h, 12h, 6h, and 1h before delivery |
| 🚨 **Panic Button** | Trigger immediate delivery of everything with a single click |
| ⏸️ **Pause Mode** | Freeze the countdown when you're going off-grid (travel, no internet) |
| 📋 **Audit Logs** | Full audit trail of every action taken in the system |
| 🔄 **Delivery Logs** | Track delivery attempts, successes, and retries |
| 🛡️ **Security Hardened** | HTTPS-only with auto-generated TLS, rate limiting, HSTS, CSRF protection, encrypted DB |

---

## 🚀 Quick Start

### Option A — Docker (Recommended)

Pull and run in seconds, no build required:

```yaml
# docker-compose.yml
services:
  deadman:
    image: ghcr.io/kotoxie/deadman:latest
    container_name: deadman-switch
    restart: unless-stopped
    ports:
      - "6680:6680"
    volumes:
      - ./deadman-data:/app/data
    environment:
      - DATA_DIR=/app/data
      - MASTER_PASSWORD=change-me-to-something-strong
      - DB_ENCRYPTION_KEY=generate-a-random-64-char-string
```

```bash
docker compose up -d
```

Then open **https://localhost:6680** 🎉

> ⚠️ **Self-signed certificate:** On first start a TLS certificate is auto-generated and stored in your data volume. Browsers will show a "connection not private" warning — click **Advanced → Proceed**. To use a trusted certificate (e.g. Let's Encrypt), set `TLS_CERT_PATH` and `TLS_KEY_PATH`.

> 💡 **Tip:** Pin a specific version for stability — e.g. `ghcr.io/kotoxie/deadman:0.6.3`

---

### Option B — Build from Source

<details>
<summary>Click to expand build-from-source instructions</summary>

#### 1. Clone the repo

```bash
git clone https://github.com/kotoxie/deadman.git deadman-switch
cd deadman-switch
```

#### 2. Install dependencies

```bash
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

#### 3. Configure environment

```bash
cp .env.example .env
# Edit .env — see Environment Variables section below
```

#### 4. Create `docker-compose.yml`

```yaml
services:
  deadman:
    build: .
    container_name: deadman-switch
    restart: unless-stopped
    ports:
      - "${PORT:-6680}:6680"
    volumes:
      - ./deadman-data:/app/data
    env_file:
      - .env
    environment:
      - DATA_DIR=/app/data
```

#### 5. Build and launch

```bash
docker compose up -d
```

Open **https://localhost:6680** — accept the self-signed certificate warning.

</details>

---

### Option C — Local Development

<details>
<summary>Click to expand local dev instructions</summary>

**Prerequisites:** Node.js 20+, npm

```bash
git clone https://github.com/kotoxie/deadman.git deadman-switch
cd deadman-switch

cd backend && npm install && cd ..
cd frontend && npm install && cd ..

cp .env.example .env

cd backend && node src/index.js
```

Open **https://localhost:6680** — accept the self-signed certificate warning on first run.

The server runs the Express API and serves the frontend on a single HTTPS port.

</details>

---

## ⚙️ Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `MASTER_PASSWORD` | **Yes** | — | Master login password (strong, unique) |
| `DB_ENCRYPTION_KEY` | **Yes** | — | AES-256 vault encryption key — use `openssl rand -hex 32` |
| `SESSION_SECRET` | No | Auto-generated | Session cookie signing key. Auto-generated on first start and stored in `DATA_DIR/session.secret`. Set only if you need a stable value across container recreations without a shared volume. |
| `PORT` | No | `6680` | HTTPS server port |
| `DATA_DIR` | No | `./data` | SQLite database, TLS cert, and session secret directory |
| `TLS_CERT_PATH` | No | — | Path to a custom TLS certificate (PEM). If omitted, a self-signed cert is auto-generated in `DATA_DIR/tls/`. |
| `TLS_KEY_PATH` | No | — | Path to the private key matching `TLS_CERT_PATH`. |
| `LOG_LEVEL` | No | `info` | `error`, `warn`, `info`, or `debug` |
| `SMTP_HOST` | No | — | SMTP hostname (e.g. `smtp.gmail.com`). Can also be set via Settings UI. |
| `SMTP_PORT` | No | `587` | SMTP port |
| `SMTP_USER` | No | — | SMTP username/email |
| `SMTP_PASS` | No | — | SMTP password or app password |
| `SMTP_FROM` | No | — | Sender email address |
| `SMTP_SECURE` | No | `false` | `true` for port 465 (SSL) |
| `TELEGRAM_BOT_TOKEN` | No | — | Bot token from [@BotFather](https://t.me/BotFather) |

> 🔒 **The app refuses to start if `MASTER_PASSWORD` or `DB_ENCRYPTION_KEY` are missing or too weak.**
>
> 🔐 **TLS is always on.** A self-signed certificate is auto-generated on first start. Browsers will warn — click *Advanced → Proceed* or supply a trusted cert via `TLS_CERT_PATH`/`TLS_KEY_PATH`.

SMTP and Telegram can also be configured from the **Settings UI** — values stored there take precedence and are encrypted in the database.

---

## 🔌 API Reference

All routes require authentication (except `/api/auth/*`). Prefix: `/api`

<details>
<summary>Click to expand full API table</summary>

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Login (rate limited: 10 req/15 min) |
| `POST` | `/api/auth/logout` | End session |
| `GET` | `/api/auth/check` | Check auth status |
| `POST` | `/api/auth/change-password` | Change master password |
| `POST` | `/api/auth/skip-password-change` | Skip first-login prompt |
| `GET` | `/api/dashboard` | Dashboard stats + countdown |
| `POST` | `/api/checkin` | Check in (resets deadline) |
| `POST` | `/api/checkin/panic` | Immediate delivery (`X-Confirm: DELIVER` header required) |
| `POST` | `/api/checkin/pause` | Toggle pause/resume |
| `GET` | `/api/vault` | List vault items (metadata only) |
| `POST` | `/api/vault` | Create vault item |
| `GET` | `/api/vault/:id` | Get decrypted item |
| `PUT` | `/api/vault/:id` | Update item |
| `DELETE` | `/api/vault/:id` | Delete item |
| `GET` | `/api/recipients` | List recipients |
| `POST` | `/api/recipients` | Create recipient |
| `GET` | `/api/recipients/:id` | Get recipient + assigned items |
| `PUT` | `/api/recipients/:id` | Update recipient |
| `DELETE` | `/api/recipients/:id` | Delete recipient |
| `POST` | `/api/recipients/:id/assign` | Assign vault items |
| `POST` | `/api/recipients/:id/test` | Send test delivery |
| `GET` | `/api/delivery-logs` | Delivery log (filterable) |
| `POST` | `/api/delivery-logs/:id/retry` | Retry failed delivery |
| `GET` | `/api/audit-logs` | Audit log (filter by category/severity) |
| `GET` | `/api/settings` | Get settings |
| `PUT` | `/api/settings` | Update settings |
| `POST` | `/api/settings/test-email` | Send test email |
| `POST` | `/api/settings/test-telegram` | Send test Telegram message |

</details>

---

## 📄 License

[MIT](LICENSE) — free to use, modify, and self-host.

---

<div align="center">
<sub>Built with ❤️ and a healthy dose of existential planning.</sub>
</div>
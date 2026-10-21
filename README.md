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
      # Recommended: set a stable encryption key so your vault is portable.
      # Generate one with: openssl rand -hex 32
      # If omitted, a key is auto-generated and stored in the data volume,
      # and a warning banner will appear in the app until you set this.
      - DB_ENCRYPTION_KEY=
```

```bash
docker compose up -d
```

Then open **https://localhost:6680** 🎉

> ⚠️ **Self-signed certificate:** On first start a TLS certificate is auto-generated and stored in your data volume. Browsers will show a "connection not private" warning — click **Advanced → Proceed**. To use a trusted certificate (e.g. Let's Encrypt), set `TLS_CERT_PATH` and `TLS_KEY_PATH`.

> 💡 **Tip:** Pin a specific version for stability — e.g. `ghcr.io/kotoxie/deadman:latest`

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

## ⚙️ Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DB_ENCRYPTION_KEY` | No* | Auto-generated | AES-256 vault encryption key. If unset, auto-generated and stored in `DATA_DIR/encryption.key`. **Back up that file.** Set this variable for portability and to silence the in-app warning. Generate: `openssl rand -hex 32` |
| `SESSION_SECRET` | No | Auto-generated | Session cookie signing key. Auto-generated on first start and stored in `DATA_DIR/session.secret`. Set only if you need a stable value across container recreations without a shared volume. |
| `PORT` | No | `6680` | HTTPS server port |
| `DATA_DIR` | No | `./data` | SQLite database, TLS cert, and session secret directory |
| `TLS_CERT_PATH` | No | — | Path to a custom TLS certificate (PEM). If omitted, a self-signed cert is auto-generated in `DATA_DIR/tls/`. |
| `TLS_KEY_PATH` | No | — | Path to the private key matching `TLS_CERT_PATH`. |
| `LOG_LEVEL` | No | `info` | `error`, `warn`, `info`, or `debug` |

> ℹ️ **No required variables.** Everything has a safe default. For production use, set `DB_ENCRYPTION_KEY` to ensure your key is portable and backed up.
>
> 🔐 **TLS is always on.** A self-signed certificate is auto-generated on first start. Browsers will warn — click *Advanced → Proceed* or supply a trusted cert via `TLS_CERT_PATH`/`TLS_KEY_PATH`.

---

## 🔌 API Reference

All routes require authentication (except `/api/auth/*`). Prefix: `/api`

<details>
<summary>Click to expand full API table</summary>

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Login (IP lockout after repeated failures — default 5 attempts, 4h cool-off; configurable) |
| `POST` | `/api/auth/logout` | End session |
| `GET` | `/api/auth/check` | Check auth status |
| `POST` | `/api/auth/setup` | First-run master password setup (public, only works once) |
| `POST` | `/api/auth/change-password` | Change master password |
| `POST` | `/api/auth/skip-password-change` | Skip first-login prompt |
| `GET` | `/api/version` | App version |
| `GET` | `/api/dashboard` | Dashboard stats + countdown |
| `POST` | `/api/checkin` | Check in (resets deadline) |
| `POST` | `/api/checkin/panic` | Immediate delivery (`X-Confirm: DELIVER` header required) |
| `POST` | `/api/checkin/pause` | Toggle pause/resume |
| `POST` | `/api/checkin/test-warning` | Send a test warning notification |
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
| `GET` | `/api/recipients/:id/preview` | Preview what a recipient will receive |
| `POST` | `/api/recipients/:id/preview/send` | Send the preview to the recipient |
| `GET` | `/api/delivery-logs` | Delivery log (filterable) |
| `POST` | `/api/delivery-logs/:id/retry` | Retry failed delivery |
| `GET` | `/api/audit-logs` | Audit log (filter by category/severity) |
| `GET` | `/api/settings` | Get settings (SMTP/Telegram, check-in, security) |
| `PUT` | `/api/settings` | Update settings (SMTP/Telegram are configured only here) |
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

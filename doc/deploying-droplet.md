# Deploying gacha Backend to DigitalOcean Droplet

This guide explains how to deploy the production backend stack on a small (1–2 GB RAM) DigitalOcean Droplet using Docker Compose and Caddy.

---

## Architecture Overview

- **Caddy Reverse Proxy**: Handles SSL/TLS termination automatically via Let's Encrypt and routes traffic.
  - `/api/*` -> Fastify API (`apps/api`)
  - `/health` -> Fastify API health check
  - Fallback -> Static frontend or maintenance placeholder.
- **Fastify API** (`apps/api`): Node.js 22 LTS, heap capped at 384MB via `--max-old-space-size=384`.
- **Worker** (`apps/worker`): Background jobs and pollers, heap capped at 384MB.
- **PostgreSQL 16**: Internal-only network; database ports are **never** exposed to the public internet.
- **Raw Storage**: Volume-mounted storage for raw HTML and PDF payloads.

---

## Droplet Setup Steps

### 1. Provision Droplet
- OS: Ubuntu 24.04 LTS (x64)
- Size: Basic Droplet (1 vCPU, 1 GB or 2 GB RAM with 1 GB swap enabled)
- Add SSH Key

### 2. Configure Firewall (UFW)
Allow only SSH, HTTP, and HTTPS:
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 3. Install Docker & Compose
```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
# Install Docker using official Docker repositories
```

### 4. Deploy Backend Stack
1. Clone repository to `/opt/gacha`.
2. Create production `.env`:
   ```bash
   cd /opt/gacha/backend
   cp .env.example .env
   ```
   Configure strong values for:
   ```bash
   POSTGRES_PASSWORD=generate_a_secure_password_here
   ADMIN_TOKEN=generate_a_secure_admin_token_here
   DOMAIN=api.yourdomain.com
   ACME_EMAIL=your-email@example.com
   DATABASE_URL=postgresql://postgres:generate_a_secure_password_here@postgres:5432/gacha
   ```
3. Start production containers:
   ```bash
   docker compose -f compose.prod.yml up -d --build
   ```

---

## Automated Backups

To back up PostgreSQL daily to `/var/backups/gacha`:

1. Make backup script executable:
   ```bash
   chmod +x /opt/gacha/backend/scripts/backup.sh
   ```

2. Add a cron job:
   ```bash
   sudo crontab -e
   ```
   Add the following line to run every night at 02:00 UTC:
   ```cron
   0 2 * * * /opt/gacha/backend/scripts/backup.sh >> /var/log/gacha-backup.log 2>&1
   ```
   Backups older than 14 days are automatically pruned.

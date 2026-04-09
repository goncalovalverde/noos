# Deployment — Orange Pi (self-hosted runner)

## Architecture

```
GitHub push → Actions test job (ubuntu-latest) → deploy job (self-hosted / Orange Pi)
                                                       ↓
                                              docker compose build
                                              docker compose up -d
                                                       ↓
                                    ┌──────────────────────────────┐
                                    │  Orange Pi (arm64)           │
                                    │  port 80                     │
                                    │  ┌─────────┐  ┌──────────┐  │
                                    │  │ nginx   │  │ FastAPI  │  │
                                    │  │ (React) │→ │ (uvicorn)│  │
                                    │  └─────────┘  └────┬─────┘  │
                                    │                    │         │
                                    │              volume: noos_db │
                                    │              (SQLite + PDFs) │
                                    └──────────────────────────────┘
```

## One-time server setup

### 1. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# log out and back in
```

### 2. Clone the repo

```bash
git clone https://github.com/<your-org>/noos.git /opt/noos
```

### 3. Configure secrets

```bash
cd /opt/noos
cp backend/.env.example backend/.env
nano backend/.env
# Set: SECRET_KEY, ADMIN_PASSWORD, POSTGRES_PASSWORD
```

Generate a strong secret key:
```bash
openssl rand -hex 32
```

> **Note:** `DATABASE_URL` is set automatically by `docker-compose.prod.yml` using
> the `POSTGRES_PASSWORD` you configured. You do **not** need to set it manually.

### 4. Install the GitHub Actions self-hosted runner

Go to your GitHub repo → **Settings → Actions → Runners → New self-hosted runner**.

Select **Linux / ARM64**, then follow the shown commands on the Orange Pi.

Run the runner as a service so it survives reboots:
```bash
cd ~/actions-runner
sudo ./svc.sh install
sudo ./svc.sh start
```

### 5. First deploy

```bash
cd /opt/noos
docker compose -f docker-compose.prod.yml up -d --build
```

The app will be available at `http://<orange-pi-ip>`.

---

## Ongoing deploys

Push to `main` → tests run on GitHub → if green, Orange Pi builds and restarts containers automatically.

You can also trigger a manual deploy from **GitHub → Actions → Deploy to Orange Pi → Run workflow**.

---

## Data persistence

All persistent data is stored in named Docker volumes:

| Volume | Contents |
|---|---|
| `noos_pgdata` | PostgreSQL data directory |
| `noos_reports` | Generated PDF / Word reports |

### Backup

```bash
# Database
docker compose -f docker-compose.prod.yml exec db \
  pg_dump -U noos noos | gzip > noos-db-$(date +%Y%m%d).sql.gz

# Reports
docker run --rm \
  -v noos_noos_reports:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/noos-reports-$(date +%Y%m%d).tar.gz /data
```

### Restore

```bash
# Database
gunzip -c noos-db-YYYYMMDD.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U noos noos
```

---

## Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Backend only
docker compose -f docker-compose.prod.yml logs -f backend
```

## Update environment variables

```bash
nano /opt/noos/backend/.env
docker compose -f docker-compose.prod.yml up -d --no-build
```

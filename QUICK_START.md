# PageDrift - Quick Start Guide

⚡ Get PageDrift running in 5 minutes with Docker.

## Prerequisites

- Docker and Docker Compose installed
- Ports 3000 and 7700 available

## Setup

### 1. Clone and Navigate

```bash
cd EBookVoyage/EBookVoyage
```

### 2. Create Environment File

```bash
# Linux/Mac
cp .env.docker .env

# Windows
copy .env.docker .env
```

### 3. Generate Secure Secrets

```bash
# Linux/Mac
openssl rand -base64 32

# Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Run the command twice to generate two secrets.

### 4. Edit .env File

Open `.env` and replace these values:

```env
JWT_SECRET="<paste-first-secret-here>"
MEILISEARCH_KEY="<paste-second-secret-here>"
MEILISEARCH_MASTER_KEY="<paste-second-secret-here>"
ORIGIN="http://localhost:3000"
```

### 5. Verify Setup (Optional but Recommended)

```bash
# Linux/Mac
bash verify-docker-setup.sh

# Windows
verify-docker-setup.bat
```

### 6. Deploy

```bash
docker-compose up -d
```

Wait 30-60 seconds for services to become healthy.

### 7. Access Application

Open browser to: **http://localhost:3000**

### 8. Create Admin User

1. Click "Register"
2. Fill in your details
3. Submit (you're automatically the admin!)

## Next Steps

- Upload books from the library page
- Manage users at `/admin`
- Configure permissions for other users

## Common Commands

```bash
# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Restart
docker-compose restart

# Update application
git pull
docker-compose up -d --build
```

## Troubleshooting

### Services Won't Start

```bash
# Check logs
docker-compose logs

# Check status
docker-compose ps
```

### Can't Access Application

1. Verify services are healthy: `docker-compose ps`
2. Check port 3000 isn't in use: `lsof -i :3000` (Mac/Linux)
3. Review logs: `docker-compose logs app`

### Meilisearch Connection Error

```bash
# Restart in order
docker-compose restart meilisearch
sleep 5
docker-compose restart app
```

## Need More Help?

- **Comprehensive Guide**: See `DOCKER_DEPLOYMENT.md`
- **Troubleshooting**: See `DOCKER_DEPLOYMENT.md` § Troubleshooting
- **Configuration**: See `.env.example` for all variables

## Security Reminder

🔒 **Before deploying to production**:

1. ✅ Generate unique secrets (not default values)
2. ✅ Use HTTPS with reverse proxy
3. ✅ Set `ORIGIN` to your actual domain
4. ✅ Backup `./data` directory regularly

---

**Ready to deploy?** `docker-compose up -d` 🚀


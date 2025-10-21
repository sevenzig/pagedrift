# Docker Deployment Guide

Complete guide for deploying PageDrift using Docker and docker-compose.

## 🚀 Quick Start

For first-time deployment, follow these steps in order:

### 1. Prerequisites

- Docker 20.10+ installed
- Docker Compose 2.0+ installed
- At least 2GB free disk space
- Port 3000 and 7700 available (or change in docker-compose.yml)

### 2. Environment Setup

**Create your `.env` file from the example:**

```bash
cp .env.example .env
```

**Edit `.env` and configure these REQUIRED variables:**

```bash
# Generate secure secrets (run these commands):
openssl rand -base64 32  # Use output for JWT_SECRET
openssl rand -base64 32  # Use output for MEILISEARCH_MASTER_KEY
```

**Minimum required `.env` configuration for Docker:**

```env
# Database (Docker path)
DATABASE_URL="file:/app/data/db/sqlite.db"

# JWT Secret (CHANGE THIS!)
JWT_SECRET="your-generated-secret-here"

# Meilisearch (Docker service name)
MEILISEARCH_HOST="http://meilisearch:7700"
MEILISEARCH_KEY="your-generated-secret-here"
MEILISEARCH_MASTER_KEY="your-generated-secret-here"

# Storage (Docker path)
BOOKS_STORAGE_PATH="/app/data/books"

# Application
NODE_ENV="production"
PORT="3000"
ORIGIN="http://localhost:3000"
```

> **⚠️ IMPORTANT**: `JWT_SECRET`, `MEILISEARCH_KEY`, and `MEILISEARCH_MASTER_KEY` MUST be changed from defaults for production!

### 3. Build and Start

```bash
# Build the Docker images
docker-compose build

# Start all services in detached mode
docker-compose up -d

# Watch the logs (optional)
docker-compose logs -f
```

### 4. Verify Deployment

**Check service health:**

```bash
# Check all services are running
docker-compose ps

# You should see both 'app' and 'meilisearch' with status "Up (healthy)"
```

**Test the application:**

1. Open browser to `http://localhost:3000`
2. You should see the registration page
3. Register the first user (becomes admin automatically)
4. Log in and verify you can access the library

**Test Meilisearch:**

```bash
# Should return {"status":"available"}
curl http://localhost:7700/health
```

### 5. First User Setup

1. Navigate to `http://localhost:3000/register`
2. Create your account (first user automatically becomes admin)
3. Log in with your credentials
4. Go to `/admin` to manage users and permissions

## 📋 Environment Variables Reference

### Required Variables

| Variable | Description | Docker Value | Example |
|----------|-------------|--------------|---------|
| `DATABASE_URL` | SQLite database path | `file:/app/data/db/sqlite.db` | Same |
| `JWT_SECRET` | JWT signing secret | Generate with `openssl rand -base64 32` | `xK9m2nP...` |
| `MEILISEARCH_HOST` | Meilisearch URL | `http://meilisearch:7700` | Same |
| `MEILISEARCH_KEY` | Meilisearch API key | Generate with `openssl rand -base64 32` | `aB3c4D...` |
| `MEILISEARCH_MASTER_KEY` | Meilisearch master key | Same as `MEILISEARCH_KEY` | Same |
| `BOOKS_STORAGE_PATH` | Book storage path | `/app/data/books` | Same |
| `NODE_ENV` | Environment mode | `production` | Same |
| `ORIGIN` | Public app URL | Your domain or `http://localhost:3000` | `https://books.example.com` |

### Optional Variables

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `PORT` | Application port | `3000` | Must match docker-compose port mapping |

## 🔧 Common Operations

### View Logs

```bash
# All services
docker-compose logs -f

# Just the app
docker-compose logs -f app

# Just Meilisearch
docker-compose logs -f meilisearch

# Last 100 lines
docker-compose logs --tail=100
```

### Restart Services

```bash
# Restart all services
docker-compose restart

# Restart just the app
docker-compose restart app

# Restart with rebuild
docker-compose up -d --build
```

### Stop Services

```bash
# Stop but keep containers
docker-compose stop

# Stop and remove containers (data is preserved in volumes)
docker-compose down

# Stop and remove everything including volumes (⚠️ DELETES ALL DATA)
docker-compose down -v
```

### Update Application

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose up -d --build

# Verify
docker-compose ps
```

### Database Operations

```bash
# Run Prisma migrations
docker-compose exec app npx prisma migrate deploy

# Open Prisma Studio (database GUI)
docker-compose exec app npx prisma studio

# Backup database
cp ./data/db/sqlite.db ./data/db/sqlite.db.backup-$(date +%Y%m%d)

# Restore database
docker-compose down
cp ./data/db/sqlite.db.backup-YYYYMMDD ./data/db/sqlite.db
docker-compose up -d
```

### Shell Access

```bash
# Open shell in app container
docker-compose exec app sh

# Open shell in meilisearch container
docker-compose exec meilisearch sh
```

## 🐛 Troubleshooting

### Docker Build Timeout / npm ci Failures

**Problem**: Build fails with `EIDLETIMEOUT` error during `npm ci` or dependency installation timeouts

**Error Messages**:
```
npm error code EIDLETIMEOUT
npm error Idle timeout reached for host `registry.npmjs.org:443`
ERROR: process "/bin/sh -c npm ci" did not complete successfully: exit code: 1
```

**Root Causes**:
- Slow or unreliable network connection to npm registry
- Large dependency tree taking too long to download
- npm registry temporary issues or rate limiting
- Docker build context issues in Dokploy or CI/CD environments

**Solutions**:

1. **Verify npm configuration is present** (already implemented in Dockerfile):
   - The Dockerfile now includes retry logic and extended timeouts
   - `.npmrc` file configures fetch retries and timeout values
   - Build will automatically retry up to 5 times with exponential backoff

2. **Use BuildKit for better caching** (Dokploy users):
   ```bash
   # Enable BuildKit in Docker daemon
   export DOCKER_BUILDKIT=1
   
   # Or add to /etc/docker/daemon.json:
   {
     "features": {
       "buildkit": true
     }
   }
   ```

3. **Increase Docker daemon timeout** (if you control the build environment):
   ```bash
   # Edit /etc/docker/daemon.json
   {
     "max-concurrent-downloads": 3,
     "max-concurrent-uploads": 5,
     "default-runtime": "runc"
   }
   ```

4. **Use npm mirror or proxy** (for persistent issues):
   
   Add to `.npmrc`:
   ```
   registry=https://registry.npmmirror.com/
   ```
   
   Or use a corporate proxy:
   ```
   proxy=http://proxy.company.com:8080
   https-proxy=http://proxy.company.com:8080
   ```

5. **Build locally and push image** (workaround for Dokploy):
   ```bash
   # Build on a machine with better connectivity
   docker build -t your-registry/pagedrift:latest .
   docker push your-registry/pagedrift:latest
   
   # Update docker-compose.yml to use pre-built image
   services:
     app:
       image: your-registry/pagedrift:latest
       # Comment out build section
   ```

6. **Clear Docker build cache and retry**:
   ```bash
   # Clear build cache
   docker builder prune -af
   
   # Rebuild without cache
   docker-compose build --no-cache
   ```

7. **Check network connectivity during build**:
   ```bash
   # Test npm registry access
   curl -I https://registry.npmjs.org/
   
   # Check for network issues
   ping registry.npmjs.org
   ```

**Expected Behavior After Fixes**:
- Build will retry failed downloads automatically
- Extended timeout allows slow networks to complete
- Progress will be logged at error level for easier debugging
- Builds should succeed on networks with occasional packet loss

**If Issues Persist**:
- Contact Dokploy support if building on their platform
- Check npm status page: https://status.npmjs.org/
- Consider scheduling builds during off-peak hours
- Use a VPS with better network connectivity for building

### Services Won't Start

**Problem**: `docker-compose up -d` fails or services exit immediately

**Solutions**:

1. Check logs for specific errors:
   ```bash
   docker-compose logs
   ```

2. Verify `.env` file exists and has correct values:
   ```bash
   cat .env
   ```

3. Check port availability:
   ```bash
   # Linux/Mac
   lsof -i :3000
   lsof -i :7700
   
   # Windows
   netstat -ano | findstr :3000
   netstat -ano | findstr :7700
   ```

4. Remove old containers and rebuild:
   ```bash
   docker-compose down
   docker-compose up -d --build
   ```

### Meilisearch Connection Failed

**Problem**: App logs show "Failed to connect to Meilisearch"

**Solutions**:

1. Verify Meilisearch is healthy:
   ```bash
   docker-compose ps meilisearch
   curl http://localhost:7700/health
   ```

2. Check `MEILISEARCH_HOST` is set correctly:
   ```bash
   # Should be http://meilisearch:7700 (not localhost!)
   docker-compose exec app printenv MEILISEARCH_HOST
   ```

3. Verify API keys match:
   ```bash
   docker-compose exec app printenv MEILISEARCH_KEY
   docker-compose exec meilisearch printenv MEILI_MASTER_KEY
   ```

4. Restart services in order:
   ```bash
   docker-compose restart meilisearch
   sleep 5
   docker-compose restart app
   ```

### Database Migration Errors

**Problem**: Container exits with Prisma migration errors

**Solutions**:

1. Check migration status:
   ```bash
   docker-compose exec app npx prisma migrate status
   ```

2. Reset and reapply migrations (⚠️ deletes data):
   ```bash
   docker-compose down
   rm -rf ./data/db/sqlite.db*
   docker-compose up -d
   ```

3. Manual migration:
   ```bash
   docker-compose exec app npx prisma migrate deploy
   ```

### Permission Errors

**Problem**: "EACCES: permission denied" errors in logs

**Solutions**:

1. Fix data directory permissions:
   ```bash
   # Linux/Mac
   chmod -R 755 ./data
   chown -R 1000:1000 ./data
   
   # Or match your user
   sudo chown -R $(id -u):$(id -g) ./data
   ```

2. Rebuild with correct permissions:
   ```bash
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   ```

### Can't Access Application

**Problem**: Browser shows "connection refused" at `http://localhost:3000`

**Solutions**:

1. Verify app is running and healthy:
   ```bash
   docker-compose ps
   # Should show "Up (healthy)" for app service
   ```

2. Check app logs for startup errors:
   ```bash
   docker-compose logs app
   ```

3. Test from inside container:
   ```bash
   docker-compose exec app wget -O- http://localhost:3000/api/auth/me
   ```

4. Verify port mapping:
   ```bash
   docker-compose ps
   # Should show "0.0.0.0:3000->3000/tcp"
   ```

### Healthcheck Failing

**Problem**: Services show "Up (unhealthy)" status

**Solutions**:

1. Check healthcheck logs:
   ```bash
   docker inspect <container_id> | grep -A 10 Health
   ```

2. Test healthcheck endpoints manually:
   ```bash
   # Meilisearch
   docker-compose exec meilisearch wget -O- http://localhost:7700/health
   
   # App
   docker-compose exec app wget -O- http://localhost:3000/api/auth/me
   ```

3. Increase healthcheck timeout in docker-compose.yml:
   ```yaml
   healthcheck:
     start_period: 60s  # Increase from 40s
     timeout: 10s       # Increase from 5s
   ```

## 🌐 Dokploy Deployment

### Special Instructions for Dokploy

Dokploy requires additional steps to ensure data persistence across deployments. The volume configuration uses `external: true` to prevent Docker from recreating volumes.

#### Initial Setup (First Time Only)

1. **SSH into your Dokploy server**:
   ```bash
   ssh user@your-server.com
   cd /path/to/project
   ```

2. **Create the persistent volume**:
   ```bash
   docker volume create phelddagrif_ebook_data
   ```

3. **Verify volume creation**:
   ```bash
   docker volume ls | grep phelddagrif_ebook_data
   # Should show: local     phelddagrif_ebook_data
   ```

#### Pre-Deployment Verification

Before each deployment, run the verification script to ensure the volume exists:

```bash
# Make script executable (first time only)
chmod +x ensure-volume.sh

# Run pre-deployment check
./ensure-volume.sh
```

This script will:
- ✓ Check if the volume exists (creates it if missing)
- ✓ Verify volume contents and data integrity
- ✓ Display database and books statistics
- ✓ Confirm volume is ready for deployment

#### Deployment via Dokploy UI

1. Navigate to your project in Dokploy
2. Click "Deploy" or trigger a rebuild
3. Wait for build and deployment to complete
4. Run post-deployment verification (see below)

#### Deployment via CLI

```bash
# Standard deployment
docker-compose up -d --build

# Or with explicit pull and rebuild
docker-compose pull
docker-compose up -d --build --force-recreate
```

#### Post-Deployment Verification

After deployment, verify persistence is working:

```bash
# Make script executable (first time only)
chmod +x verify-persistence.sh

# Run post-deployment verification
./verify-persistence.sh
```

This script will:
- ✓ Confirm volume is mounted correctly
- ✓ Verify database accessibility
- ✓ Check file permissions
- ✓ Test application health
- ✓ Report any issues

#### Testing Data Persistence

To verify data survives redeployment:

1. **Create test data**:
   ```bash
   # Register a user at https://your-domain.com/register
   # Upload a test book
   ```

2. **Record test data**:
   ```bash
   # Note the user email and book title for verification
   ```

3. **Redeploy the application**:
   ```bash
   docker-compose down
   docker-compose up -d --build
   ```

4. **Verify data persists**:
   ```bash
   # Log in with the same user credentials
   # Verify the book is still accessible
   ```

#### Troubleshooting Dokploy Persistence

**Issue: 401 Unauthorized after redeployment**

This means the database is being wiped. Check:

```bash
# Verify volume exists
docker volume ls | grep phelddagrif_ebook_data

# Check if volume contains data
docker run --rm -v phelddagrif_ebook_data:/data alpine ls -la /data/db/

# Inspect container mounts
docker inspect $(docker ps -q -f name=ebookvoyage) | grep -A 20 Mounts
```

**Issue: Volume not found during deployment**

```bash
# Manually create the volume
docker volume create phelddagrif_ebook_data

# Verify creation
docker volume inspect phelddagrif_ebook_data

# Redeploy
docker-compose up -d
```

**Issue: Old data exists but not being used**

```bash
# List all volumes to find orphaned data
docker volume ls

# Check each volume for data
docker run --rm -v <volume_name>:/data alpine ls -la /data/

# If found, migrate data:
docker volume create phelddagrif_ebook_data
docker run --rm -v <old_volume>:/source -v phelddagrif_ebook_data:/target alpine cp -r /source/. /target/
```

**Issue: Permission denied errors**

```bash
# Fix permissions in volume
docker run --rm -v phelddagrif_ebook_data:/data alpine sh -c "chmod -R 755 /data && chown -R 1000:1000 /data"

# Restart container
docker-compose restart
```

#### Dokploy Volume Backup

Since Dokploy deployments can be unpredictable, regular backups are critical:

```bash
# Backup volume to tar.gz
docker run --rm \
  -v phelddagrif_ebook_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/ebook_backup_$(date +%Y%m%d_%H%M%S).tar.gz -C /data .

# List backups
ls -lh ebook_backup_*.tar.gz

# Restore from backup
docker run --rm \
  -v phelddagrif_ebook_data:/data \
  -v $(pwd):/backup \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/ebook_backup_TIMESTAMP.tar.gz -C /data"
```

#### Automated Backup Script for Dokploy

Create `/usr/local/bin/backup-ebook-dokploy.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/backups/ebook-reader"
VOLUME_NAME="phelddagrif_ebook_data"
DATE=$(date +%Y%m%d_%H%M%S)
KEEP_DAYS=7

mkdir -p "$BACKUP_DIR"

# Create backup
docker run --rm \
  -v "$VOLUME_NAME:/data" \
  -v "$BACKUP_DIR:/backup" \
  alpine tar czf "/backup/ebook_backup_$DATE.tar.gz" -C /data .

# Remove old backups
find "$BACKUP_DIR" -name "ebook_backup_*.tar.gz" -mtime +$KEEP_DAYS -delete

echo "Backup completed: ebook_backup_$DATE.tar.gz"
```

Setup automated backups:
```bash
# Make executable
chmod +x /usr/local/bin/backup-ebook-dokploy.sh

# Add to crontab (daily at 3 AM)
echo "0 3 * * * /usr/local/bin/backup-ebook-dokploy.sh >> /var/log/ebook-backup.log 2>&1" | crontab -
```

## 🔒 Security Best Practices

### Before Deploying to Production

1. **Change All Secrets**:
   ```bash
   # Generate new secrets
   openssl rand -base64 32
   ```
   Update `JWT_SECRET`, `MEILISEARCH_KEY`, and `MEILISEARCH_MASTER_KEY`

2. **Use HTTPS**:
   - Deploy behind a reverse proxy (nginx, Caddy, Traefik)
   - Use Let's Encrypt for SSL certificates
   - Update `ORIGIN` to your HTTPS domain

3. **Restrict Ports**:
   - Only expose port 3000 publicly
   - Keep Meilisearch port 7700 internal:
     ```yaml
     meilisearch:
       ports:
         - "127.0.0.1:7700:7700"  # Only accessible locally
     ```

4. **Regular Backups**:
   - Backup `./data/db/sqlite.db` regularly
   - Backup `./data/books/` directory
   - Consider automated backup script

5. **Update Dependencies**:
   ```bash
   # Regularly rebuild with latest security patches
   docker-compose build --no-cache
   docker-compose up -d
   ```

## 📦 Data Persistence

All data is stored in the `./data` directory on your host:

```
./data/
├── db/
│   └── sqlite.db          # Database (users, books metadata, progress)
├── books/
│   └── {bookId}/          # Uploaded book files
│       └── book.epub
└── meili_data/            # Meilisearch index data
```

**Backup Strategy**:

```bash
# Full backup
tar -czf pagedrift-backup-$(date +%Y%m%d).tar.gz ./data

# Restore backup
docker-compose down
tar -xzf pagedrift-backup-YYYYMMDD.tar.gz
docker-compose up -d
```

## 🌐 Reverse Proxy Setup

### Nginx Example

```nginx
server {
    listen 80;
    server_name books.example.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Caddy Example

```caddy
books.example.com {
    reverse_proxy localhost:3000
}
```

## 📊 Monitoring

### Check Resource Usage

```bash
# Container stats
docker stats

# Disk usage
docker system df
du -sh ./data
```

### Performance Tuning

For large libraries (1000+ books):

1. **Increase container resources** in docker-compose.yml:
   ```yaml
   app:
     deploy:
       resources:
         limits:
           memory: 2G
           cpus: '2'
   ```

2. **Monitor Meilisearch index size**:
   ```bash
   du -sh ./data/meili_data
   ```

## 🆘 Support

If issues persist:

1. Collect full logs: `docker-compose logs > debug.log`
2. Check GitHub Issues
3. Include error messages and environment details (without secrets!)

## 📝 Maintenance Schedule

**Weekly**:
- Check logs for errors
- Monitor disk space

**Monthly**:
- Backup database
- Update Docker images
- Review user access

**Quarterly**:
- Full backup verification
- Security audit
- Dependency updates


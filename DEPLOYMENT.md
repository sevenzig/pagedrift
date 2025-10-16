# Deployment Guide for EBook Voyage

## Quick Start with Dokploy

### Step 1: Prepare Environment Variables

Generate secure secrets for production:

```bash
# Generate JWT secret (copy output)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate Meilisearch master key (copy output)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 2: Set Environment Variables in Dokploy

In your Dokploy application settings, add these environment variables:

```env
JWT_SECRET=<your-generated-jwt-secret>
MEILISEARCH_MASTER_KEY=<your-generated-meilisearch-key>
DATABASE_URL=file:/app/data/db/sqlite.db
MEILISEARCH_HOST=http://meilisearch:7700
MEILISEARCH_KEY=<same-as-meilisearch-master-key>
BOOKS_STORAGE_PATH=/app/data/books
NODE_ENV=production
ORIGIN=https://your-domain.com
```

### Step 3: Configure Volumes

Map the following volume in Dokploy:
- Host: `./data`
- Container: `/app/data`

This persists:
- SQLite database
- Uploaded books
- Meilisearch index

### Step 4: Deploy

1. Click "Deploy" in Dokploy
2. Wait for build to complete
3. Navigate to your domain
4. Register the first user (becomes admin)

## Manual Docker Deployment

### 1. Clone and Configure

```bash
git clone <your-repo-url>
cd ebook-voyage
cp .env.example .env
# Edit .env with production values
```

### 2. Build and Start

```bash
docker-compose up -d
```

### 3. Check Logs

```bash
docker-compose logs -f app
docker-compose logs -f meilisearch
```

### 4. Access Application

Navigate to `http://localhost:3000` (or your configured domain)

## Post-Deployment Checklist

- [ ] Register first admin user
- [ ] Test file upload
- [ ] Test search functionality
- [ ] Configure user permissions
- [ ] Set up backups (see below)
- [ ] Configure reverse proxy/SSL (if not using Dokploy)

## Backup Strategy

### Database Backup

```bash
# Backup SQLite database
cp ./data/db/sqlite.db ./backups/sqlite-$(date +%Y%m%d).db

# Restore
cp ./backups/sqlite-20250116.db ./data/db/sqlite.db
```

### Books Backup

```bash
# Backup uploaded books
tar -czf backups/books-$(date +%Y%m%d).tar.gz ./data/books/

# Restore
tar -xzf backups/books-20250116.tar.gz -C ./data/
```

### Automated Backups

Add to crontab:

```bash
# Daily backup at 2 AM
0 2 * * * /path/to/backup-script.sh
```

Example `backup-script.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/backups/ebook-voyage"
DATE=$(date +%Y%m%d)

mkdir -p $BACKUP_DIR

# Backup database
cp /app/data/db/sqlite.db $BACKUP_DIR/sqlite-$DATE.db

# Backup books (optional, can be large)
# tar -czf $BACKUP_DIR/books-$DATE.tar.gz /app/data/books/

# Keep only last 7 days
find $BACKUP_DIR -name "sqlite-*.db" -mtime +7 -delete
```

## Scaling Considerations

### SQLite Limitations

SQLite is suitable for:
- Small to medium deployments (<100 users)
- Low to moderate concurrent access
- Simple deployment requirements

For larger deployments, consider:
- PostgreSQL (requires schema migration)
- Read replicas for search
- Separate file storage (S3, MinIO)

### Meilisearch Scaling

Meilisearch can handle:
- Millions of documents
- High query throughput
- Multiple indexes

For very large deployments:
- Increase Meilisearch memory
- Use dedicated Meilisearch server
- Configure index settings for performance

## Monitoring

### Health Checks

```bash
# App health
curl https://your-domain.com/

# Meilisearch health
curl https://your-domain.com:7700/health
```

### Logs

```bash
# View app logs
docker-compose logs -f app

# View Meilisearch logs
docker-compose logs -f meilisearch

# View last 100 lines
docker-compose logs --tail=100 app
```

### Disk Usage

```bash
# Check data directory size
du -sh ./data/

# Check individual components
du -sh ./data/db/
du -sh ./data/books/
du -sh ./data/meili_data/
```

## Troubleshooting

### Meilisearch Not Connecting

```bash
# Check if Meilisearch is running
docker-compose ps meilisearch

# Check logs
docker-compose logs meilisearch

# Restart Meilisearch
docker-compose restart meilisearch
```

### Database Locked Errors

SQLite can have lock issues under high concurrency:

```bash
# Check for zombie processes
ps aux | grep node

# Restart app
docker-compose restart app
```

### Out of Disk Space

```bash
# Check disk usage
df -h

# Clean up old books (be careful!)
# Implement retention policy in admin panel

# Clear Meilisearch index and re-index
docker-compose exec app npx prisma migrate reset
```

### Permission Issues

```bash
# Fix data directory permissions
chmod -R 755 ./data
chown -R 1000:1000 ./data
```

## Security Hardening

### Production Checklist

- [ ] Use strong JWT_SECRET (32+ characters)
- [ ] Use strong MEILISEARCH_MASTER_KEY
- [ ] Enable HTTPS (via reverse proxy or Dokploy)
- [ ] Set secure CORS origins
- [ ] Regular security updates
- [ ] Monitor access logs
- [ ] Implement rate limiting (add nginx/cloudflare)
- [ ] Regular backups
- [ ] Restrict file upload types
- [ ] Scan uploaded files (optional)

### Reverse Proxy (nginx)

Example nginx configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/ssl/certs/your-domain.crt;
    ssl_certificate_key /etc/ssl/private/your-domain.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Updating

### Update Application

```bash
# Pull latest code
git pull origin master

# Rebuild and restart
docker-compose down
docker-compose up -d --build

# Check for migrations
docker-compose exec app npx prisma migrate deploy
```

### Update Dependencies

```bash
# Update npm packages
npm update

# Rebuild
docker-compose up -d --build
```

## Support

For issues and questions:
- Check logs: `docker-compose logs`
- Review README.md
- Check GitHub issues
- Create new issue with logs and configuration

---

**Happy reading! 📚**


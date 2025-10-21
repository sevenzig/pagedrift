# Dokploy Volume Setup Guide

This guide will help you configure Docker volume persistence in Dokploy to ensure your ebook reader data (user accounts, books, reading progress) survives deployments and restarts.

## Quick Reference

**Dokploy UI Volume Configuration:**
- **Mount Type:** Volume Mount
- **Host Path:** `phelddagrif_ebook_data`
- **Mount Path:** `/app/data`

## Prerequisites

- SSH access to your Dokploy server
- Docker installed and running
- Basic familiarity with terminal commands

## Step-by-Step Setup

### Step 1: Connect to Your Dokploy Server

```bash
ssh user@your-dokploy-server.com
cd /path/to/your/ebook-reader/project
```

### Step 2: Discover Existing Data

Before making any changes, check if you have existing data:

```bash
# Make the script executable
chmod +x find-existing-data.sh

# Run the discovery script
./find-existing-data.sh
```

The script will:
- ✓ Search for all ebook-related volumes
- ✓ Check each volume for database and book files
- ✓ Report which volume(s) contain your data
- ✓ Provide specific migration commands if needed

**Read the output carefully** - it will tell you exactly what to do next.

### Step 3: Create or Migrate Volume

Based on the discovery script output, follow the appropriate path:

#### Path A: No Existing Data (Fresh Install)

If the script reports "No existing data found":

```bash
# Create the external volume
docker volume create phelddagrif_ebook_data

# Verify creation
docker volume inspect phelddagrif_ebook_data
```

You're done! Skip to Step 4.

#### Path B: Data Already in Correct Volume

If the script reports "Volume name is correct! (phelddagrif_ebook_data)":

```bash
# Just verify it exists
docker volume inspect phelddagrif_ebook_data
```

You're done! Skip to Step 4.

#### Path C: Data in Different Volume (Migration Required)

If the script found data in a different volume (e.g., `ebookvoyage_ebook_data`), use the migration commands provided by the script.

Example migration:

```bash
# 1. Create target volume
docker volume create phelddagrif_ebook_data

# 2. Copy data (replace <old_volume_name> with actual name)
docker run --rm \
  -v <old_volume_name>:/source \
  -v phelddagrif_ebook_data:/target \
  alpine cp -r /source/. /target/

# 3. Verify migration
docker run --rm -v phelddagrif_ebook_data:/data alpine ls -la /data/

# 4. Check database exists
docker run --rm -v phelddagrif_ebook_data:/data alpine ls -la /data/db/sqlite.db

# 5. Check books directory
docker run --rm -v phelddagrif_ebook_data:/data alpine ls -la /data/books/
```

**Expected output after verification:**
- Should see `sqlite.db` file in `/data/db/`
- Should see book files in `/data/books/` (if you had uploaded books)

### Step 4: Verify docker-compose.yml Configuration

Ensure your `docker-compose.yml` has the correct volume configuration:

```bash
# Check the volume section
grep -A 3 "^volumes:" docker-compose.yml
```

**Expected output:**
```yaml
volumes:
  ebook_data:
    external: true
    name: phelddagrif_ebook_data
```

If it doesn't match, the `docker-compose.yml` in this repository should already be updated. Pull the latest changes:

```bash
git pull origin master
```

### Step 5: Configure Dokploy UI

Now configure the volume mount in Dokploy:

1. **Open Dokploy Dashboard**
   - Navigate to your ebook reader project
   - Go to "Settings" or "Volumes" section

2. **Add/Edit Volume Mount**
   - Click "Add Volume" or edit existing volume
   - Configure the fields:

   | Field | Value |
   |-------|-------|
   | **Mount Type** | Volume Mount |
   | **Host Path** | `phelddagrif_ebook_data` |
   | **Mount Path** | `/app/data` |

3. **Save Configuration**
   - Click "Create" or "Save"
   - The mount should now appear in your volumes list

### Step 6: Deploy the Application

Deploy via Dokploy:

1. **Via Dokploy UI:**
   - Go to your project dashboard
   - Click "Deploy" button
   - Wait for build and deployment to complete

2. **Via CLI (alternative):**
   ```bash
   docker-compose up -d --build
   ```

### Step 7: Verify Persistence

After deployment, verify everything is working:

```bash
# Run the verification script
chmod +x verify-persistence.sh
./verify-persistence.sh
```

The script will check:
- ✓ Volume is mounted correctly
- ✓ Database is accessible
- ✓ File permissions are correct
- ✓ Application health

**Expected output:** "All critical checks passed - persistence is configured correctly!"

### Step 8: Test Data Persistence (Critical!)

This is the final test to ensure data survives redeployment:

#### Create Test Data

1. Open your ebook reader: `https://books.phelddagrif.farm`
2. Register a new test user account
3. Upload a test book
4. Note the credentials and book title

#### Test Redeployment

```bash
# Stop and remove containers (but volume remains)
docker-compose down

# Verify volume still exists
docker volume inspect phelddagrif_ebook_data

# Redeploy
docker-compose up -d

# Wait for startup
sleep 30
```

#### Verify Data Survived

1. Go to `https://books.phelddagrif.farm/login`
2. Log in with the test credentials
3. Verify the test book is still visible

**✅ Success:** If you can log in and see your book, persistence is working!

**❌ Failed:** If you get 401 error or book is missing, see troubleshooting below.

## Dokploy-Specific Notes

### Why `external: true` is Critical

Dokploy's deployment process runs `docker-compose down` before redeploying. With `external: true`:
- ✓ Docker Compose never deletes the volume
- ✓ Volume persists across all deployments
- ✓ Data is safe during rebuilds

Without `external: true`:
- ✗ Docker Compose may delete the volume
- ✗ Data loss on every deployment
- ✗ 401 errors after restart

### Volume Lifecycle

- **Created:** Once, manually, before first deployment
- **Managed:** Externally (never by Docker Compose)
- **Deleted:** Only manually (never automatically)
- **Backed up:** Recommended (see backup section)

## Troubleshooting

### Issue: 401 Unauthorized After Deployment

**Symptoms:** Cannot log in after deployment, "Invalid credentials" error

**Diagnosis:**
```bash
# Check if volume is mounted
docker ps -a --filter name=ebookvoyage
CONTAINER_ID=$(docker ps -q -f name=ebookvoyage)
docker inspect $CONTAINER_ID | grep -A 20 "Mounts"

# Check if database exists
docker exec $CONTAINER_ID ls -la /app/data/db/sqlite.db

# Check database content
docker exec $CONTAINER_ID sh -c "echo 'SELECT COUNT(*) FROM users;' | sqlite3 /app/data/db/sqlite.db 2>/dev/null || echo 'Database error'"
```

**Solutions:**

1. **Volume not mounted:**
   - Verify Dokploy volume configuration
   - Redeploy with correct mount settings

2. **Database file missing:**
   - Volume is empty - restore from backup (see below)
   - Or start fresh with new user registration

3. **Wrong volume mounted:**
   - Check `docker-compose.yml` has `external: true`
   - Verify volume name is `phelddagrif_ebook_data`
   - Redeploy

### Issue: Volume Not Found During Deployment

**Error:** `Error: volume phelddagrif_ebook_data declared as external, but could not be found`

**Solution:**
```bash
# Create the volume
docker volume create phelddagrif_ebook_data

# Verify
docker volume inspect phelddagrif_ebook_data

# Redeploy
docker-compose up -d
```

### Issue: Permission Denied Errors

**Error:** `EACCES: permission denied, open '/app/data/db/sqlite.db'`

**Solution:**
```bash
# Fix permissions
docker run --rm -v phelddagrif_ebook_data:/data alpine \
  sh -c "chmod -R 755 /data && chown -R 1000:1000 /data"

# Ensure directories exist
docker run --rm -v phelddagrif_ebook_data:/data alpine \
  sh -c "mkdir -p /data/db /data/books && chmod -R 755 /data"

# Restart application
docker-compose restart app
```

### Issue: Data Exists But Not Accessible

**Diagnosis:**
```bash
# Check volume contents directly
docker run --rm -v phelddagrif_ebook_data:/data alpine ls -la /data/

# Check database file specifically
docker run --rm -v phelddagrif_ebook_data:/data alpine ls -lh /data/db/sqlite.db

# Try to query database
docker run --rm -v phelddagrif_ebook_data:/data alpine sh -c \
  "if command -v sqlite3 >/dev/null; then sqlite3 /data/db/sqlite.db '.tables'; fi"
```

**Solution:** If files exist but aren't accessible, check:
- Container logs: `docker-compose logs -f app`
- File permissions (see permission fix above)
- Database integrity: restore from backup if corrupted

## Backup and Restore

### Create Manual Backup

Always create a backup before major changes:

```bash
# Create timestamped backup
docker run --rm \
  -v phelddagrif_ebook_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/ebook_backup_$(date +%Y%m%d_%H%M%S).tar.gz -C /data .

# List backups
ls -lh ebook_backup_*.tar.gz
```

### Restore from Backup

If data is lost or corrupted:

```bash
# Stop application
docker-compose down

# Restore data (REPLACES ALL DATA!)
# Replace YYYYMMDD_HHMMSS with your backup timestamp
docker run --rm \
  -v phelddagrif_ebook_data:/data \
  -v $(pwd):/backup \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/ebook_backup_YYYYMMDD_HHMMSS.tar.gz -C /data"

# Verify restoration
docker run --rm -v phelddagrif_ebook_data:/data alpine ls -la /data/

# Restart application
docker-compose up -d
```

### Automated Backup (Recommended)

Set up automated daily backups:

```bash
# Create backup script
cat > /usr/local/bin/backup-ebook-data.sh << 'EOF'
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
EOF

# Make executable
chmod +x /usr/local/bin/backup-ebook-data.sh

# Test it
/usr/local/bin/backup-ebook-data.sh

# Schedule daily backups at 3 AM
echo "0 3 * * * /usr/local/bin/backup-ebook-data.sh >> /var/log/ebook-backup.log 2>&1" | crontab -

# Verify cron job
crontab -l
```

## Monitoring

### Check Volume Status

```bash
# Volume size
docker system df -v | grep phelddagrif_ebook_data

# Database size
docker run --rm -v phelddagrif_ebook_data:/data alpine du -sh /data/db/

# Books storage size
docker run --rm -v phelddagrif_ebook_data:/data alpine du -sh /data/books/

# Total volume usage
docker run --rm -v phelddagrif_ebook_data:/data alpine du -sh /data/
```

### Health Checks

```bash
# Application health
curl -f http://localhost:7000/api/health || echo "Health check failed"

# Database accessibility
docker exec $(docker ps -q -f name=ebookvoyage) \
  sh -c "echo '.tables' | sqlite3 /app/data/db/sqlite.db" || echo "Database error"

# Check logs for errors
docker-compose logs -f --tail=100 app
```

## Maintenance Schedule

### Weekly
- Run `find-existing-data.sh` to verify data integrity
- Check volume size
- Review application logs for errors

### Monthly
- Create manual backup
- Test backup restoration in development environment
- Verify automated backups are running

### After Each Deployment
- Run `verify-persistence.sh`
- Test user login
- Verify books are accessible
- Check logs for errors

## Success Checklist

After completing this guide, verify:

- ✅ Volume `phelddagrif_ebook_data` exists
- ✅ Volume has `external: true` in docker-compose.yml
- ✅ Dokploy UI shows volume mount configured correctly
- ✅ `find-existing-data.sh` reports data in correct volume
- ✅ `verify-persistence.sh` passes all checks
- ✅ Can register/login with test user
- ✅ Test user persists after `docker-compose down/up`
- ✅ Uploaded books survive redeployment
- ✅ No 401 errors after restart
- ✅ Automated backups are configured (recommended)

## Additional Resources

- **Main Documentation:** `README.md`
- **Docker Deployment Guide:** `docs/DOCKER_DEPLOYMENT.md`
- **Technical Details:** `planning_docs/VOLUME_PERSISTENCE_FIX_EXTERNAL.md`
- **Discovery Script:** `find-existing-data.sh`
- **Verification Script:** `verify-persistence.sh`
- **Volume Ensure Script:** `ensure-volume.sh`

## Getting Help

If you encounter issues not covered here:

1. **Check the logs:**
   ```bash
   docker-compose logs -f app
   ```

2. **Run diagnostics:**
   ```bash
   ./find-existing-data.sh
   ./verify-persistence.sh
   ```

3. **Verify configuration:**
   ```bash
   # Check docker-compose.yml
   grep -A 5 "^volumes:" docker-compose.yml
   
   # Check volume mount
   docker inspect $(docker ps -q -f name=ebookvoyage) | grep -A 20 Mounts
   ```

4. **Review documentation:**
   - `docs/DOCKER_DEPLOYMENT.md` - Full deployment guide
   - `planning_docs/VOLUME_PERSISTENCE_FIX_EXTERNAL.md` - Technical details

---

**Last Updated:** October 21, 2025  
**Version:** 1.0  
**Status:** Production Ready  
**Environment:** Dokploy with Traefik


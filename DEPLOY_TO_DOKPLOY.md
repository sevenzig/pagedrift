# Deploy to Dokploy - Quick Start Guide

This guide will help you deploy the fixed version to Dokploy and resolve the 401 login error caused by volume persistence issues.

## What Was Fixed

The 401 Unauthorized error was caused by the database being wiped on every deployment. We've fixed this by changing the Docker volume from managed (`external: false`) to truly external (`external: true`), preventing Dokploy from recreating the volume.

## Prerequisites

- SSH access to your Dokploy server
- The latest code from this repository

## Step-by-Step Deployment

### 1. SSH into Your Dokploy Server

```bash
ssh user@your-dokploy-server.com
cd /path/to/your/ebook-reader/project
```

### 2. Pull the Latest Code

```bash
git pull origin master
```

### 3. Create the External Volume (One-Time Setup)

This is the **most critical step**. The volume must exist before deployment:

```bash
docker volume create phelddagrif_ebook_data
```

Verify it was created:

```bash
docker volume ls | grep phelddagrif_ebook_data
# Should show: local     phelddagrif_ebook_data

docker volume inspect phelddagrif_ebook_data
# Should show JSON with volume details
```

### 4. Run Pre-Deployment Check

```bash
chmod +x ensure-volume.sh
./ensure-volume.sh
```

This script will:
- ✓ Confirm the volume exists
- ✓ Show volume contents and statistics
- ✓ Verify volume is ready for deployment

**Expected output:** `✓ Volume verification complete - safe to deploy!`

### 5. Deploy the Application

**Option A: Via Dokploy UI**
1. Navigate to your project in Dokploy
2. Click the "Deploy" button
3. Wait for build and deployment to complete

**Option B: Via CLI**
```bash
docker-compose up -d --build
```

### 6. Verify Deployment

Run the post-deployment verification script:

```bash
chmod +x verify-persistence.sh
./verify-persistence.sh
```

This script will:
- ✓ Confirm volume is mounted correctly
- ✓ Verify database accessibility
- ✓ Check file permissions
- ✓ Test application health

**Expected output:** `✓ All critical checks passed - persistence is configured correctly!`

### 7. Test Data Persistence

**Create a test user:**
1. Go to `https://books.phelddagrif.farm/register`
2. Create a new account
3. Note the email and password

**Upload a test book:**
1. Log in with your new account
2. Upload a book file
3. Note the book title

**Test redeployment:**
```bash
docker-compose down
docker-compose up -d
```

**Verify persistence:**
1. Go to `https://books.phelddagrif.farm/login`
2. Log in with the same credentials
3. Verify the book is still visible

**If this works:** ✅ Persistence is fixed! You can now create your real user accounts.

**If you get 401 error:** ❌ See troubleshooting below.

## Troubleshooting

### Issue: 401 Unauthorized After Deployment

**Diagnosis:**
```bash
# Check if volume exists
docker volume ls | grep phelddagrif_ebook_data

# Check if volume contains database
docker run --rm -v phelddagrif_ebook_data:/data alpine ls -la /data/db/

# Check container volume mount
docker inspect $(docker ps -q -f name=ebookvoyage) | grep -A 20 Mounts
```

**Common causes and fixes:**

1. **Volume doesn't exist:**
   ```bash
   docker volume create phelddagrif_ebook_data
   docker-compose up -d
   ```

2. **Volume is empty (data was lost):**
   - If you have a backup, restore it (see below)
   - Otherwise, you'll need to recreate users and re-upload books

3. **Wrong volume mounted:**
   - Check `docker-compose.yml` has `external: true`
   - Run `git pull` to get latest config
   - Redeploy

### Issue: Volume Not Found During Deployment

**Error:** `volume phelddagrif_ebook_data declared as external, but could not be found`

**Solution:**
```bash
# Create the volume
docker volume create phelddagrif_ebook_data

# Verify
docker volume inspect phelddagrif_ebook_data

# Redeploy
docker-compose up -d
```

### Issue: Old Data Exists But Not Being Used

**Find old volumes:**
```bash
docker volume ls | grep ebook
```

**Check volume contents:**
```bash
docker run --rm -v <volume_name>:/data alpine ls -la /data/
```

**Migrate data to new volume:**
```bash
# Ensure new volume exists
docker volume create phelddagrif_ebook_data

# Copy data
docker run --rm \
  -v <old_volume_name>:/source \
  -v phelddagrif_ebook_data:/target \
  alpine cp -r /source/. /target/

# Verify
docker run --rm -v phelddagrif_ebook_data:/data alpine ls -la /data/

# Redeploy
docker-compose up -d
```

## Backup and Restore

### Create Backup

```bash
# Create timestamped backup
docker run --rm \
  -v phelddagrif_ebook_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/ebook_backup_$(date +%Y%m%d_%H%M%S).tar.gz -C /data .
```

### Restore from Backup

```bash
# Stop application
docker-compose down

# Restore (replace TIMESTAMP with your backup's timestamp)
docker run --rm \
  -v phelddagrif_ebook_data:/data \
  -v $(pwd):/backup \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/ebook_backup_TIMESTAMP.tar.gz -C /data"

# Restart
docker-compose up -d
```

## What Changed

1. **`docker-compose.yml`:**
   - Changed `external: false` → `external: true`
   - Volume is now truly external and never recreated

2. **New verification scripts:**
   - `ensure-volume.sh` - Run before deployment
   - `verify-persistence.sh` - Run after deployment

3. **Updated documentation:**
   - `docs/DOCKER_DEPLOYMENT.md` - Full Dokploy deployment guide
   - `planning_docs/VOLUME_PERSISTENCE_FIX_EXTERNAL.md` - Technical details

## Success Checklist

After deployment, verify:

- ✅ Volume `phelddagrif_ebook_data` exists
- ✅ `ensure-volume.sh` reports success
- ✅ `verify-persistence.sh` reports success
- ✅ Can register a new user
- ✅ Can upload a book
- ✅ After `docker-compose restart`, user can still log in
- ✅ After `docker-compose restart`, book is still accessible
- ✅ No 401 errors when logging in

## Next Steps After Successful Deployment

1. **Create your actual user accounts**
2. **Upload your books**
3. **Set up automated backups** (see `docs/DOCKER_DEPLOYMENT.md`)
4. **Monitor disk usage** periodically

## Need Help?

If you encounter issues:

1. Check the logs: `docker-compose logs -f`
2. Run diagnostics: `./verify-persistence.sh`
3. Review full docs: `docs/DOCKER_DEPLOYMENT.md`
4. Check technical details: `planning_docs/VOLUME_PERSISTENCE_FIX_EXTERNAL.md`

---

**Remember:** The key change is `external: true` in docker-compose.yml. This tells Docker to NEVER delete or recreate the volume, ensuring your data persists forever.


# Meilisearch Production Setup Guide

This guide covers how to configure, troubleshoot, and maintain Meilisearch for the EBookVoyage application in production environments.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [Initial Setup](#initial-setup)
- [Reindexing](#reindexing)
- [Health Monitoring](#health-monitoring)
- [Troubleshooting](#troubleshooting)
- [Advanced Topics](#advanced-topics)

## Overview

EBookVoyage uses Meilisearch as its search engine to provide:

- **Metadata Search**: Search books by title, author, ISBN, publisher, tags, etc.
- **Full-Text Search**: Search within book chapters and content
- **Advanced Filtering**: Filter by format, content type, publication year, language, etc.
- **Typo Tolerance**: Intelligent search that handles typos
- **Fast Results**: Sub-50ms search performance

## Architecture

### Components

1. **EBookVoyage Application** (Port 7000)
   - SvelteKit application with Node.js backend
   - Connects to both SQLite database and Meilisearch

2. **Meilisearch Service** (Port 7700)
   - Runs as a separate Docker container on the same network
   - Accessed via service name: `http://meilisearch:7700`

3. **SQLite Database**
   - Primary data store for books, chapters, users
   - Source of truth for all book data

### Data Flow

```
User Upload → Parse Book → Save to SQLite → Index in Meilisearch
                                           ↓
User Search → Query Meilisearch → Return Book IDs → Fetch from SQLite
```

## Configuration

### Environment Variables

The application requires these environment variables to connect to Meilisearch:

```bash
# Meilisearch connection
MEILISEARCH_HOST=http://meilisearch:7700
MEILISEARCH_KEY=your-master-key-here
```

### Docker Compose Configuration

Your `docker-compose.yml` should include:

```yaml
services:
  app:
    environment:
      - MEILISEARCH_HOST=${MEILISEARCH_HOST:-http://meilisearch:7700}
      - MEILISEARCH_KEY=${MEILISEARCH_MASTER_KEY}
    networks:
      - dokploy-network

  # If running Meilisearch in the same compose file:
  meilisearch:
    image: getmeili/meilisearch:v1.12
    environment:
      - MEILI_MASTER_KEY=${MEILISEARCH_MASTER_KEY}
      - MEILI_ENV=production
    volumes:
      - meilisearch_data:/meili_data
    networks:
      - dokploy-network
```

### Network Configuration

Both containers must be on the same Docker network for service discovery to work. The application uses the service name `meilisearch` to connect.

## Initial Setup

### 1. Deploy Meilisearch

If using a separate Meilisearch container:

```bash
docker run -d \
  --name meilisearch \
  --network dokploy-network \
  -p 7700:7700 \
  -e MEILI_MASTER_KEY=your-secure-master-key \
  -e MEILI_ENV=production \
  -v meilisearch_data:/meili_data \
  getmeili/meilisearch:v1.12
```

### 2. Verify Meilisearch is Running

```bash
# Check if container is running
docker ps | grep meilisearch

# Test health endpoint
curl http://localhost:7700/health

# Expected response:
# {"status":"available"}
```

### 3. Set Environment Variables

Ensure your application container has the correct environment variables:

```bash
# In your .env or docker-compose.yml
MEILISEARCH_HOST=http://meilisearch:7700
MEILISEARCH_KEY=your-secure-master-key
```

### 4. Deploy Application

Deploy your EBookVoyage application. On startup, it will:
- Connect to Meilisearch
- Initialize indexes (`books` and `chapters`)
- Configure index settings (searchable attributes, filters, etc.)

### 5. Initial Reindexing

After deployment, reindex all existing books:

```bash
# Enter application container
docker exec -it <container-name> sh

# Run reindexing script
npm run reindex:production
```

## Reindexing

### When to Reindex

Reindex your books when:

- **Initial Setup**: First time setting up Meilisearch
- **After Bug Fixes**: Fixed indexing bugs (like the missing `db` import)
- **Index Corruption**: Data inconsistencies or corruption
- **Schema Changes**: Modified index settings or searchable attributes
- **Data Migration**: Moved to a new Meilisearch instance

### Using the Reindexing Script

The production reindexing script (`scripts/reindex-production.ts`) provides:

- ✅ Connection verification (database and Meilisearch)
- ✅ Automatic index initialization
- ✅ Progress tracking with detailed logs
- ✅ Error handling and reporting
- ✅ Final statistics and summary

#### Run from Inside Container

```bash
# 1. Enter the container
docker exec -it <container-name> sh

# 2. Run the script
npm run reindex:production

# Expected output:
# ============================================================
# 🚀 PRODUCTION REINDEXING SCRIPT
# ============================================================
# 
# 🗄️  Verifying database connection...
# ✅ Database connection successful
# 
# 🔌 Verifying Meilisearch connection...
# ✅ Meilisearch is healthy
# 
# 📋 Initializing Meilisearch indexes...
# ✅ Created books index
# ✅ Created chapters index
# ✅ Indexes configured successfully
# 
# 🔍 Fetching all books from database...
# 📚 Found 42 books to index
# 
# [1/42] Indexing: "Bock" by Darryl Richman
#   ✅ Indexed 15 chapters
# ...
```

#### Run from Host System

```bash
# Execute inside container from host
docker exec <container-name> npm run reindex:production
```

### Monitoring Reindexing Progress

The script provides real-time progress updates:

- Shows current book being indexed
- Displays book count progress (e.g., `[5/42]`)
- Reports chapters indexed per book
- Highlights any errors immediately
- Provides final statistics summary

### Handling Reindexing Errors

If reindexing fails for specific books:

1. **Review Error Messages**: The script logs detailed errors
2. **Check Book Data**: Verify the book exists in the database
3. **Validate Chapters**: Ensure chapters are properly associated
4. **Check Meilisearch**: Verify Meilisearch has enough resources
5. **Retry**: Run the script again (it's idempotent)

## Health Monitoring

### Application Health Endpoint

The application provides a comprehensive health check:

```bash
curl http://localhost:7000/api/health
```

**Healthy Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-21T12:34:56.789Z",
  "checks": {
    "server": "ok",
    "database": "ok",
    "meilisearch": "ok"
  }
}
```

**Unhealthy Response (503 status):**
```json
{
  "status": "unhealthy",
  "timestamp": "2025-10-21T12:34:56.789Z",
  "checks": {
    "server": "ok",
    "database": "ok",
    "meilisearch": "error"
  }
}
```

### Meilisearch Direct Health Check

```bash
# Check Meilisearch directly
curl http://meilisearch:7700/health

# Get detailed stats
curl -H "Authorization: Bearer your-master-key" \
  http://meilisearch:7700/stats
```

### Docker Healthchecks

The application's `docker-compose.yml` includes a healthcheck:

```yaml
healthcheck:
  test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:7000/api/health"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 40s
```

Check status:
```bash
docker ps  # Shows (healthy) or (unhealthy) status
docker inspect <container-name> | jq '.[0].State.Health'
```

### Monitoring Index Stats

```bash
# Get book index statistics
curl -H "Authorization: Bearer your-master-key" \
  http://meilisearch:7700/indexes/books/stats

# Get chapter index statistics
curl -H "Authorization: Bearer your-master-key" \
  http://meilisearch:7700/indexes/chapters/stats
```

## Troubleshooting

### Issue: "db is not defined" Error

**Symptoms:**
- Upload succeeds but book doesn't appear in search
- Error in logs: `ReferenceError: db is not defined`

**Cause:**
Missing import in the upload endpoint.

**Solution:**
This has been fixed in the latest version. Ensure `src/routes/api/books/upload/+server.ts` includes:
```typescript
import { db } from '$lib/server/db';
```

After fixing, reindex existing books:
```bash
npm run reindex:production
```

---

### Issue: Cannot Connect to Meilisearch

**Symptoms:**
- Health check shows `meilisearch: "error"`
- Uploads succeed but search doesn't work
- Logs show connection refused

**Diagnosis:**
```bash
# Check if Meilisearch container is running
docker ps | grep meilisearch

# Check if app can reach Meilisearch
docker exec <app-container> wget -O- http://meilisearch:7700/health

# Check environment variables
docker exec <app-container> env | grep MEILISEARCH
```

**Solutions:**

1. **Verify Meilisearch is Running:**
   ```bash
   docker start meilisearch
   ```

2. **Check Network Configuration:**
   - Ensure both containers are on the same Docker network
   - Verify service name matches `MEILISEARCH_HOST`

3. **Verify Environment Variables:**
   ```bash
   # Should show:
   MEILISEARCH_HOST=http://meilisearch:7700
   MEILISEARCH_KEY=your-master-key
   ```

4. **Restart Application:**
   ```bash
   docker restart <app-container>
   ```

---

### Issue: Search Returns No Results

**Symptoms:**
- Books exist in database
- Health check passes
- Search returns empty results

**Diagnosis:**
```bash
# Check index stats
curl -H "Authorization: Bearer your-master-key" \
  http://meilisearch:7700/indexes/books/stats

# Expected: numberOfDocuments > 0
```

**Solutions:**

1. **Reindex All Books:**
   ```bash
   docker exec <app-container> npm run reindex:production
   ```

2. **Verify Index Settings:**
   ```bash
   curl -H "Authorization: Bearer your-master-key" \
     http://meilisearch:7700/indexes/books/settings
   ```

3. **Check for Indexing Tasks:**
   ```bash
   # View recent indexing tasks
   curl -H "Authorization: Bearer your-master-key" \
     http://meilisearch:7700/tasks?limit=10
   ```

---

### Issue: Slow Search Performance

**Symptoms:**
- Search takes > 500ms
- Application feels sluggish
- Timeout errors

**Solutions:**

1. **Check Meilisearch Resources:**
   ```bash
   docker stats meilisearch
   ```
   - Ensure adequate CPU and memory allocation
   - Meilisearch recommends at least 1GB RAM

2. **Review Index Size:**
   ```bash
   curl -H "Authorization: Bearer your-master-key" \
     http://meilisearch:7700/stats
   ```
   - Consider index optimization if dataset is large

3. **Check Network Latency:**
   ```bash
   docker exec <app-container> ping meilisearch
   ```

4. **Optimize Search Queries:**
   - Reduce `limit` parameter
   - Use more specific filters
   - Avoid wildcard searches

---

### Issue: Index Out of Sync with Database

**Symptoms:**
- Deleted books still appear in search
- Updated metadata not reflected
- Duplicate entries

**Solution:**

Full reindex to sync everything:
```bash
docker exec <app-container> npm run reindex:production
```

For production with many books, consider:
1. Taking a backup first
2. Running reindex during low-traffic hours
3. Monitoring progress via logs

---

### Issue: Authentication Errors

**Symptoms:**
- `401 Unauthorized` from Meilisearch
- `Invalid API key` errors

**Solutions:**

1. **Verify Master Key:**
   ```bash
   docker exec <app-container> env | grep MEILISEARCH_KEY
   ```

2. **Check Meilisearch Configuration:**
   ```bash
   docker exec meilisearch env | grep MEILI_MASTER_KEY
   ```

3. **Ensure Keys Match:**
   - App's `MEILISEARCH_KEY` should equal Meilisearch's `MEILI_MASTER_KEY`

4. **Restart Both Containers:**
   ```bash
   docker restart meilisearch
   docker restart <app-container>
   ```

## Advanced Topics

### Custom Index Settings

To modify index settings, update `src/lib/server/search/client.ts`:

```typescript
await booksIndex.updateSettings({
  searchableAttributes: ['title', 'author', 'description'],
  filterableAttributes: ['format', 'contentType', 'tags'],
  sortableAttributes: ['uploadDate', 'title'],
  // ... other settings
});
```

After changes:
1. Deploy the updated code
2. Run reindexing to apply new settings

### Backup and Restore

**Create Dump:**
```bash
curl -X POST -H "Authorization: Bearer your-master-key" \
  http://meilisearch:7700/dumps
```

**Monitor Dump Progress:**
```bash
curl -H "Authorization: Bearer your-master-key" \
  http://meilisearch:7700/tasks/<task-uid>
```

**Restore from Dump:**
```bash
docker run -d \
  --name meilisearch \
  -v meilisearch_data:/meili_data \
  -v $(pwd)/dumps:/dumps \
  -e MEILI_MASTER_KEY=your-key \
  -e MEILI_DUMP_DIR=/dumps \
  getmeili/meilisearch:v1.12 \
  meilisearch --import-dump /dumps/your-dump.dump
```

### Scaling Meilisearch

For high-traffic production:

1. **Increase Resources:**
   ```yaml
   meilisearch:
     deploy:
       resources:
         limits:
           cpus: '2'
           memory: 4G
   ```

2. **Use SSD Storage:**
   - Meilisearch heavily uses disk I/O
   - SSD dramatically improves performance

3. **Monitor Memory Usage:**
   - Meilisearch loads indexes into memory
   - Plan for 2-3x the index size in RAM

### Monitoring and Alerting

Consider setting up monitoring for:

- **Health Check Endpoint**: Monitor `/api/health` continuously
- **Index Document Count**: Alert if drops unexpectedly
- **Search Response Times**: Alert if > 500ms
- **Failed Indexing Tasks**: Review task queue regularly

Example monitoring with curl:
```bash
# Create monitoring script
#!/bin/bash
while true; do
  response=$(curl -s http://localhost:7000/api/health)
  status=$(echo $response | jq -r '.status')
  
  if [ "$status" != "healthy" ]; then
    echo "ALERT: Application unhealthy - $response"
    # Send alert notification here
  fi
  
  sleep 60
done
```

## Additional Resources

- [Meilisearch Official Documentation](https://www.meilisearch.com/docs)
- [Meilisearch Cloud](https://www.meilisearch.com/cloud) - Managed hosting option
- [EBookVoyage GitHub Repository](https://github.com/your-repo)
- [Docker Deployment Guide](./DOCKER_DEPLOYMENT.md)

## Support

If you encounter issues not covered here:

1. Check application logs: `docker logs <container-name>`
2. Check Meilisearch logs: `docker logs meilisearch`
3. Review the health endpoint output
4. Consult the troubleshooting section above

For persistent issues, consider:
- Reviewing Meilisearch GitHub issues
- Checking Docker network configuration
- Verifying resource availability (CPU, memory, disk)


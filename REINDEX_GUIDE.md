# Quick Reindexing Guide

This guide provides quick commands for reindexing books in Meilisearch.

## When to Reindex

- ✅ After fixing the `db is not defined` bug (now)
- ✅ After deploying to a new Meilisearch instance
- ✅ When search results are out of sync with database
- ✅ After Meilisearch data corruption or loss

## Prerequisites

Ensure these environment variables are set:
```bash
MEILISEARCH_HOST=http://meilisearch:7700
MEILISEARCH_KEY=your-master-key
DATABASE_URL=file:/app/data/db/sqlite.db
```

## Quick Start

### Option 1: From Inside Container (Recommended)

```bash
# 1. Enter the container
docker exec -it <container-name> sh

# 2. Run the reindexing script
npm run reindex:production

# 3. Wait for completion (shows progress)
# 4. Exit when done
exit
```

### Option 2: From Host

```bash
# Run directly from host
docker exec <container-name> npm run reindex:production
```

### Option 3: Find Container Name First

```bash
# Find your container name
docker ps | grep ebook

# Then run reindex
docker exec <found-container-name> npm run reindex:production
```

## What to Expect

The script will:

1. **Verify Connections** (5 seconds)
   ```
   🗄️  Verifying database connection...
   ✅ Database connection successful
   🔌 Verifying Meilisearch connection...
   ✅ Meilisearch is healthy
   ```

2. **Initialize Indexes** (5-10 seconds)
   ```
   📋 Initializing Meilisearch indexes...
   ✅ Created books index
   ✅ Created chapters index
   ✅ Indexes configured successfully
   ```

3. **Reindex Books** (varies by book count)
   ```
   🔍 Fetching all books from database...
   📚 Found 42 books to index

   [1/42] Indexing: "Book Title" by Author
     ✅ Indexed 15 chapters
   [2/42] Indexing: "Another Book" by Another Author
     ✅ Indexed 12 chapters
   ...
   ```

4. **Show Summary**
   ```
   ============================================================
   📊 REINDEXING SUMMARY
   ============================================================
   Total Books:        42
   Successful:         42 ✅
   Failed:             0 ❌
   Total Chapters:     567
   ============================================================
   ```

## Timing Estimates

- **Small Library** (1-10 books): ~10-30 seconds
- **Medium Library** (10-50 books): ~30-120 seconds
- **Large Library** (50-200 books): ~2-5 minutes
- **Very Large Library** (200+ books): ~5-15 minutes

## Verify Success

After reindexing, verify it worked:

```bash
# 1. Check health endpoint
curl http://localhost:7000/api/health
# Should show: "meilisearch": "ok"

# 2. Check index stats
curl -H "Authorization: Bearer your-master-key" \
  http://meilisearch:7700/indexes/books/stats
# Should show numberOfDocuments > 0

# 3. Test search in the web UI
# Navigate to your app and try searching for a book
```

## Troubleshooting

### Error: Cannot connect to database

```bash
# Check database file exists
docker exec <container> ls -la /app/data/db/

# Verify DATABASE_URL
docker exec <container> env | grep DATABASE_URL
```

### Error: Cannot connect to Meilisearch

```bash
# Check if Meilisearch is running
docker ps | grep meilisearch

# Test connection from app container
docker exec <container> wget -O- http://meilisearch:7700/health

# Verify environment variables
docker exec <container> env | grep MEILISEARCH
```

### Error: Authentication failed

```bash
# Verify master key matches
docker exec <container> env | grep MEILISEARCH_KEY
docker exec meilisearch env | grep MEILI_MASTER_KEY
# These should match
```

### Script hangs or times out

```bash
# Check Meilisearch logs
docker logs meilisearch

# Check application logs
docker logs <container-name>

# Check resource usage
docker stats
```

## Common Commands

```bash
# View container logs
docker logs <container-name>

# View real-time logs
docker logs -f <container-name>

# Check container status
docker ps

# Restart container if needed
docker restart <container-name>

# Check Meilisearch health
docker exec <container> wget -O- http://meilisearch:7700/health
```

## For More Help

See the comprehensive guide:
- [docs/MEILISEARCH_PRODUCTION.md](docs/MEILISEARCH_PRODUCTION.md)

Or check the implementation summary:
- [planning_docs/MEILISEARCH_PRODUCTION_FIX.md](../planning_docs/MEILISEARCH_PRODUCTION_FIX.md)


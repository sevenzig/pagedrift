#!/bin/bash
# =============================================================================
# Docker Volume Migration Script
# =============================================================================
# This script migrates data from anonymous volumes to a named persistent volume
# Run this ONCE before deploying the updated docker-compose.yml
#
# Usage: ./migrate-data-to-named-volume.sh
# =============================================================================

set -e

echo "==================================================================="
echo "Docker Volume Migration Script"
echo "==================================================================="
echo ""

VOLUME_NAME="phelddagrif_ebook_data"
CONTAINER_NAME="ebookvoyage-app-1"

# Check if the named volume already exists
if docker volume inspect "$VOLUME_NAME" >/dev/null 2>&1; then
    echo "✓ Named volume '$VOLUME_NAME' already exists"
    read -p "Do you want to recreate it? This will DELETE existing data! (yes/no): " response
    if [ "$response" = "yes" ]; then
        echo "⚠️  Removing existing volume..."
        docker volume rm "$VOLUME_NAME" || {
            echo "❌ Error: Cannot remove volume. Make sure containers are stopped."
            exit 1
        }
    else
        echo "ℹ️  Using existing volume. Migration skipped."
        exit 0
    fi
fi

# Create the named volume
echo ""
echo "Creating named volume '$VOLUME_NAME'..."
docker volume create "$VOLUME_NAME"
echo "✓ Volume created successfully"

# Check if there's data in the current container
echo ""
echo "Checking for existing data..."

# Try to find running container
CONTAINER_ID=$(docker ps -q -f name="$CONTAINER_NAME" 2>/dev/null || echo "")

if [ -z "$CONTAINER_ID" ]; then
    # Try alternative naming patterns
    CONTAINER_ID=$(docker ps -q -f name="ebookvoyage" | head -n 1)
fi

if [ -n "$CONTAINER_ID" ]; then
    echo "✓ Found running container: $CONTAINER_ID"
    
    # Check if container has data
    DB_EXISTS=$(docker exec "$CONTAINER_ID" test -f /app/data/db/sqlite.db && echo "yes" || echo "no")
    
    if [ "$DB_EXISTS" = "yes" ]; then
        echo "✓ Found existing database in container"
        
        # Backup existing data
        echo ""
        echo "Creating backup of existing data..."
        BACKUP_FILE="ebook_data_backup_$(date +%Y%m%d_%H%M%S).tar.gz"
        docker exec "$CONTAINER_ID" tar czf "/tmp/$BACKUP_FILE" -C /app/data . 2>/dev/null || {
            echo "⚠️  Warning: Could not create backup from running container"
        }
        
        if docker exec "$CONTAINER_ID" test -f "/tmp/$BACKUP_FILE" 2>/dev/null; then
            docker cp "$CONTAINER_ID:/tmp/$BACKUP_FILE" "./$BACKUP_FILE"
            echo "✓ Backup saved to ./$BACKUP_FILE"
            
            # Migrate data to named volume
            echo ""
            echo "Migrating data to named volume..."
            docker run --rm \
                -v "$VOLUME_NAME:/target" \
                -v "$(pwd)/$BACKUP_FILE:/backup.tar.gz" \
                alpine tar xzf /backup.tar.gz -C /target
            echo "✓ Data migrated successfully"
        fi
    else
        echo "ℹ️  No existing data found in container"
    fi
else
    echo "ℹ️  No running container found. Starting fresh."
fi

# Verify volume contents
echo ""
echo "Verifying volume contents..."
docker run --rm -v "$VOLUME_NAME:/data" alpine ls -la /data || {
    echo "⚠️  Volume is empty - this is expected for new installations"
}

echo ""
echo "==================================================================="
echo "✓ Migration Complete!"
echo "==================================================================="
echo ""
echo "Next steps:"
echo "1. Stop your current containers: docker-compose down"
echo "2. Deploy with new configuration: docker-compose up -d --build"
echo "3. Verify data persistence by creating a test user"
echo ""
echo "Volume name: $VOLUME_NAME"
echo "==================================================================="


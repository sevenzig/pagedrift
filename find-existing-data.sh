#!/bin/bash

# find-existing-data.sh
# Script to locate existing ebook reader data in Docker volumes
# Helps identify which volume contains user data before migration

set -e

echo "========================================="
echo "EBook Reader - Data Discovery Script"
echo "========================================="
echo ""
echo "Searching for existing ebook reader data in Docker volumes..."
echo ""

# Function to print colored output
print_success() {
    echo -e "\033[0;32m✓ $1\033[0m"
}

print_error() {
    echo -e "\033[0;31m✗ $1\033[0m"
}

print_warning() {
    echo -e "\033[0;33m⚠ $1\033[0m"
}

print_info() {
    echo -e "\033[0;34mℹ $1\033[0m"
}

print_header() {
    echo -e "\033[1;36m=== $1 ===\033[0m"
}

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed or not in PATH"
    exit 1
fi

# Get all volumes that might be related to ebook reader
echo "Scanning for ebook-related volumes..."
VOLUMES=$(docker volume ls --format "{{.Name}}" | grep -iE "ebook|pagedrift|phelddagrif" || echo "")

if [ -z "$VOLUMES" ]; then
    print_warning "No ebook-related volumes found"
    echo ""
    print_info "This might mean:"
    echo "  1. This is a fresh installation (no data exists yet)"
    echo "  2. Data exists in a volume with an unexpected name"
    echo ""
    echo "All Docker volumes on this system:"
    docker volume ls
    echo ""
    print_info "Next steps:"
    echo "  1. Review the volume list above"
    echo "  2. If you see a volume that might contain your data, run:"
    echo "     docker run --rm -v <volume_name>:/data alpine ls -la /data/"
    echo "  3. If no data exists, you can proceed with fresh setup"
    exit 0
fi

echo ""
print_success "Found $(echo "$VOLUMES" | wc -l) potential volume(s)"
echo ""

# Check each volume for data
FOUND_DATA=false
TARGET_VOLUME="phelddagrif_ebook_data"
VOLUMES_WITH_DATA=()

while IFS= read -r volume; do
    print_header "Checking: $volume"
    
    # Check if volume has db directory
    if docker run --rm -v "$volume:/data" alpine test -d "/data/db" 2>/dev/null; then
        print_success "Found /data/db directory"
        
        # Check for database file
        if docker run --rm -v "$volume:/data" alpine test -f "/data/db/sqlite.db" 2>/dev/null; then
            DB_SIZE=$(docker run --rm -v "$volume:/data" alpine du -h /data/db/sqlite.db 2>/dev/null | cut -f1)
            print_success "Found database file (size: $DB_SIZE)"
            FOUND_DATA=true
            VOLUMES_WITH_DATA+=("$volume")
            
            # Try to get user count if possible
            USER_COUNT=$(docker run --rm -v "$volume:/data" alpine sh -c "
                if command -v sqlite3 >/dev/null 2>&1; then
                    sqlite3 /data/db/sqlite.db 'SELECT COUNT(*) FROM users;' 2>/dev/null || echo '?'
                else
                    echo '?'
                fi
            ")
            if [ "$USER_COUNT" != "?" ]; then
                print_info "  Database contains $USER_COUNT user(s)"
            fi
        else
            print_warning "No database file found"
        fi
    else
        print_info "No /data/db directory"
    fi
    
    # Check if volume has books directory
    if docker run --rm -v "$volume:/data" alpine test -d "/data/books" 2>/dev/null; then
        BOOK_COUNT=$(docker run --rm -v "$volume:/data" alpine sh -c "find /data/books -type f 2>/dev/null | wc -l" || echo "0")
        if [ "$BOOK_COUNT" -gt 0 ]; then
            BOOKS_SIZE=$(docker run --rm -v "$volume:/data" alpine du -sh /data/books 2>/dev/null | cut -f1)
            print_success "Found $BOOK_COUNT book file(s) (total: $BOOKS_SIZE)"
            FOUND_DATA=true
            if [[ ! " ${VOLUMES_WITH_DATA[@]} " =~ " ${volume} " ]]; then
                VOLUMES_WITH_DATA+=("$volume")
            fi
        else
            print_info "Books directory exists but is empty"
        fi
    else
        print_info "No /data/books directory"
    fi
    
    # Check volume size
    VOLUME_SIZE=$(docker system df -v 2>/dev/null | grep "$volume" | awk '{print $3}' || echo "unknown")
    if [ "$VOLUME_SIZE" != "unknown" ]; then
        print_info "Total volume size: $VOLUME_SIZE"
    fi
    
    echo ""
done <<< "$VOLUMES"

# Summary and recommendations
print_header "Summary"
echo ""

if [ ${#VOLUMES_WITH_DATA[@]} -eq 0 ]; then
    print_warning "No existing data found in any volume"
    echo ""
    print_info "Recommendation: Proceed with fresh installation"
    echo ""
    echo "Next steps:"
    echo "  1. Create the external volume:"
    echo "     docker volume create $TARGET_VOLUME"
    echo ""
    echo "  2. Deploy your application via Dokploy"
    echo ""
    
elif [ ${#VOLUMES_WITH_DATA[@]} -eq 1 ]; then
    DATA_VOLUME="${VOLUMES_WITH_DATA[0]}"
    print_success "Found data in volume: $DATA_VOLUME"
    echo ""
    
    if [ "$DATA_VOLUME" = "$TARGET_VOLUME" ]; then
        print_success "Volume name is correct! ($TARGET_VOLUME)"
        print_info "Recommendation: You can deploy directly - data will persist"
        echo ""
        echo "Next steps:"
        echo "  1. Ensure docker-compose.yml has 'external: true' configured"
        echo "  2. Deploy via Dokploy"
        echo "  3. Verify data persists after deployment"
        echo ""
    else
        print_warning "Data is in volume: $DATA_VOLUME"
        print_warning "Target volume should be: $TARGET_VOLUME"
        print_info "Recommendation: Migrate data to target volume"
        echo ""
        echo "Migration commands:"
        echo ""
        echo "  # 1. Create target volume"
        echo "  docker volume create $TARGET_VOLUME"
        echo ""
        echo "  # 2. Copy data from old to new volume"
        echo "  docker run --rm \\"
        echo "    -v $DATA_VOLUME:/source \\"
        echo "    -v $TARGET_VOLUME:/target \\"
        echo "    alpine cp -r /source/. /target/"
        echo ""
        echo "  # 3. Verify migration"
        echo "  docker run --rm -v $TARGET_VOLUME:/data alpine ls -la /data/"
        echo ""
        echo "  # 4. Check database"
        echo "  docker run --rm -v $TARGET_VOLUME:/data alpine ls -la /data/db/"
        echo ""
        echo "  # 5. Check books"
        echo "  docker run --rm -v $TARGET_VOLUME:/data alpine ls -la /data/books/"
        echo ""
        echo "After successful migration, deploy via Dokploy."
        echo ""
    fi
    
else
    print_warning "Found data in multiple volumes!"
    echo ""
    echo "Volumes with data:"
    for vol in "${VOLUMES_WITH_DATA[@]}"; do
        echo "  - $vol"
    done
    echo ""
    print_info "Recommendation: Identify the correct volume manually"
    echo ""
    echo "To inspect each volume:"
    for vol in "${VOLUMES_WITH_DATA[@]}"; do
        echo ""
        echo "  # Check $vol"
        echo "  docker run --rm -v $vol:/data alpine ls -la /data/"
        echo "  docker run --rm -v $vol:/data alpine du -sh /data/db/sqlite.db"
        echo "  docker run --rm -v $vol:/data alpine find /data/books -type f"
    done
    echo ""
    echo "Once you identify the correct volume, use the migration commands above."
    echo ""
fi

# Check if target volume exists
print_header "Target Volume Status"
echo ""
if docker volume inspect "$TARGET_VOLUME" &>/dev/null; then
    print_success "Target volume '$TARGET_VOLUME' exists"
    
    # Check if it has data
    if docker run --rm -v "$TARGET_VOLUME:/data" alpine test -f "/data/db/sqlite.db" 2>/dev/null; then
        print_success "Target volume contains database - ready for deployment"
    else
        print_warning "Target volume exists but appears empty"
        print_info "You may need to migrate data or this is a fresh install"
    fi
else
    print_warning "Target volume '$TARGET_VOLUME' does not exist yet"
    print_info "You will need to create it before deployment"
    echo ""
    echo "  docker volume create $TARGET_VOLUME"
fi

echo ""
print_header "Configuration Reference"
echo ""
echo "Dokploy UI Volume Settings:"
echo "  Mount Type: Volume Mount"
echo "  Host Path: $TARGET_VOLUME"
echo "  Mount Path: /app/data"
echo ""
echo "docker-compose.yml should have:"
echo "  volumes:"
echo "    ebook_data:"
echo "      external: true"
echo "      name: $TARGET_VOLUME"
echo ""

echo "========================================="
echo "Scan Complete"
echo "========================================="
echo ""

exit 0


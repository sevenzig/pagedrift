#!/bin/bash

# ensure-volume.sh
# Pre-deployment script to ensure Docker volume exists and is ready for use
# This prevents data loss by verifying the volume before Dokploy deployment

set -e

VOLUME_NAME="phelddagrif_ebook_data"
REQUIRED_PATHS=("db" "books")

echo "========================================="
echo "EBook Reader - Volume Verification Script"
echo "========================================="
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

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed or not in PATH"
    exit 1
fi
print_success "Docker is available"

# Check if volume exists
if docker volume inspect "$VOLUME_NAME" &> /dev/null; then
    print_success "Volume '$VOLUME_NAME' exists"
    
    # Get volume details
    MOUNTPOINT=$(docker volume inspect "$VOLUME_NAME" --format '{{ .Mountpoint }}' 2>/dev/null || echo "Unknown")
    print_info "Volume mountpoint: $MOUNTPOINT"
    
    # Check volume contents
    echo ""
    echo "Checking volume contents..."
    
    # Check if volume has required directories
    for path in "${REQUIRED_PATHS[@]}"; do
        if docker run --rm -v "$VOLUME_NAME:/data" alpine test -d "/data/$path" 2>/dev/null; then
            print_success "Directory '/data/$path' exists"
            
            # Check if directory has content
            FILE_COUNT=$(docker run --rm -v "$VOLUME_NAME:/data" alpine sh -c "ls -1 /data/$path 2>/dev/null | wc -l" || echo "0")
            if [ "$FILE_COUNT" -gt 0 ]; then
                print_info "  Contains $FILE_COUNT items"
            else
                print_warning "  Directory is empty"
            fi
        else
            print_warning "Directory '/data/$path' does not exist (will be created on first run)"
        fi
    done
    
    # Check for database file specifically
    echo ""
    if docker run --rm -v "$VOLUME_NAME:/data" alpine test -f "/data/db/sqlite.db" 2>/dev/null; then
        DB_SIZE=$(docker run --rm -v "$VOLUME_NAME:/data" alpine sh -c "du -h /data/db/sqlite.db | cut -f1")
        print_success "Database file exists (size: $DB_SIZE)"
        
        # Count tables in database (requires sqlite3, optional)
        if docker run --rm -v "$VOLUME_NAME:/data" alpine sh -c "command -v sqlite3" &>/dev/null; then
            TABLE_COUNT=$(docker run --rm -v "$VOLUME_NAME:/data" alpine sqlite3 /data/db/sqlite.db ".tables" 2>/dev/null | wc -w || echo "0")
            if [ "$TABLE_COUNT" -gt 0 ]; then
                print_info "  Database contains $TABLE_COUNT tables"
            fi
        fi
    else
        print_warning "Database file does not exist yet (will be created on first deployment)"
    fi
    
    # Check for books
    echo ""
    BOOK_COUNT=$(docker run --rm -v "$VOLUME_NAME:/data" alpine sh -c "find /data/books -type f 2>/dev/null | wc -l" || echo "0")
    if [ "$BOOK_COUNT" -gt 0 ]; then
        print_success "$BOOK_COUNT book file(s) found in storage"
        BOOKS_SIZE=$(docker run --rm -v "$VOLUME_NAME:/data" alpine du -sh /data/books 2>/dev/null | cut -f1)
        print_info "  Total books storage: $BOOKS_SIZE"
    else
        print_info "No books uploaded yet"
    fi
    
else
    print_warning "Volume '$VOLUME_NAME' does not exist"
    echo ""
    print_info "Creating volume '$VOLUME_NAME'..."
    
    if docker volume create "$VOLUME_NAME" &> /dev/null; then
        print_success "Volume created successfully"
    else
        print_error "Failed to create volume"
        exit 1
    fi
fi

echo ""
echo "========================================="
echo "Volume Status Summary"
echo "========================================="
echo "Volume Name: $VOLUME_NAME"
echo "Status: Ready for deployment"
echo ""

# Check for existing containers using this volume
echo "Checking for containers using this volume..."
CONTAINERS=$(docker ps -a --filter volume="$VOLUME_NAME" --format "{{.Names}}" 2>/dev/null || echo "")
if [ -n "$CONTAINERS" ]; then
    print_info "Containers using this volume:"
    echo "$CONTAINERS" | while read -r container; do
        STATUS=$(docker inspect "$container" --format '{{.State.Status}}' 2>/dev/null || echo "unknown")
        echo "  - $container (status: $STATUS)"
    done
else
    print_info "No containers currently using this volume"
fi

echo ""
print_success "Volume verification complete - safe to deploy!"
echo ""

exit 0


#!/bin/bash

# verify-persistence.sh
# Post-deployment script to verify data persistence is working correctly
# Tests that the volume is properly mounted and accessible to the application

set -e

VOLUME_NAME="phelddagrif_ebook_data"
CONTAINER_NAME_PATTERN="ebookvoyage"
APP_DATA_PATH="/app/data"

echo "========================================="
echo "EBook Reader - Persistence Verification"
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

# Find the running container
echo ""
echo "Finding application container..."
CONTAINER_ID=$(docker ps --filter "name=$CONTAINER_NAME_PATTERN" --format "{{.ID}}" | head -n 1)

if [ -z "$CONTAINER_ID" ]; then
    print_error "No running container found matching pattern '$CONTAINER_NAME_PATTERN'"
    echo ""
    print_info "Available containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}"
    echo ""
    print_warning "Make sure the application is deployed and running"
    exit 1
fi

CONTAINER_NAME=$(docker ps --filter "id=$CONTAINER_ID" --format "{{.Names}}")
print_success "Found container: $CONTAINER_NAME ($CONTAINER_ID)"

# Check container status
CONTAINER_STATUS=$(docker inspect "$CONTAINER_ID" --format '{{.State.Status}}')
print_info "Container status: $CONTAINER_STATUS"

if [ "$CONTAINER_STATUS" != "running" ]; then
    print_error "Container is not running"
    exit 1
fi

# Check volume mount
echo ""
echo "Checking volume mounts..."
MOUNTED_VOLUME=$(docker inspect "$CONTAINER_ID" --format '{{range .Mounts}}{{if eq .Destination "'$APP_DATA_PATH'"}}{{.Name}}{{end}}{{end}}')

if [ "$MOUNTED_VOLUME" = "$VOLUME_NAME" ]; then
    print_success "Correct volume '$VOLUME_NAME' is mounted at $APP_DATA_PATH"
else
    print_error "Volume mount mismatch!"
    print_info "Expected: $VOLUME_NAME"
    print_info "Found: $MOUNTED_VOLUME"
    exit 1
fi

# Verify volume is read-write
MOUNT_MODE=$(docker inspect "$CONTAINER_ID" --format '{{range .Mounts}}{{if eq .Destination "'$APP_DATA_PATH'"}}{{.RW}}{{end}}{{end}}')
if [ "$MOUNT_MODE" = "true" ]; then
    print_success "Volume is mounted read-write"
else
    print_warning "Volume is mounted read-only - this may cause issues"
fi

# Check database accessibility
echo ""
echo "Checking database accessibility..."
if docker exec "$CONTAINER_ID" test -f "$APP_DATA_PATH/db/sqlite.db" 2>/dev/null; then
    DB_SIZE=$(docker exec "$CONTAINER_ID" du -h "$APP_DATA_PATH/db/sqlite.db" 2>/dev/null | cut -f1)
    print_success "Database file accessible (size: $DB_SIZE)"
    
    # Test database permissions
    if docker exec "$CONTAINER_ID" test -r "$APP_DATA_PATH/db/sqlite.db" 2>/dev/null; then
        print_success "Database is readable"
    else
        print_error "Database is not readable"
        exit 1
    fi
    
    if docker exec "$CONTAINER_ID" test -w "$APP_DATA_PATH/db/sqlite.db" 2>/dev/null; then
        print_success "Database is writable"
    else
        print_error "Database is not writable"
        exit 1
    fi
else
    print_warning "Database file not found (may not be initialized yet)"
    print_info "Database will be created on first use"
fi

# Check books storage
echo ""
echo "Checking books storage..."
if docker exec "$CONTAINER_ID" test -d "$APP_DATA_PATH/books" 2>/dev/null; then
    print_success "Books directory exists"
    
    BOOK_COUNT=$(docker exec "$CONTAINER_ID" sh -c "find $APP_DATA_PATH/books -type f 2>/dev/null | wc -l" || echo "0")
    if [ "$BOOK_COUNT" -gt 0 ]; then
        BOOKS_SIZE=$(docker exec "$CONTAINER_ID" du -sh "$APP_DATA_PATH/books" 2>/dev/null | cut -f1)
        print_success "$BOOK_COUNT book file(s) found (total: $BOOKS_SIZE)"
    else
        print_info "No books uploaded yet"
    fi
else
    print_warning "Books directory not found (will be created on first upload)"
fi

# Check application health
echo ""
echo "Checking application health..."
HEALTH_STATUS=$(docker inspect "$CONTAINER_ID" --format '{{.State.Health.Status}}' 2>/dev/null || echo "none")
if [ "$HEALTH_STATUS" = "healthy" ]; then
    print_success "Application health check: healthy"
elif [ "$HEALTH_STATUS" = "none" ]; then
    print_info "No health check configured"
else
    print_warning "Application health check: $HEALTH_STATUS"
fi

# Test database with Prisma (if available)
echo ""
echo "Testing database connection..."
if docker exec "$CONTAINER_ID" sh -c "command -v npx" &>/dev/null; then
    # Try to run a simple database query
    if docker exec "$CONTAINER_ID" npx prisma db execute --stdin <<< "SELECT 1;" &>/dev/null 2>&1; then
        print_success "Database connection successful"
    else
        # Database might not be migrated yet, check migrations
        print_info "Checking migration status..."
        MIGRATION_OUTPUT=$(docker exec "$CONTAINER_ID" npx prisma migrate status 2>&1 || echo "")
        if echo "$MIGRATION_OUTPUT" | grep -q "Database schema is up to date"; then
            print_success "Database migrations are up to date"
        elif echo "$MIGRATION_OUTPUT" | grep -q "not been applied"; then
            print_warning "Database migrations need to be applied"
            print_info "Run: docker exec $CONTAINER_ID npx prisma migrate deploy"
        else
            print_info "Cannot determine migration status"
        fi
    fi
else
    print_info "Prisma CLI not available in container"
fi

# Check container logs for errors
echo ""
echo "Checking recent container logs for errors..."
ERROR_COUNT=$(docker logs "$CONTAINER_ID" --tail 100 2>&1 | grep -i "error" | grep -v "0 error" | wc -l || echo "0")
if [ "$ERROR_COUNT" -eq 0 ]; then
    print_success "No errors found in recent logs"
else
    print_warning "Found $ERROR_COUNT error message(s) in recent logs"
    print_info "Review logs with: docker logs $CONTAINER_ID"
fi

# Summary
echo ""
echo "========================================="
echo "Persistence Verification Summary"
echo "========================================="
echo "Container: $CONTAINER_NAME"
echo "Volume: $VOLUME_NAME"
echo "Mount Point: $APP_DATA_PATH"
echo "Status: $CONTAINER_STATUS"
echo ""

# Final verdict
ALL_CHECKS_PASSED=true

# Critical checks
if [ "$MOUNTED_VOLUME" != "$VOLUME_NAME" ]; then
    ALL_CHECKS_PASSED=false
fi

if [ "$MOUNT_MODE" != "true" ]; then
    ALL_CHECKS_PASSED=false
fi

if [ "$ALL_CHECKS_PASSED" = true ]; then
    print_success "All critical checks passed - persistence is configured correctly!"
    echo ""
    print_info "Next steps:"
    echo "  1. Create a test user account"
    echo "  2. Upload a test book"
    echo "  3. Restart the container: docker-compose restart"
    echo "  4. Verify the user can still log in and access the book"
    echo ""
    exit 0
else
    print_error "Some critical checks failed - please review the output above"
    echo ""
    exit 1
fi


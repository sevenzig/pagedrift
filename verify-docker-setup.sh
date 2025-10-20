#!/bin/bash

# Docker Setup Verification Script for PageDrift
# This script checks if your environment is properly configured for deployment

set -e

echo "🔍 PageDrift Docker Setup Verification"
echo "======================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Function to print status
print_status() {
    if [ "$1" = "OK" ]; then
        echo -e "${GREEN}✓${NC} $2"
    elif [ "$1" = "WARN" ]; then
        echo -e "${YELLOW}⚠${NC} $2"
        ((WARNINGS++))
    else
        echo -e "${RED}✗${NC} $2"
        ((ERRORS++))
    fi
}

# Check Docker installation
echo "1. Checking Docker installation..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    print_status "OK" "Docker installed: $DOCKER_VERSION"
else
    print_status "ERROR" "Docker is not installed"
fi

# Check Docker Compose installation
echo ""
echo "2. Checking Docker Compose installation..."
if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
    if docker compose version &> /dev/null; then
        COMPOSE_VERSION=$(docker compose version)
    else
        COMPOSE_VERSION=$(docker-compose --version)
    fi
    print_status "OK" "Docker Compose installed: $COMPOSE_VERSION"
else
    print_status "ERROR" "Docker Compose is not installed"
fi

# Check if .env file exists
echo ""
echo "3. Checking environment configuration..."
if [ -f .env ]; then
    print_status "OK" ".env file exists"
    
    # Check critical environment variables
    echo ""
    echo "   Validating environment variables..."
    
    # Load .env file
    export $(cat .env | grep -v '^#' | xargs)
    
    # Check JWT_SECRET
    if [ -z "$JWT_SECRET" ]; then
        print_status "ERROR" "JWT_SECRET is not set"
    elif [ "$JWT_SECRET" = "your-super-secret-jwt-key-change-this-in-production" ] || [ "$JWT_SECRET" = "CHANGE-THIS-generate-with-openssl-rand-base64-32" ]; then
        print_status "ERROR" "JWT_SECRET is using default value - must be changed for production!"
    elif [ ${#JWT_SECRET} -lt 32 ]; then
        print_status "WARN" "JWT_SECRET is shorter than 32 characters"
    else
        print_status "OK" "JWT_SECRET is properly configured"
    fi
    
    # Check MEILISEARCH_KEY
    if [ -z "$MEILISEARCH_KEY" ]; then
        print_status "ERROR" "MEILISEARCH_KEY is not set"
    elif [ "$MEILISEARCH_KEY" = "your-meilisearch-master-key-change-this" ] || [ "$MEILISEARCH_KEY" = "CHANGE-THIS-generate-with-openssl-rand-base64-32" ]; then
        print_status "ERROR" "MEILISEARCH_KEY is using default value - must be changed for production!"
    else
        print_status "OK" "MEILISEARCH_KEY is properly configured"
    fi
    
    # Check MEILISEARCH_MASTER_KEY
    if [ -z "$MEILISEARCH_MASTER_KEY" ]; then
        print_status "ERROR" "MEILISEARCH_MASTER_KEY is not set"
    elif [ "$MEILISEARCH_MASTER_KEY" = "your-meilisearch-master-key-change-this" ] || [ "$MEILISEARCH_MASTER_KEY" = "CHANGE-THIS-generate-with-openssl-rand-base64-32" ]; then
        print_status "ERROR" "MEILISEARCH_MASTER_KEY is using default value - must be changed for production!"
    else
        print_status "OK" "MEILISEARCH_MASTER_KEY is properly configured"
    fi
    
    # Check if keys match
    if [ "$MEILISEARCH_KEY" != "$MEILISEARCH_MASTER_KEY" ]; then
        print_status "WARN" "MEILISEARCH_KEY and MEILISEARCH_MASTER_KEY should match"
    fi
    
    # Check DATABASE_URL
    if [ -z "$DATABASE_URL" ]; then
        print_status "ERROR" "DATABASE_URL is not set"
    elif [[ "$DATABASE_URL" == *"/app/data/db/"* ]]; then
        print_status "OK" "DATABASE_URL is configured for Docker"
    else
        print_status "WARN" "DATABASE_URL might not be configured for Docker (expected: file:/app/data/db/sqlite.db)"
    fi
    
    # Check MEILISEARCH_HOST
    if [ -z "$MEILISEARCH_HOST" ]; then
        print_status "ERROR" "MEILISEARCH_HOST is not set"
    elif [ "$MEILISEARCH_HOST" = "http://meilisearch:7700" ]; then
        print_status "OK" "MEILISEARCH_HOST is configured for Docker"
    else
        print_status "WARN" "MEILISEARCH_HOST might not be configured for Docker (expected: http://meilisearch:7700)"
    fi
    
    # Check ORIGIN
    if [ -z "$ORIGIN" ]; then
        print_status "WARN" "ORIGIN is not set (will default to http://localhost:3000)"
    else
        print_status "OK" "ORIGIN is set to: $ORIGIN"
    fi
    
else
    print_status "ERROR" ".env file not found. Copy .env.docker or .env.example to .env"
fi

# Check if docker-compose.yml exists
echo ""
echo "4. Checking Docker Compose configuration..."
if [ -f docker-compose.yml ]; then
    print_status "OK" "docker-compose.yml exists"
else
    print_status "ERROR" "docker-compose.yml not found"
fi

# Check port availability
echo ""
echo "5. Checking port availability..."

# Check port 3000
if command -v lsof &> /dev/null; then
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_status "WARN" "Port 3000 is already in use"
    else
        print_status "OK" "Port 3000 is available"
    fi
    
    # Check port 7700
    if lsof -Pi :7700 -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_status "WARN" "Port 7700 is already in use"
    else
        print_status "OK" "Port 7700 is available"
    fi
elif command -v netstat &> /dev/null; then
    if netstat -tuln | grep -q ":3000 "; then
        print_status "WARN" "Port 3000 is already in use"
    else
        print_status "OK" "Port 3000 is available"
    fi
    
    if netstat -tuln | grep -q ":7700 "; then
        print_status "WARN" "Port 7700 is already in use"
    else
        print_status "OK" "Port 7700 is available"
    fi
else
    print_status "WARN" "Cannot check port availability (lsof/netstat not found)"
fi

# Check disk space
echo ""
echo "6. Checking disk space..."
AVAILABLE_SPACE=$(df -h . | awk 'NR==2 {print $4}')
print_status "OK" "Available disk space: $AVAILABLE_SPACE"

# Check if data directory exists
echo ""
echo "7. Checking data directories..."
if [ -d "./data" ]; then
    print_status "OK" "./data directory exists"
    
    # Check permissions
    if [ -w "./data" ]; then
        print_status "OK" "./data directory is writable"
    else
        print_status "WARN" "./data directory is not writable"
    fi
else
    print_status "OK" "./data directory will be created on first run"
fi

# Summary
echo ""
echo "======================================="
echo "📊 Verification Summary"
echo "======================================="

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "You're ready to deploy! Run:"
    echo "  docker-compose up -d"
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ $WARNINGS warning(s) found${NC}"
    echo ""
    echo "You can proceed, but review the warnings above."
    echo "To deploy, run:"
    echo "  docker-compose up -d"
else
    echo -e "${RED}✗ $ERRORS error(s) and $WARNINGS warning(s) found${NC}"
    echo ""
    echo "Please fix the errors above before deploying."
    echo ""
    echo "Quick fixes:"
    echo "  1. Copy environment file: cp .env.docker .env"
    echo "  2. Generate secrets: openssl rand -base64 32"
    echo "  3. Edit .env and update JWT_SECRET and MEILISEARCH keys"
    exit 1
fi

echo ""
echo "For detailed deployment instructions, see:"
echo "  - DOCKER_DEPLOYMENT.md (comprehensive guide)"
echo "  - README.md (quick start)"
echo ""


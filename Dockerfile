# Build stage
FROM node:25-alpine AS builder

WORKDIR /app

# Upgrade npm to 11.6.2
RUN npm install -g npm@11.6.2

# Configure npm for better reliability
RUN npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retries 5 && \
    npm config set fetch-timeout 300000

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for build)
# Use retry logic for resilience against network issues
RUN for i in 1 2 3; do npm ci --prefer-offline --no-audit && break || sleep 10; done

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the application
RUN npm run build

# Production stage
FROM node:25-alpine AS production

WORKDIR /app

# Install wget for healthchecks and upgrade npm to 11.6.2
RUN apk add --no-cache wget && \
    npm install -g npm@11.6.2

# Configure npm for better reliability
RUN npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retries 5 && \
    npm config set fetch-timeout 300000

# Copy package files
COPY package*.json ./

# Install production dependencies only
# Use retry logic for resilience against network issues
RUN for i in 1 2 3; do npm ci --omit=dev --prefer-offline --no-audit && break || sleep 10; done

# Copy built application from builder
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# Create data directories with proper permissions
RUN mkdir -p /app/data/books /app/data/db

# Note: We'll run as root to allow writing to mounted volumes
# In production with proper volume permissions, consider using USER node

# Expose port (can be overridden by PORT env var)
EXPOSE 7000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=7000
ENV HOST=0.0.0.0

# Health check - use dedicated health endpoint for comprehensive checks
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/api/health || exit 1

# Run migrations and start the app
# Use exec form to ensure proper signal handling
CMD ["sh", "-c", "npx prisma migrate deploy && exec node build"]


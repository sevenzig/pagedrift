# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the application
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built application from builder
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# Create data directories
RUN mkdir -p /app/data/books /app/data/db

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production

# Run migrations and start the app
CMD ["sh", "-c", "npx prisma migrate deploy && node build"]


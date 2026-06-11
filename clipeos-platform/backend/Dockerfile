# Multi-stage Docker setup for clean dependency handling
# Stage 1: Build dependencies
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files first for dependency caching
COPY package*.json ./

# Install all dependencies including native modules
RUN npm install --no-fund --no-audit --ignore-scripts

# Stage 2: Runtime image
FROM node:18-alpine AS runtime

WORKDIR /app

# Copy only necessary files from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY . .

# Install system dependencies needed for video processing
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++ \
    && npm rebuild-db

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -u 1001 -S nextjs -s /sbin/nologin -g "non-root user" nodejs
USER nodejs

# Expose backend port
EXPOSE 3001

# Start the application
CMD ["node", "index.js"]
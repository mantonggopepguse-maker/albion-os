# =============================================================================
# AlbionOS — Dockerfile for Google Cloud Run Deployment
# =============================================================================
# Multi-stage build: install deps → build → production image
# =============================================================================

# ─── Stage 1: Install Dependencies ───
FROM node:22-alpine AS deps
WORKDIR /app

# Copy only the files needed for dependency installation
COPY package.json package-lock.json ./

# Install production dependencies only (no devDependencies)
RUN npm ci --only=production

# ─── Stage 2: Build Application ───
FROM node:22-alpine AS builder
WORKDIR /app

# Copy all source files
COPY . .

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Build the Next.js application
RUN npm run build

# ─── Stage 3: Production Image ───
FROM node:22-alpine AS runner
WORKDIR /app

# Set Node to production mode
ENV NODE_ENV=production

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the standalone output from the builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Set the non-root user
USER nextjs

# Cloud Run provides the PORT env variable
ENV PORT=8080
EXPOSE 8080

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Start the Next.js server
CMD ["node", "server.js"]

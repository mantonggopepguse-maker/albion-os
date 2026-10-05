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

# Install all dependencies (including devDependencies needed for build)
RUN npm install

# ─── Stage 2: Build Application ───
FROM node:22-alpine AS builder
WORKDIR /app

# Copy all source files
COPY . .

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Build-time configuration — Next.js inlines NEXT_PUBLIC_* values at build time.
# Pass real values with --build-arg (e.g. in CI/CD); defaults keep the build green.
ARG NEXT_PUBLIC_SUPABASE_URL=https://knabfxzouliunawxirdh.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_5fgcVfjX5XVLK3pdr0c2Jg_M6ffJC19
ARG NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true
ARG NEXT_PUBLIC_USE_MOCK=true
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_ENABLE_DEMO_LOGIN=$NEXT_PUBLIC_ENABLE_DEMO_LOGIN \
    NEXT_PUBLIC_USE_MOCK=$NEXT_PUBLIC_USE_MOCK

# Build the Next.js application
RUN npm run build

# ─── Stage 3: Production Image ───
FROM node:22-alpine AS runner
WORKDIR /app

# Set Node to production mode
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"

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

# AlbionOS — Cloud Run Deployment Checklist

## Prerequisites

- [ ] Google Cloud project created
- [ ] Supabase project created
- [ ] Docker installed locally
- [ ] `gcloud` CLI installed and authenticated

## 1. Environment Variables

Set these in Cloud Run (or `.env.production`):

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key (safe for client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-side only, keep secret) |

## 2. Build & Deploy

```bash
# Build the Docker image
docker build -t gcr.io/[PROJECT-ID]/albion-os:latest .

# Push to Google Container Registry
docker push gcr.io/[PROJECT-ID]/albion-os:latest

# Deploy to Cloud Run
gcloud run deploy albion-os \
  --image gcr.io/[PROJECT-ID]/albion-os:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --cpu 1 \
  --memory 512Mi \
  --min-instances 0 \
  --max-instances 10 \
  --concurrency 80 \
  --timeout 300 \
  --set-env-vars "NEXT_PUBLIC_SUPABASE_URL=...,NEXT_PUBLIC_SUPABASE_ANON_KEY=..."
```

## 3. Database Migration

```bash
# Run schema migration against Supabase
# Copy supabase/schema.sql into Supabase SQL Editor and execute
```

## 4. Post-Deploy Verification

- [ ] Login page loads
- [ ] Quick-login works for demo accounts
- [ ] Dashboard renders with correct role-specific data
- [ ] Chat sends and receives messages
- [ ] Invoice creation and PDF generation works
- [ ] Payment approval flow completes correctly

## 5. Backup Setup

- [ ] Schedule `scripts/backup.ps1` daily via Task Scheduler
- [ ] Verify GCS bucket exists: `gsutil ls gs://albion-pharma-backups/`
- [ ] Test recovery: restore a backup to a staging Supabase project

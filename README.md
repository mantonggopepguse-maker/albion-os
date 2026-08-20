# AlbionOS — Enterprise Pharmaceutical Management

Enterprise operating system for Albion Pharmaceuticals (Nigeria). Manages inventory, sales, invoicing, payments, payroll, HR, internal chat, and veterinary clinic operations.

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, CSS Modules
- **Backend:** Supabase (PgSQL, Auth, Realtime, Storage)
- **Testing:** Vitest (unit), Playwright (e2e)
- **Deployment:** Docker → Google Cloud Run

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env.local
# Fill in your Supabase project credentials

# 3. Start dev server
npm run dev

# 4. Run tests
npm test           # Unit tests (Vitest)
npm run test:e2e   # E2E tests (Playwright)
npm run lint       # Lint check
npm run build      # Production build
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Server-only admin key |
| `NEXT_PUBLIC_ENABLE_DEMO_LOGIN` | No | Set `true` to show demo login buttons |
| `NEXT_PUBLIC_USE_MOCK` | No | Set `true` to enable mock data fallback |

## Database

Schema is in `supabase/schema.sql`. Apply via Supabase SQL Editor or:
```bash
# Or use the migration file:
psql $DATABASE_URL -f supabase/migrations/001_schema.sql
```

## Project Structure

```
src/
├── app/           # Next.js App Router pages
│   ├── login/     # Authentication
│   ├── signup/    # Registration
│   ├── dashboard/ # Role-specific dashboards
│   ├── products/  # Product catalog
│   ├── inventory/ # Stock management
│   ├── customers/ # Customer directory
│   ├── invoices/  # Sales invoicing
│   ├── payments/  # Payment verification
│   ├── reports/   # Analytics
│   ├── payroll/   # Payroll processing
│   ├── staff/     # User management
│   ├── chat/      # Internal messaging
│   └── clinic/    # Veterinary clinic
├── components/    # Reusable UI components
├── hooks/         # React hooks for data access
├── lib/           # Utilities, types, auth, data service
└── i18n/          # Internationalization (EN, HA, IG, YO)
```

## Security

- All database tables have Row Level Security (RLS)
- Payment approval runs via SECURITY DEFINER RPCs (server-side)
- Financial actions logged to immutable `audit_log` table
- Demo login gated behind `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false`
- Mock data tree-shaken from production builds (`NEXT_PUBLIC_USE_MOCK=false`)

## Deployment

```bash
# Build Docker image
docker build -t albion-os .

# Push to Google Container Registry
docker tag albion-os gcr.io/$PROJECT_ID/albion-os
docker push gcr.io/$PROJECT_ID/albion-os

# Deploy to Cloud Run (Cost-Optimized Scale-to-Zero)
gcloud run deploy albion-os \
  --image gcr.io/$PROJECT_ID/albion-os \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3
```

See `docs/deployment-checklist.md` for the full deployment guide.

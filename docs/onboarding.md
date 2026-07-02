# AlbionOS Onboarding Guide

## First-Time Setup

### 1. Prerequisites
- Node.js 22+
- npm 10+
- A Supabase project (free tier works)

### 2. Clone & Install
```bash
git clone <repo-url> albion-os
cd albion-os
npm install
```

### 3. Environment Variables
Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
```

### 4. Database Setup
Run the SQL files in order from the Supabase SQL Editor:

1. `supabase/schema.sql` — all tables, indexes, RLS policies, seed data
2. `supabase/profile-trigger.sql` — auto-create profiles on signup
3. `supabase/seed.sql` — (optional) demo data

### 5. Create Auth Users
Run `supabase/create-auth-users.sql` to create demo accounts:

| Email | Password | Role |
|---|---|---|
| `admin@albionpharma.com` | `AlbionTest123!` | super_admin |
| `chidi@albionpharma.com` | `AlbionTest123!` | sales_rep |
| `ngozi@albionpharma.com` | `AlbionTest123!` | finance_manager |
| `tunde@albionpharma.com` | `AlbionTest123!` | inventory_manager |
| `ceo@albionpharma.com` | `AlbionTest123!` | ceo |

### 6. Start Dev Server
```bash
npm run dev
```

Visit `http://localhost:3000` — click any demo account to log in.

---

## Role Overview

| Role | Permissions |
|---|---|
| **Super Admin** | Full access — all data, all actions |
| **CEO** | Read-only across all data; executive dashboard; can manage staff |
| **Sales Rep** | Own invoices, customers in territory, record payments |
| **Finance Manager** | Approve/reject payments, financial reports, all invoices |
| **Inventory Manager** | Manage products, stock, transfers; read-only elsewhere |

---

## Key Workflows

### Creating an Invoice
1. Go to **Invoices** → **Create Invoice**
2. Select customer and products
3. Set due date → invoice is created as **draft**
4. Click **Send** to move to **sent** status

### Recording a Payment
1. Go to **Payments** → **Record Payment**
2. Select the invoice, enter amount, choose method
3. For bank transfers, upload a receipt image
4. Finance manager reviews and **approves**

### Stock Transfer (FEFO)
1. Go to **Inventory**
2. Click **Allocate Stock**
3. Select source/destination locations, product, quantity
4. System deducts from the earliest-expiring batch first

### Running Reports
1. Go to **Reports**
2. Click **Generate** on any report card
3. Optionally set a date range
4. Click **View** to see the full breakdown

---

## Development

### Mock Data Mode
The app works fully offline using mock data arrays. If Supabase is
unreachable, every hook silently falls back to its mock counterpart.

### Unit Tests
```bash
npm test          # Run once
npm run test:watch  # Watch mode
```

### E2E Tests
```bash
npx playwright install chromium  # First time only
npm run test:e2e                 # Headless
npm run test:e2e:ui              # Interactive UI
```

### Docker
```bash
docker build -t albion-os .
docker run -p 3000:3000 albion-os
```

### Build
```bash
npm run build
npm start
```

---

## Deployment Checklist

See `docs/deployment-checklist.md` for production deployment steps.

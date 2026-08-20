# AlbionOS — Feature Specification Document

**Product:** AlbionOS Enterprise Pharmaceutical Management Platform
**Client:** Albion Pharmaceuticals (Nigeria)
**Version:** 1.0 (MVP)
**Date:** 20 June 2026
**Prepared by:** AlbionOS Development Team

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Overview](#2-product-overview)
3. [Technology Stack](#3-technology-stack)
4. [User Roles & Access Control](#4-user-roles--access-control)
5. [Authentication & Security](#5-authentication--security)
6. [Module 1: Dashboard](#6-module-1-dashboard)
7. [Module 2: Customer Management](#7-module-2-customer-management)
8. [Module 3: Invoice Management](#8-module-3-invoice-management)
9. [Module 4: Payment Management](#9-module-4-payment-management)
10. [Module 5: Product Catalog](#10-module-5-product-catalog)
11. [Module 6: Inventory Management](#11-module-6-inventory-management)
12. [Module 7: In-App Chat](#12-module-7-in-app-chat)
13. [Module 8: Reports Center](#13-module-8-reports-center)
14. [Module 9: User Management](#14-module-9-user-management)
15. [Database Architecture](#15-database-architecture)
16. [Row Level Security (RLS)](#16-row-level-security-rls)
17. [Design System & UI/UX](#17-design-system--uiux)
18. [Navigation Architecture](#18-navigation-architecture)
19. [Planned Features (Phase 2+)](#19-planned-features-phase-2)
20. [Deployment Architecture](#20-deployment-architecture)
21. [Appendices](#21-appendices)

---

## 1. Executive Summary

AlbionOS is a web-based enterprise management platform built for **Albion Pharmaceuticals**, a Nigerian pharmaceutical and veterinary products company headquartered in Onitsha, Anambra State. The platform digitises the company's end-to-end operations including:

- **Sales force management** — field sales reps create invoices, manage customers, and report payments from the field
- **Financial oversight** — finance managers verify payments, track receivables, and generate financial reports
- **Inventory control** — warehouse managers track product batches, manage expiry dates, and allocate stock to sales territories
- **Executive visibility** — the CEO/Super Admin has a unified dashboard with KPIs across all departments

The platform replaces manual Excel-based tracking and WhatsApp-based communication with a centralised, role-secured, real-time system.

---

## 2. Product Overview

| Attribute | Detail |
|:----------|:-------|
| **Product Name** | AlbionOS |
| **Product Type** | Web Application (Progressive Web App ready) |
| **Target Users** | Internal staff — 4 core roles |
| **Geographical Scope** | Nigeria (multi-territory: Lagos, Onitsha, Abuja, Delta) |
| **Currency** | Nigerian Naira (₦) |
| **Regulatory Body** | NAFDAC (National Agency for Food and Drug Administration and Control) |
| **VAT Rate** | 7.5% (Nigeria standard) |
| **Language** | English |

### Core Modules

| # | Module | Route | Description |
|:--|:-------|:------|:------------|
| 1 | Dashboard | `/dashboard` | Role-specific KPI dashboards with activity feeds |
| 2 | Customers | `/customers` | Customer directory with credit management |
| 3 | Invoices | `/invoices` | Invoice creation, tracking, and lifecycle management |
| 4 | Payments | `/payments` | Payment recording, verification, and approval workflows |
| 5 | Products | `/products` | Product catalog with NAFDAC compliance |
| 6 | Inventory | `/inventory` | Batch-level stock tracking with expiry management |
| 7 | Chat | `/chat` | Internal real-time team messaging |
| 8 | Reports | `/reports` | Business intelligence and report generation |
| 9 | Users | `/users` | User account management (admin only) |

---

## 3. Technology Stack

### Frontend

| Layer | Technology | Reason |
|:------|:-----------|:-------|
| **Framework** | Next.js 15 (App Router) | Server-side rendering, file-based routing, API routes |
| **Language** | TypeScript | Type safety across entire codebase |
| **Styling** | Vanilla CSS (CSS Modules) | Full design control without framework lock-in |
| **Design System** | Custom (CSS custom properties) | Neomorphic + glassmorphic aesthetic with soft gold accents |
| **Font** | Open Sans (Google Fonts) | Clean, professional pharmaceutical aesthetic |

### Backend

| Layer | Technology | Reason |
|:------|:-----------|:-------|
| **Database** | PostgreSQL (via Supabase) | Relational data with complex joins |
| **Authentication** | Supabase Auth | Email/password with session management |
| **API** | Supabase Auto-Generated REST + RPC | Zero-maintenance CRUD API layer |
| **Real-time** | Supabase Realtime (WebSockets) | Instant chat message delivery |
| **File Storage** | Supabase Storage | Payment receipts, chat attachments, product images |

### Infrastructure

| Layer | Technology | Reason |
|:------|:-----------|:-------|
| **Hosting** | Google Cloud Run | Auto-scaling, containerised, pay-per-use |
| **CDN** | Cloudflare (via Cloud Run) | Edge caching for static assets |
| **CI/CD** | GitHub Actions (planned) | Automated build, test, deploy |

---

## 4. User Roles & Access Control

AlbionOS implements a strict **Role-Based Access Control (RBAC)** system with four core roles. Each role sees a different dashboard and has access to a different set of modules.

### 4.1 Role Definitions

#### Super Admin (CEO)
- **Person:** Dr. Emeka Moneke
- **Email:** admin@albionpharma.com
- **Access:** Full platform access — all modules, all locations, all data
- **Dashboard:** CEO Dashboard — revenue, receivables, rep count, inventory value, activity feed, expiring stock
- **Key actions:** Create/manage users, view all reports, approve payments, manage locations

#### Sales Representative
- **Person:** Chidi Okafor
- **Email:** chidi@albionpharma.com
- **Access:** Territory-scoped — can only see data for their assigned location
- **Dashboard:** Sales Dashboard — personal inventory, monthly sales, outstanding balances, customer count, quick actions, recent invoices
- **Key actions:** Create invoices, add customers, record payments, view allocated inventory, send chat messages

#### Finance Manager
- **Person:** Ngozi Eze
- **Email:** ngozi@albionpharma.com
- **Access:** Broad read access — all invoices, all payments, all customers
- **Dashboard:** Finance Dashboard — receivables, monthly collections, pending approvals, overdue amounts, payment verification queue, rep balance summary
- **Key actions:** Approve/reject payments, generate financial reports, view all invoices

#### Inventory Manager
- **Person:** Tunde Adeyemi
- **Email:** tunde@albionpharma.com
- **Access:** Stock-focused — all inventory across all locations
- **Dashboard:** Inventory Dashboard — total stock, product count, expiring items, pending transfers, warehouse overview, recent movements
- **Key actions:** Add products, allocate stock to territories, manage batches, track expiry dates

### 4.2 Module Access Matrix

| Module | Super Admin | Sales Rep | Finance Manager | Inventory Manager |
|:-------|:----------:|:---------:|:---------------:|:-----------------:|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Chat | ✅ | ✅ | ✅ | ✅ |
| Products | ✅ | ❌ | ❌ | ✅ |
| Inventory | ✅ | ✅ (read-only) | ❌ | ✅ |
| Customers | ✅ | ✅ (own territory) | ❌ | ❌ |
| Invoices | ✅ | ✅ (own invoices) | ✅ | ❌ |
| Payments | ✅ | ❌ | ✅ | ❌ |
| Reports | ✅ | ❌ | ✅ | ❌ |
| Users | ✅ | ❌ | ❌ | ❌ |

---

## 5. Authentication & Security

### 5.1 Login System

**Route:** `/login`

**Design:** Split-panel layout
- **Left panel** — Brand showcase with logo, tagline ("Enterprise Pharmaceutical Management Platform"), feature highlights (Real-time Inventory, Smart Invoicing, Secure Payments), and decorative CSS circles for visual depth
- **Right panel** — Login form with email/password fields

**Features:**
- Email + Password authentication
- "Remember me" session persistence via localStorage
- Inline error messages for failed login attempts
- Loading spinner during authentication
- Auto-redirect to `/dashboard` on successful login
- **Demo Quick-Login buttons** — four one-click buttons for each mock user role (for development/demo mode), each showing the user's name, role, and pre-filling credentials automatically

**Authentication Flow:**
1. User enters email + password
2. System validates credentials (mock mode: checks against hardcoded users; production: Supabase Auth signInWithPassword)
3. On success — session persisted to localStorage — redirect to /dashboard
4. On failure — inline error alert displayed

**Session Persistence:**
- Stores authenticated user object in localStorage under key `albion_auth_user`
- On page reload, session is restored from localStorage
- Logout clears localStorage and redirects to /login

### 5.2 Middleware Protection

**File:** src/middleware.ts

- Next.js middleware intercepts all routes
- Checks for valid Supabase session cookie
- Unauthenticated users redirected to /login
- Login page bypassed for authenticated users
- Currently disabled (pass-through) pending Supabase key provision

### 5.3 Row Level Security (RLS)

All database tables enforce Row Level Security via PostgreSQL policies. Two helper functions avoid repeated subqueries:
- `get_user_role()` — returns the current user's role string
- `get_user_location()` — returns the current user's location_id

Both functions are SECURITY DEFINER (prevents RLS recursion on profiles table) and STABLE (allows PostgreSQL to cache results within a single statement).

---

## 6. Module 1: Dashboard

**Route:** `/dashboard`
**Access:** All roles (each sees a different view)

The dashboard renders a completely different layout based on the authenticated user's role. All four dashboards share the same StatCard component for KPI metrics.

### 6.1 StatCard Component

A reusable KPI card displayed at the top of every dashboard variant.

| Property | Type | Description |
|:---------|:-----|:------------|
| label | string | Metric name (e.g., "Total Revenue") |
| value | string | Pre-formatted display value (e.g., "₦12,450,000") |
| icon | string | Emoji icon |
| trend | 'up' or 'down' | Direction indicator arrow |
| trendLabel | string | Descriptive text (e.g., "12% from last month") |
| color | string | CSS variable for icon background tint |

### 6.2 CEO Dashboard (Super Admin)

**KPI Cards (4):**

| Metric | Value | Trend |
|:-------|:------|:------|
| Total Revenue | ₦12,450,000 | ↑ 12% from last month |
| Outstanding Receivables | ₦3,280,000 | ↓ 8% from last month |
| Active Sales Reps | 4 | — |
| Inventory Value | ₦8,750,000 | ↑ New stock received |

**Content Sections:**

1. **Recent Activity Feed** — chronological list of system events:
   - Invoice creations (with invoice number)
   - Payment approvals (with amount)
   - Stock allocations (with quantity and destination)
   - Customer registrations
   - Stock expiry alerts
   - Each event shows: icon, description text, relative timestamp

2. **Expiring Stock Alerts** — batch-level countdown:
   - Product name, batch number, days until expiry
   - Colour-coded badges: Danger (<30 days red), Warning (<60 days yellow), Safe (60+ days green)

### 6.3 Sales Rep Dashboard

**KPI Cards (4):**

| Metric | Value |
|:-------|:------|
| My Inventory | 342 units |
| This Month Sales | ₦2,150,000 (↑ 18% vs last month) |
| Outstanding Balances | ₦680,000 |
| Customers | 24 |

**Content Sections:**

1. **Quick Actions** — four shortcut buttons:
   - New Invoice
   - Add Customer
   - Message Finance
   - Stock Take

2. **Recent Invoices** — list of latest invoices:
   - Invoice number, customer name, amount
   - Colour-coded status badges: Paid (green), Pending (yellow), Overdue (red)

### 6.4 Finance Manager Dashboard

**KPI Cards (4):**

| Metric | Value |
|:-------|:------|
| Total Receivables | ₦3,280,000 |
| Payments This Month | ₦5,420,000 (↑ Collections up 15%) |
| Pending Approvals | 3 |
| Overdue (90+ days) | ₦450,000 |

**Content Sections:**

1. **Payment Verification Queue** — list of pending payments:
   - Rep name, customer, amount, payment method, time submitted
   - "Approve" button on each entry

2. **Rep Balance Summary** — per-rep financial snapshot:
   - Rep name, stock value held, amount collected, outstanding dues

### 6.5 Inventory Manager Dashboard

**KPI Cards (4):**

| Metric | Value |
|:-------|:------|
| Total Stock | 1,842 units |
| Products | 8 |
| Expiring Soon (30d) | 124 units |
| Pending Transfers | 2 |

**Content Sections:**

1. **Warehouse Stock Overview** — tabular product listing:
   - Product name, quantity, batch number, expiry date

2. **Recent Movements** — chronological feed:
   - Stock allocations (with quantity and destination)
   - Supplier receipts
   - Stock take results (with discrepancy count)

---

## 7. Module 2: Customer Management

**Route:** `/customers`
**Access:** Super Admin (all customers), Sales Rep (own territory)

### 7.1 Features

**Header Section:**
- Page title: "Customers"
- "Add Customer" button (top right)
- Search bar with real-time filtering across name, business name, phone, and state

**Summary Statistics (3 cards):**

| Stat | Calculation |
|:-----|:-----------|
| Total Customers | Count of all customer records |
| Total Credit Limit | Sum of all credit_limit values |
| Outstanding Balance | Sum of all outstanding_balance values |

Note: Summary stats always reflect the full dataset, not the filtered search results.

**Data Table:**

| Column | Description |
|:-------|:-----------|
| Customer Name | Contact person's full name |
| Business Name | Registered business/pharmacy name |
| Phone | Primary phone number |
| State | Nigerian state |
| Credit Limit (₦) | Maximum allowed credit, formatted with thousands separators |
| Outstanding Balance (₦) | Current unpaid amount, colour-coded: Red if > ₦0, Green if ₦0 |

**Table Interactions:**
- Hover effect on each row (clickable appearance)
- Search filters in real-time (case-insensitive)
- Currency formatted using Nigerian locale (en-NG)

### 7.2 Add Customer Form (Planned)

| Field | Type | Validation |
|:------|:-----|:-----------|
| Name | Text | Required |
| Business Name | Text | Required |
| Phone | Text | Required, Nigerian format |
| Email | Email | Optional |
| Address | Textarea | Required |
| State | Dropdown | Required, Nigerian states |
| Credit Limit | Number | Required, >= 0 |

---

## 8. Module 3: Invoice Management

**Route:** `/invoices`
**Access:** Super Admin (all), Sales Rep (own), Finance Manager (all, read-only)

### 8.1 Features

**Header Section:**
- Page title: "Invoices"
- "New Invoice" button (top right)
- Status filter tabs with live counts

**Status Filter Tabs:**

| Tab | Filter | Badge Colour |
|:----|:-------|:-------------|
| All | No filter | — |
| Draft | status = 'draft' | Gray |
| Sent | status = 'sent' | Yellow |
| Paid | status = 'paid' | Green |
| Partial | status = 'partial' | Blue |
| Overdue | status = 'overdue' | Red |

Each tab displays a count of matching invoices.

**Data Table:**

| Column | Description |
|:-------|:-----------|
| Invoice # | Human-readable number (e.g., "INV-2026-001") |
| Customer | Resolved from customer_id via customer lookup |
| Amount (₦) | Grand total with Nigerian locale formatting |
| Status | Colour-coded badge |
| Date | Invoice creation date |
| Due Date | Payment deadline |

### 8.2 Invoice Data Model

```
Invoice
  id (UUID)
  invoice_number (e.g., "INV-2026-001")
  customer_id -> Customer
  sales_rep_id -> User
  location_id -> Location
  items[] -> InvoiceItem[]
    product_id -> Product
    product_name (denormalised snapshot)
    quantity
    unit_price (at time of sale)
    total (quantity x unit_price)
  subtotal (sum of item totals)
  vat (7.5% of subtotal)
  total (subtotal + vat)
  status (draft -> sent -> paid/partial/overdue)
  created_at
  due_date
```

### 8.3 Invoice Status Lifecycle

```
draft -> sent -> paid
              -> partial -> paid
              -> overdue -> paid
```

### 8.4 Create Invoice Form (Planned)

**Multi-step workflow:**
1. **Select Customer** — dropdown from customer list
2. **Add Line Items** — product dropdown + quantity, running subtotal
3. **Review & Submit** — shows subtotal, VAT (7.5%), grand total

**Auto-generated fields:**
- Invoice Number: INV-{YEAR}-{SEQUENTIAL}
- Sales Rep ID: from authenticated user
- Location ID: from authenticated user's territory

---

## 9. Module 4: Payment Management

**Route:** `/payments`
**Access:** Super Admin, Finance Manager

### 9.1 Features

**Header Section:**
- Page title: "Payments"
- "Record Payment" button
- Tab-based status filtering

**Status Tabs:**

| Tab | Filter |
|:----|:-------|
| Pending Approval | status = 'pending' |
| Approved | status = 'approved' |
| Rejected | status = 'rejected' |
| All | No filter |

**Summary Statistics (4 cards):**

| Stat | Description |
|:-----|:-----------|
| Total Payments | Count of all payment records |
| Total Amount | Sum of all payment amounts |
| Pending Count | Count of pending payments |
| Pending Amount | Sum of pending payment amounts |

**Payment Cards:**

Each payment is displayed as a card showing:

| Field | Description |
|:------|:-----------|
| Customer Name | Resolved from customer_id |
| Amount (₦) | Payment amount |
| Payment Method | "Cash" or "Bank Transfer" |
| Recorded By | Sales rep name (resolved from recorded_by) |
| Date | Creation timestamp |
| Status Badge | Colour-coded: Yellow=Pending, Green=Approved, Red=Rejected |

**Action Buttons (for pending payments only):**
- **Approve** — marks payment as approved
- **Reject** — marks payment as rejected (with reason prompt)
- **View Receipt** — opens uploaded proof image (if bank transfer with proof_url)

### 9.2 Payment Verification Workflow

```
1. Sales Rep records payment in the field
2. Payment created with status = 'pending'
3. If bank_transfer: rep uploads receipt photo -> proof_url
4. Finance Manager sees payment in "Pending Approval" tab
5. Finance reviews proof, amount, and customer
6a. Approve -> status = 'approved', approved_by = finance user
6b. Reject -> status = 'rejected', notes = rejection reason
```

### 9.3 Record Payment Form (Planned)

| Field | Type | Validation |
|:------|:-----|:-----------|
| Invoice | Dropdown | Required (select from open invoices) |
| Amount | Number | Required, > 0, <= invoice outstanding |
| Method | Radio | Required: Cash / Bank Transfer |
| Proof Upload | File | Required if method is Bank Transfer |
| Notes | Textarea | Optional |

---

## 10. Module 5: Product Catalog

**Route:** `/products`
**Access:** Super Admin, Inventory Manager

### 10.1 Features

**Header Section:**
- Page title: "Product Catalog"
- "Add Product" button (top right)
- Search bar with real-time filtering

**Product Cards (Grid Layout):**

Each product is displayed as a card showing:

| Field | Description |
|:------|:-----------|
| Product Name | Commercial name (e.g., "Albion Ivermectin 1% Injectable") |
| SKU | Stock-keeping unit code (e.g., "ALB-IVM-001") |
| NAFDAC Number | Regulatory approval code (e.g., "NAFDAC/VET/2024/0001") |
| Unit Price (₦) | Price in Naira with locale formatting |
| Category | Product category (e.g., "Injectable", "Premix", "Bolus") |

**Card Interactions:**
- Hover elevation effect
- Category badge with colour coding
- Search filters across name, SKU, and category

### 10.2 Product Data

The platform ships with 8 products in the development seed data:

| Product | SKU | Category | Price (₦) |
|:--------|:----|:---------|:----------|
| Albion Ivermectin 1% Injectable | ALB-IVM-001 | Injectable | 3,500 |
| Albion Oxytetracycline LA | ALB-OTC-002 | Injectable | 4,200 |
| Albion Multivitamin Premix | ALB-MVP-003 | Premix | 2,800 |
| Albion Calcium Borogluconate | ALB-CAL-004 | Injectable | 5,500 |
| Albion Diminazene Aceturate | ALB-DIM-005 | Injectable | 1,800 |
| Albion Poultry Vitamin Pack | ALB-PVP-006 | Premix | 950 |
| Albion Dewormer Bolus | ALB-DWB-007 | Bolus | 650 |
| Albion Wound Spray | ALB-WDS-008 | Topical | 1,200 |

### 10.3 Add Product Form (Planned)

| Field | Type | Validation |
|:------|:-----|:-----------|
| Product Name | Text | Required |
| SKU | Text | Required, unique |
| NAFDAC Number | Text | Required |
| Unit Price | Number | Required, > 0 |
| Category | Dropdown | Required (Injectable, Premix, Bolus, Topical, etc.) |
| Description | Textarea | Optional |
| Product Image | File Upload | Optional |

---

## 11. Module 6: Inventory Management

**Route:** `/inventory`
**Access:** Super Admin, Sales Rep (own territory, read-only), Inventory Manager

### 11.1 Features

**Header Section:**
- Page title: "Inventory"
- "Allocate Stock" button (top right)
- Tab-based view filtering

**Tabs:**

| Tab | Description | Filter Logic |
|:----|:-----------|:-------------|
| Warehouse Stock | Stock at HQ warehouse | location.type = 'warehouse' |
| Rep Allocations | Stock allocated to sales territories | location.type = 'territory' |
| Expiring Soon | Items within 90 days of expiry | daysTillExpiry <= 90 |

**Inventory Table:**

| Column | Description |
|:-------|:-----------|
| Product Name | Resolved from product_id via product lookup |
| Batch Number | Manufacturer's batch/lot number |
| Quantity | Units in stock |
| Expiry Date | Product expiration date, colour-coded |
| Status | Badge with colour code |

**Expiry Date Colour Coding:**

| Condition | Colour | Meaning |
|:----------|:-------|:--------|
| < 30 days | Red | Critical — must sell or return immediately |
| < 60 days | Yellow | Warning — prioritise for sale |
| >= 60 days | Green | Safe |

**Status Badges:**

| Status | Colour | Meaning |
|:-------|:-------|:--------|
| in_stock | Green | Normal availability |
| low_stock | Yellow | Below reorder threshold |
| out_of_stock | Gray | Zero quantity |
| expired | Red | Past expiry date |
| allocated | Blue | Reserved for a pending order |

### 11.2 Allocate Stock Form (Planned)

| Field | Type | Validation |
|:------|:-----|:-----------|
| Product | Dropdown | Required (from product catalog) |
| Destination | Dropdown | Required (territory/warehouse) |
| Quantity | Number | Required, > 0, <= available warehouse stock |
| Batch Number | Text | Required (select from available batches) |

**Business Logic:**
- Deducts quantity from source warehouse batch
- Creates or increments batch at destination location
- Records a stock_movement audit entry with type 'allocation'

---

## 12. Module 7: In-App Chat

**Route:** `/chat`
**Access:** All roles

### 12.1 Features

**Layout:** Full-height two-panel design (WhatsApp/Slack inspired)

**Left Panel — Contact List (300px):**
- Lists all users except the currently logged-in user
- Each contact shows:
  - Avatar initials (2-letter, colour-coded by role)
  - Full name
  - Role label (e.g., "Sales Representative")
  - Last message preview (truncated)
  - Unread message count badge
- Active contact highlighted
- Search/filter contacts (planned)

**Right Panel — Message Thread:**
- Full conversation history between current user and selected contact
- Messages displayed as chat bubbles:
  - **Sent messages** — right-aligned, blue/navy background
  - **Received messages** — left-aligned, grey background
- Each message shows: content text, timestamp
- Auto-scrolls to latest message on new message or contact switch

**Message Input Area:**
- Text input field with placeholder "Type a message..."
- Attachment button for file upload (planned)
- Send button
- Send on Enter key press
- Empty field prevents sending

**Empty State:**
- When no contact is selected: centered message "Select a conversation to start chatting" with chat icon

### 12.2 Real-time Messaging (Planned)

When connected to Supabase:
- Messages delivered via Supabase Realtime WebSocket subscription
- Listens on chat_messages table for INSERT events
- Filters to messages where receiver_id = current_user.id
- Incoming messages appear instantly without page refresh
- is_read flag toggled when receiver views the message

### 12.3 Chat Data Model

```
ChatMessage
  id (UUID)
  sender_id -> User
  receiver_id -> User
  content (text body, nullable if attachment-only)
  attachment_url (Supabase Storage URL)
  attachment_type ('image', 'document', etc.)
  is_read (boolean, default false)
  created_at (timestamp)
```

---

## 13. Module 8: Reports Center

**Route:** `/reports`
**Access:** Super Admin, Finance Manager

### 13.1 Features

**Report Types (6 cards in grid):**

| Report | Icon | Description | Status |
|:-------|:-----|:-----------|:-------|
| Sales Report | 📊 | Revenue by rep, region, and time period | Active |
| Inventory Report | 📦 | Stock levels, expiry alerts, movement history | Active |
| Financial Report | 💰 | Receivables, collections, aging analysis | Active |
| Customer Report | 👥 | Customer activity, purchase history, balances | Active |
| Rep Performance | 🏆 | Sales targets, collection rates, visit logs | Coming Soon |
| Expiry Report | ⚠️ | Products expiring within 30/60/90 days | Coming Soon |

**Card Features:**
- Staggered CSS animation (cascading entrance, 70ms delay per card)
- "Coming Soon" ribbon badge on unavailable reports
- "Generate" button (active reports) / "Unavailable" button (coming soon, disabled)
- Options menu button on active reports

**Recent Reports Section:**
- Placeholder section for previously generated reports
- Currently shows empty state: "No reports generated yet"

### 13.2 Report Generation (Planned)

Each report will support:
- **Date range picker** — custom start/end dates
- **Filter by location** — territory/warehouse dropdown
- **Filter by rep** — sales rep dropdown (for Sales and Rep Performance reports)
- **Export formats** — PDF download, CSV export
- **Cached results** — stored with a token for later retrieval

---

## 14. Module 9: User Management

**Route:** `/users`
**Access:** Super Admin only

### 14.1 Features

**Header Section:**
- Page title: "User Management"
- "Add User" button (top right)
- Subtitle with active user count

**User Table:**

| Column | Description |
|:-------|:-----------|
| Name | Full name with avatar initials |
| Email | Corporate email address |
| Role | Colour-coded badge |
| Location | Assigned territory/warehouse name |
| Phone | Nigerian phone number |
| Status | "Active" indicator (green dot) |
| Actions | "Edit" button |

**Role Badge Colours:**

| Role | Colour |
|:-----|:-------|
| Super Admin | Navy (#093961) |
| Sales Representative | Ocean (#1E4F77) |
| Finance Manager | Green |
| Inventory Manager | Amber/Orange |

### 14.2 Add User Form (Planned)

| Field | Type | Validation |
|:------|:-----|:-----------|
| Full Name | Text | Required |
| Email | Email | Required, unique, @albionpharma.com |
| Phone | Text | Required, Nigerian format |
| Role | Dropdown | Required (4 role options) |
| Location | Dropdown | Required (from locations table) |
| Password | Password | Required, min 8 characters |

**Business Logic:**
- Creates Supabase Auth user
- Creates profile record linked to auth user
- Sends welcome email with credentials (planned)

---

## 15. Database Architecture

### 15.1 Entity Relationship Overview

```
locations
  -> profiles (1:1 with auth.users)
  -> inventory
  -> customers
  -> invoices

products
  -> inventory
  -> invoice_items
  -> stock_movements

customers
  -> invoices
  -> payments

invoices
  -> invoice_items (cascade delete)
  -> payments

profiles
  -> invoices (sales_rep_id)
  -> payments (recorded_by, approved_by)
  -> customers (created_by)
  -> chat_messages (sender_id, receiver_id)
  -> stock_movements (performed_by)
```

### 15.2 Table Definitions

| # | Table | Rows (Seed) | Primary Key | Description |
|:--|:------|:-----------|:-----------|:------------|
| 1 | locations | 4 | UUID | Warehouses, territories, clinics |
| 2 | profiles | 4 | UUID (FK to auth.users) | User profiles |
| 3 | products | 8 | UUID | Product catalog |
| 4 | inventory | ~12 | UUID | Stock batches per location |
| 5 | customers | 6 | UUID | Buyer records |
| 6 | invoices | 5 | UUID | Invoice headers |
| 7 | invoice_items | ~15 | UUID | Invoice line items |
| 8 | payments | 4 | UUID | Payment records |
| 9 | chat_messages | 10 | UUID | Direct messages |
| 10 | stock_movements | — | UUID | Inventory audit trail |

### 15.3 Key Constraints

- All primary keys are UUID v4 (uuid_generate_v4())
- All mutable tables have created_at and updated_at with auto-update triggers
- Enum values enforced via CHECK constraints (no separate enum types)
- Cascade delete: invoice_items deleted when parent invoice is deleted
- Cascade delete: profiles deleted when parent auth.users is deleted
- Soft-delete pattern: is_active boolean on locations, profiles, products, customers

### 15.4 Performance Indexes

| Index | Table | Column(s) | Purpose |
|:------|:------|:----------|:--------|
| idx_profiles_role | profiles | role | RLS policy hot path |
| idx_profiles_location | profiles | location_id | Location-scoped queries |
| idx_inventory_product | inventory | product_id | Product batch lookups |
| idx_inventory_location | inventory | location_id | Location stock views |
| idx_inventory_expiry | inventory | expiry_date | Expiry report scans |
| idx_customers_location | customers | location_id | Territory filtering |
| idx_invoices_customer | invoices | customer_id | Customer invoice history |
| idx_invoices_rep | invoices | sales_rep_id | "My invoices" queries |
| idx_invoices_status | invoices | status | Status tab filtering |
| idx_payments_status | payments | status | Verification queue |
| idx_payments_invoice | payments | invoice_id | Financial reconciliation |
| idx_chat_sender | chat_messages | sender_id | Sent message lookups |
| idx_chat_receiver | chat_messages | receiver_id | Received message lookups |
| idx_chat_created | chat_messages | created_at | Chronological ordering |
| idx_stock_movements_product | stock_movements | product_id | Audit trail lookups |

---

## 16. Row Level Security (RLS)

Every table has RLS enabled. Here is the complete policy matrix:

### Profiles

| Operation | Policy | Rule |
|:----------|:-------|:-----|
| SELECT | All users | true (everyone can read profiles) |
| UPDATE | Own only | id = auth.uid() |
| INSERT | Admin only | get_user_role() = 'super_admin' |
| DELETE | Admin only | get_user_role() = 'super_admin' |

### Products

| Operation | Policy | Rule |
|:----------|:-------|:-----|
| SELECT | All users | true |
| INSERT/UPDATE/DELETE | Admin + Inventory | role IN ('super_admin', 'inventory_manager') |

### Inventory

| Operation | Policy | Rule |
|:----------|:-------|:-----|
| SELECT | Admin | All inventory |
| SELECT | Sales Rep | Own location only (location_id = get_user_location()) |
| SELECT | Inventory Manager | All inventory |
| SELECT | Finance Manager | All inventory (read-only) |
| INSERT/UPDATE/DELETE | Admin + Inventory | role IN ('super_admin', 'inventory_manager') |

### Customers

| Operation | Policy | Rule |
|:----------|:-------|:-----|
| SELECT | Admin + Finance | All customers |
| SELECT | Sales Rep | Own territory OR customers they created |
| INSERT | Admin + Sales Rep | role IN ('super_admin', 'sales_rep') |
| UPDATE | Admin + Finance + Creator | role IN ('super_admin', 'finance_manager') OR created_by = auth.uid() |

### Invoices

| Operation | Policy | Rule |
|:----------|:-------|:-----|
| SELECT | Admin + Finance | All invoices |
| SELECT | Sales Rep | Own invoices only (sales_rep_id = auth.uid()) |
| INSERT | Admin + Sales Rep | role IN ('super_admin', 'sales_rep') |
| UPDATE | Sales Rep | Own drafts only (sales_rep_id = auth.uid() AND status = 'draft') |
| UPDATE | Admin + Finance | Any invoice |

### Payments

| Operation | Policy | Rule |
|:----------|:-------|:-----|
| SELECT | Admin + Finance | All payments |
| SELECT | Sales Rep | Own recorded payments only (recorded_by = auth.uid()) |
| INSERT | Admin + Sales Rep | role IN ('super_admin', 'sales_rep') |
| UPDATE | Admin + Finance | Any payment (approve/reject) |

### Chat Messages

| Operation | Policy | Rule |
|:----------|:-------|:-----|
| SELECT | Participant only | sender_id = auth.uid() OR receiver_id = auth.uid() |
| INSERT | Authenticated | sender_id = auth.uid() (prevents impersonation) |
| UPDATE | Receiver only | receiver_id = auth.uid() (mark as read) |

---

## 17. Design System & UI/UX

### 17.1 Design Language

AlbionOS uses a **neomorphic + glassmorphic** design language with soft gold accents:

- **Neomorphism** — soft inner/outer shadows creating raised or inset surfaces
- **Glassmorphism** — frosted glass effects with backdrop-filter blur and semi-transparent backgrounds
- **Soft Gold Accents** — warm gold highlights on interactive elements and hover states
- **No dark mode** — the client specifically requested light-only mode
- **No maps** — geographic features excluded per client request

### 17.2 Colour Palette

| Token | Hex | Usage |
|:------|:----|:------|
| --color-navy | #093961 | Primary brand, headers, active states |
| --color-ocean | #1E4F77 | Secondary brand, sidebar |
| --color-slate | #324553 | Text, subtle backgrounds |
| --color-white | #FFFFFF | Backgrounds, cards |
| --color-gray | #a2a3a2 | Muted text, borders |
| --color-gold | #C5A55A | Soft gold accents, hover highlights |
| --color-success | #22c55e | Positive states (paid, approved, in-stock) |
| --color-warning | #f59e0b | Warning states (pending, low-stock, expiring) |
| --color-danger | #ef4444 | Negative states (overdue, rejected, expired) |
| --color-info | #3b82f6 | Informational states (partial, allocated) |

### 17.3 Typography

- **Font Family:** Open Sans (Google Fonts)
- **Scale:** --font-size-xs through --font-size-4xl
- **Weight:** 400 (regular), 600 (semibold), 700 (bold)

### 17.4 Spacing & Layout

- **Spacing Scale:** --space-1 (4px) through --space-12 (48px)
- **Border Radius:** --radius-sm (4px), --radius-md (8px), --radius-lg (12px), --radius-xl (16px)
- **Shadows:** 4 levels — --shadow-sm, --shadow-md, --shadow-lg, --shadow-xl
- **Neomorphic Shadows:** --neo-shadow-raised, --neo-shadow-inset (dual-shadow technique)
- **Glass Effect:** --glass-bg, --glass-border, backdrop-filter blur(12px)

### 17.5 Animations

- **Fade In** — @keyframes fadeIn (opacity 0 to 1)
- **Slide In** — @keyframes slideIn (translate Y 20px to 0)
- **Pulse** — @keyframes pulse (scale 1 to 1.05 to 1)
- **Staggered Entry** — cards use animation-delay: calc(index * 0.07s)

---

## 18. Navigation Architecture

### 18.1 Application Shell

```
+---------------------------------------------+
|  Sidebar (fixed, 260px)  |  Main Content    |
|  +-------------------+   |  +-------------+ |
|  |  Logo: AlbionOS   |   |  |  Topbar     | |
|  |  Pharma Suite     |   |  |  - Title    | |
|  +-------------------+   |  |  - Search   | |
|  |  Dashboard        |   |  |  - Bell     | |
|  |  Chat             |   |  |  - User     | |
|  |  Products *       |   |  +-------------+ |
|  |  Inventory        |   |  +-------------+ |
|  |  Customers *      |   |  |  Page       | |
|  |  Invoices         |   |  |  Content    | |
|  |  Payments *       |   |  |             | |
|  |  Reports *        |   |  |             | |
|  |  Users *          |   |  +-------------+ |
|  +-------------------+   |                   |
|  |  [Avatar] User    |   |                   |
|  |  Name + Role      |   |                   |
|  +-------------------+   |                   |
+---------------------------------------------+

* = Role-restricted (see access matrix)
```

### 18.2 Topbar Features

- **Page Title** — dynamically set by each page (e.g., "Invoices", "CEO Dashboard")
- **Search Bar** — global search (placeholder, planned)
- **Notification Bell** — with unread count badge (placeholder)
- **User Menu** — avatar initials, name, role, logout button

---

## 19. Planned Features (Phase 2+)

### Phase 2: Functional Forms & Supabase

| Feature | Priority | Description |
|:--------|:---------|:------------|
| Add Customer Form | High | Modal form to create new customer records |
| Create Invoice Form | High | Multi-step invoice builder with line items |
| Record Payment Form | High | Payment recording with receipt upload |
| Add Product Form | High | Product catalog entry form |
| Allocate Stock Form | High | Stock transfer from warehouse to territory |
| Supabase Connection | High | Replace mock data with live database queries |
| Supabase Auth | High | Replace mock login with real authentication |

### Phase 3: Advanced Features

| Feature | Priority | Description |
|:--------|:---------|:------------|
| PDF Invoice Generation | High | Branded PDF export for invoices/receipts |
| File Uploads | High | Payment receipts, chat attachments, product images |
| Real-time Chat | High | Supabase Realtime WebSocket for instant messaging |
| Report Engine | Medium | PDF/CSV export with date range and filters |
| Stock Movement Audit | Medium | Full audit trail for all inventory changes |
| Customer Detail Page | Medium | Dedicated page with purchase history and balance |
| Invoice Detail Page | Medium | Detailed view with line items and payment history |

### Phase 4: Enterprise Features

| Feature | Priority | Description |
|:--------|:---------|:------------|
| Multi-location Dashboard | Medium | Cross-territory analytics for super admin |
| SMS Notifications | Low | Automated alerts via Nigerian SMS gateway |
| WhatsApp Integration | Low | Automated invoice delivery via WhatsApp Business |
| Offline Mode | Low | PWA with offline-first data sync |
| Barcode Scanning | Low | Product lookup via camera barcode scan |
| Mobile App | Low | React Native companion for field reps |

---

## 20. Deployment Architecture

### 20.1 Target Architecture

```
+-----------------------------------+
|       Google Cloud Run            |
|  +-----------------------------+  |
|  |  Next.js 15 Container      |  |
|  |  (SSR + API Routes)        |  |
|  +-------------+--------------+  |
|                |                  |
+----------------+------------------+
                 | HTTPS
                 v
+-----------------------------------+
|       Supabase (Cloud)            |
|  +----------+  +---------------+  |
|  | PostgreSQL|  |  Auth         |  |
|  | (Database)|  |  (Sessions)   |  |
|  +----------+  +---------------+  |
|  | Storage  |  |  Realtime      |  |
|  | (Files)  |  |  (WebSocket)   |  |
|  +----------+  +---------------+  |
+-----------------------------------+
```

### 20.2 Environment Variables

| Variable | Scope | Description |
|:---------|:------|:------------|
| NEXT_PUBLIC_SUPABASE_URL | Client + Server | Supabase project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Client + Server | Public API key (RLS-protected) |
| SUPABASE_SERVICE_ROLE_KEY | Server only | Admin key (bypasses RLS, never exposed to client) |

---

## 21. Appendices

### Appendix A: File Structure

```
albion-os/
  .env.local                          Environment variables
  supabase/
    schema.sql                        Database schema (639 lines)
    seed.sql                          Seed data for development
  src/
    middleware.ts                      Auth route protection
    lib/
      types.ts                        TypeScript type definitions
      auth-context.tsx                Authentication context provider
      navigation.ts                   Role-based navigation config
      mock-data.ts                    Development mock data
      supabase/
        client.ts                     Browser-side Supabase client
        server.ts                     Server-side Supabase client
        middleware.ts                 Supabase session middleware
    components/
      layout/
        Sidebar.tsx                   Navigation sidebar
        Sidebar.module.css
        Topbar.tsx                    Page header bar
        Topbar.module.css
    app/
      layout.tsx                      Root layout
      page.tsx                        Root redirect
      globals.css                     Design system (tokens + base)
      login/
        page.tsx                      Login page
        login.module.css
      (dashboard)/
        layout.tsx                    Dashboard shell + auth guard
        dashboard/                    Role-based dashboards
        customers/                    Customer directory
        invoices/                     Invoice management
        payments/                     Payment verification
        products/                     Product catalog
        inventory/                    Inventory management
        chat/                         Internal messaging
        reports/                      Reports center
        users/                        User management
```

### Appendix B: Demo Credentials

| Role | Email | Password |
|:-----|:------|:---------|
| Super Admin | admin@albionpharma.com | AlbionTest123! |
| Sales Rep | chidi@albionpharma.com | AlbionTest123! |
| Finance Manager | ngozi@albionpharma.com | AlbionTest123! |
| Inventory Manager | tunde@albionpharma.com | AlbionTest123! |

### Appendix C: Nigerian Business Context

- **NAFDAC** — National Agency for Food and Drug Administration and Control. All pharmaceutical products require NAFDAC registration before sale.
- **VAT Rate** — 7.5% Value Added Tax (standard rate in Nigeria).
- **Currency** — Nigerian Naira (₦). All amounts displayed with thousands separators using en-NG locale.
- **States** — Nigeria has 36 states + FCT. The platform currently operates in Anambra (HQ), Lagos, Abuja (FCT), and Delta.

---

**End of Document**

*AlbionOS v1.0 — Albion Pharmaceuticals Enterprise Platform*
*Document generated: 20 June 2026*

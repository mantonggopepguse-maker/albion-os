# AlbionOS API Reference

## Overview

AlbionOS uses a centralized data-access layer (`src/lib/data-service.ts`) that
will eventually wrap Supabase queries. Every mutator returns the same shape:

```ts
interface ServiceResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}
```

---

## Invoice Operations

### `generateInvoiceNumber()`
Returns the next invoice number in the format `INV-{YEAR}-{NNN}`.

```ts
const number = generateInvoiceNumber();
// → "INV-2026-005"
```

### `createInvoice(input)`
Creates a draft invoice with 7.5% VAT.

| Field | Type | Required |
|---|---|---|
| `customer_id` | string | ✓ |
| `sales_rep_id` | string | ✓ |
| `location_id` | string | ✓ |
| `items` | `{ product_id, quantity }[]` | ✓ (>= 1) |
| `due_date` | string (ISO) | ✓ |

```ts
const { success, data, error } = createInvoice({
  customer_id: 'cust-0001-vetzone',
  sales_rep_id: 'b2c3d4e5-...',
  location_id: 'loc-0001-onitsha-hq',
  items: [{ product_id: 'prod-0001-ivermectin', quantity: 10 }],
  due_date: '2026-08-01T00:00:00.000Z',
});
```

### `transitionInvoice(invoiceId, newStatus)`
Valid status transitions:

```
draft → sent → paid
draft → sent → partial
draft → sent → overdue → paid
draft → cancelled
paid  → (terminal — no transitions out)
```

```ts
const { success } = transitionInvoice('inv-0005-draft', 'sent');
```

---

## Payment Operations

### `recordPayment(input)`

| Field | Type | Required |
|---|---|---|
| `invoice_id` | string | ✓ |
| `customer_id` | string | ✓ |
| `amount` | number | ✓ (> 0) |
| `method` | `'cash' \| 'bank_transfer'` | ✓ |
| `recorded_by` | string (user ID) | ✓ |
| `proof_url` | string \| null | Required for `bank_transfer` |
| `notes` | string \| null | |

### `approvePayment(paymentId, approvedByUserId)`
Approves a pending payment. Updates invoice status (`paid` if fully settled,
`partial` otherwise) and reduces the customer's `outstanding_balance`.

```ts
const { success } = approvePayment('pay-0004-pending', 'c3d4e5f6-...');
```

### `reconcileCash(paymentId, reconciledByUserId)`
Shortcut that approves a **cash** payment in one step (skips the separate
approval workflow). Rejects non-cash and non-pending payments.

---

## Inventory Operations

### `allocateStock(input)`
Transfers stock between locations using **FEFO** (First-Expiry-First-Out):
the earliest-expiring batch at the source is depleted first.

| Field | Type | Required |
|---|---|---|
| `product_id` | string | ✓ |
| `from_location_id` | string | ✓ |
| `to_location_id` | string | ✓ |
| `quantity` | number | ✓ (> 0) |
| `batch_number` | string | ✓ |

### `stockTake(input)`
Records a physical count and adjusts the inventory record.

| Field | Type | Required |
|---|---|---|
| `inventory_id` | string | ✓ |
| `actual_quantity` | number | ✓ (>= 0) |
| `notes` | string \| null | |

---

## Customer Operations

### `addCustomer(input)`
Creates a new customer with zero outstanding balance.

| Field | Type | Required |
|---|---|---|
| `name` | string | ✓ |
| `business_name` | string | |
| `phone` | string | |
| `email` | string \| null | |
| `address` | string | |
| `state` | string | |
| `credit_limit` | number | |
| `location_id` | string | |

### `updateCustomer(customerId, input)`
Partial update — only provided fields are modified.

---

## Product Operations

### `addProduct(input)`
Creates a new product. SKU is auto-uppercased.

| Field | Type | Required |
|---|---|---|
| `name` | string | ✓ |
| `sku` | string | ✓ (unique, auto-uppercased) |
| `nafdac_number` | string | |
| `unit_price` | number | ✓ (> 0) |
| `category` | string | |
| `description` | string \| null | |

### `updateProduct(productId, input)`
Partial update with duplicate-SKU validation.

---

## Staff (User) Operations

### `addStaffUser(input)`

| Field | Type | Required |
|---|---|---|
| `email` | string | ✓ (unique) |
| `full_name` | string | ✓ |
| `role` | `UserRole` | ✓ |
| `location_id` | string \| null | |
| `phone` | string \| null | |

### `updateStaffUser(userId, input)`
Partial update with duplicate-email check.

### `toggleUserStatus(userId)`
Toggles a user between active and inactive (suspend/restore).

---

## Data Fetchers

| Function | Returns |
|---|---|
| `getCustomers()` | `Customer[]` |
| `getProducts()` | `Product[]` |
| `getInvoices()` | `Invoice[]` |
| `findCustomerById(id)` | `Customer \| undefined` |
| `findProductById(id)` | `Product \| undefined` |
| `findLocationById(id)` | `Location \| undefined` |
| `findUserById(id)` | `User \| undefined` |

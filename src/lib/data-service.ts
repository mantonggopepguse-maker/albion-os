/**
 * @file data-service.ts — Centralised data access layer for AlbionOS
 *
 * This file is the SINGLE POINT OF ACCESS for all data operations
 * (create, read, update) across the entire application.
 *
 * **Architecture role:**
 * Every page component calls functions from this file instead of
 * importing mock data directly. This abstraction allows us to:
 *   1. Swap from mock data to Supabase with ZERO UI changes
 *   2. Centralise business logic (ID generation, validation, defaults)
 *   3. Provide a consistent { success, data?, error? } response shape
 *
 * **Current mode:** Supabase-first with in-memory mock fallback.
 * Each function tries a real Supabase query first. If Supabase is
 * unreachable or returns no data, it falls back to mock arrays so
 * the UI stays functional during development / demo.
 *
 * **Key exports:**
 * - Data fetchers: getCustomers(), getProducts(), getInvoices(), etc.
 * - Mutators: addCustomer(), createInvoice(), recordPayment(), etc.
 * - Workflow: approvePayment(), rejectPayment(), allocateStock()
 */

import { createClient } from '@/lib/supabase/client';
import type {
  Customer,
  Product,
  Invoice,
  InvoiceItem,
  Payment,
  InventoryItem,
  ChatMessage,
  User,
  UserRole,
  SalaryGrade,
  Salary,
  PayrollRun,
  Payslip,
  LeaveBalance,
  LeaveRequest,
  LeaveType,
  AttendanceLog,
  AttendanceStatus,
  EmployeeDocument,
  DocumentType,
  PerformanceTarget,
  TargetType,
  PerformanceReview,
  Patient,
  Appointment,
  Treatment,
  TreatmentMedication,
  PatientQueue,
  VetService,
} from '@/lib/types';

import {
  MOCK_CUSTOMERS,
  MOCK_PRODUCTS,
  MOCK_INVOICES,
  MOCK_PAYMENTS,
  MOCK_INVENTORY,
  MOCK_CHAT_MESSAGES,
  MOCK_USERS,
  MOCK_SALARY_GRADES,
  MOCK_SALARIES,
  MOCK_PAYROLL_RUNS,
  MOCK_PAYSLIPS,
  MOCK_LEAVE_REQUESTS,
  MOCK_LEAVE_BALANCES,
  MOCK_ATTENDANCE_LOGS,
  MOCK_EMPLOYEE_DOCUMENTS,
  MOCK_PERFORMANCE_TARGETS,
  MOCK_PERFORMANCE_REVIEWS,
  MOCK_VET_SERVICES,
  MOCK_PATIENTS,
  MOCK_APPOINTMENTS,
  MOCK_TREATMENTS,
  MOCK_TREATMENT_MEDICATIONS,
  MOCK_PATIENT_QUEUE,
  findProductById,
  findLocationById,
  findCustomerById,
  findUserById,
  findSalaryGradeById,
  getSalaryByUserId,
  getPayslipsByUserId,
  getPayslipsByPayrollRun,
  getLeaveRequestsByUserId,
  getLeaveBalancesByUserId,
  getAttendanceLogsByUserId,
  getDocumentsByUserId,
  getPerformanceTargetsByUserId,
  getPerformanceReviewsByUserId,
} from '@/lib/mock-data';

function getSupabase() {
  try {
    return createClient();
  } catch {
    const stubResult = { data: null, error: new Error('Supabase not configured') };
    const chain: any = new Proxy({}, {
      get() { return () => chain; },
    });
    chain.then = undefined;
    const stubFrom = () => {
      const q: any = new Proxy({}, {
        get(_t, prop: string) {
          if (prop === 'then') return undefined;
          if (prop === 'select') return () => q;
          if (prop === 'insert') return () => q;
          if (prop === 'update') return () => q;
          if (prop === 'delete') return () => q;
          if (prop === 'eq') return () => q;
          if (prop === 'neq') return () => q;
          if (prop === 'in') return () => q;
          if (prop === 'single') return () => stubResult;
          if (prop === 'maybeSingle') return () => stubResult;
          if (prop === 'order') return () => q;
          if (prop === 'limit') return () => q;
          if (prop === 'range') return () => q;
          if (prop === 'textSearch') return () => q;
          if (prop === 'match') return () => q;
          return () => q;
        },
      });
      return q;
    };
    return { from: stubFrom };
  }
}

/* ============================================================
   Response Types
   ============================================================
   Every mutator returns this shape so the UI can handle
   success/error consistently without try/catch boilerplate.
   ============================================================ */

interface ServiceResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/* ============================================================
   ID Generation
   ============================================================
   Generates pseudo-UUID strings for new records. In production
   these will be replaced by Supabase's uuid_generate_v4().
   ============================================================ */

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/* ============================================================
   1. CUSTOMERS
   ============================================================ */

/** Returns all customers (future: filtered by user's territory) */
export async function getCustomers(): Promise<Customer[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('customers').select('*').order('name');
  if (!error && data) return data as Customer[];
  return [...MOCK_CUSTOMERS];
}

/** Input shape for adding a new customer — omits auto-generated fields */
export interface AddCustomerInput {
  name: string;
  business_name: string;
  phone: string;
  email: string | null;
  address: string;
  state: string;
  credit_limit: number;
  location_id: string;
}

/** Creates a new customer record */
export async function addCustomer(input: AddCustomerInput): Promise<ServiceResponse<Customer>> {
  if (!input.name.trim()) return { success: false, error: 'Customer name is required' };
  if (!input.business_name.trim()) return { success: false, error: 'Business name is required' };
  if (!input.phone.trim()) return { success: false, error: 'Phone number is required' };
  if (input.credit_limit < 0) return { success: false, error: 'Credit limit cannot be negative' };

  const supabase = getSupabase();
  const { data, error } = await supabase.from('customers').insert({
    name: input.name.trim(),
    business_name: input.business_name.trim(),
    phone: input.phone.trim(),
    email: input.email?.trim() || null,
    address: input.address.trim(),
    state: input.state.trim(),
    credit_limit: input.credit_limit,
    outstanding_balance: 0,
    location_id: input.location_id,
    is_active: true,
  }).select().single();

  if (!error && data) return { success: true, data: data as Customer };

  const newCustomer: Customer = {
    id: generateId(),
    name: input.name.trim(),
    business_name: input.business_name.trim(),
    phone: input.phone.trim(),
    email: input.email?.trim() || null,
    address: input.address.trim(),
    state: input.state.trim(),
    credit_limit: input.credit_limit,
    outstanding_balance: 0,
    location_id: input.location_id,
    is_active: true,
  };
  MOCK_CUSTOMERS.push(newCustomer);
  return { success: true, data: newCustomer };
}

/* ============================================================
   2. PRODUCTS
   ============================================================ */

/** Returns all products in the catalog */
export async function getProducts(): Promise<Product[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('products').select('*').order('name');
  if (!error && data) return data as Product[];
  return [...MOCK_PRODUCTS];
}

/** Input shape for adding a new product */
export interface AddProductInput {
  name: string;
  sku: string;
  nafdac_number: string;
  unit_price: number;
  category: string;
  description: string | null;
}

/** Creates a new product */
export async function addProduct(input: AddProductInput): Promise<ServiceResponse<Product>> {
  if (!input.name.trim()) return { success: false, error: 'Product name is required' };
  if (!input.sku.trim()) return { success: false, error: 'SKU is required' };
  if (input.unit_price <= 0) return { success: false, error: 'Unit price must be greater than 0' };

  const supabase = getSupabase();
  const { data, error } = await supabase.from('products').insert({
    name: input.name.trim(),
    sku: input.sku.trim().toUpperCase(),
    nafdac_number: input.nafdac_number.trim(),
    unit_price: input.unit_price,
    category: input.category.trim(),
    description: input.description?.trim() || null,
    is_active: true,
  }).select().single();

  if (!error && data) return { success: true, data: data as Product };

  const existingSku = MOCK_PRODUCTS.find(
    (p) => p.sku.toLowerCase() === input.sku.trim().toLowerCase()
  );
  if (existingSku) return { success: false, error: `SKU "${input.sku}" already exists` };

  const newProduct: Product = {
    id: generateId(),
    name: input.name.trim(),
    sku: input.sku.trim().toUpperCase(),
    nafdac_number: input.nafdac_number.trim(),
    unit_price: input.unit_price,
    category: input.category.trim(),
    description: input.description?.trim() || null,
    image_url: null,
    created_at: new Date().toISOString(),
    is_active: true,
  };
  MOCK_PRODUCTS.push(newProduct);
  return { success: true, data: newProduct };
}

/* ============================================================
   3. INVOICES
   ============================================================ */

/** Returns all invoices */
export async function getInvoices(): Promise<Invoice[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('invoices').select('*').order('created_at', { ascending: false });
  if (!error && data) return data as Invoice[];
  return [...MOCK_INVOICES];
}

/** Input shape for a single line item when creating an invoice */
export interface InvoiceLineInput {
  product_id: string;
  quantity: number;
}

/** Input shape for creating a new invoice */
export interface CreateInvoiceInput {
  customer_id: string;
  sales_rep_id: string;
  location_id: string;
  items: InvoiceLineInput[];
  due_date: string;
}

/** Creates a new invoice with auto-calculated totals */
export async function createInvoice(input: CreateInvoiceInput): Promise<ServiceResponse<Invoice>> {
  if (!input.customer_id) return { success: false, error: 'Please select a customer' };
  if (!input.items.length) return { success: false, error: 'Add at least one line item' };
  if (!input.due_date) return { success: false, error: 'Due date is required' };

  const invoiceItems: InvoiceItem[] = [];
  for (const item of input.items) {
    const product = findProductById(item.product_id);
    if (!product) return { success: false, error: `Product not found: ${item.product_id}` };
    if (item.quantity <= 0) return { success: false, error: `Quantity must be > 0 for ${product.name}` };
    invoiceItems.push({
      id: generateId(),
      product_id: product.id,
      product_name: product.name,
      quantity: item.quantity,
      unit_price: product.unit_price,
      total: product.unit_price * item.quantity,
    });
  }

  const subtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);
  const vat = Math.round(subtotal * 0.075);
  const total = subtotal + vat;

  const year = new Date().getFullYear();
  const existing = MOCK_INVOICES.filter((i) => i.invoice_number.includes(`INV-${year}`));
  const nextNum = String(existing.length + 1).padStart(3, '0');
  const invoiceNumber = `INV-${year}-${nextNum}`;

  const supabase = getSupabase();
  const { data, error } = await supabase.from('invoices').insert({
    invoice_number: invoiceNumber,
    customer_id: input.customer_id,
    sales_rep_id: input.sales_rep_id,
    location_id: input.location_id,
    subtotal,
    vat,
    total,
    status: 'draft',
    due_date: input.due_date,
  }).select().single();

  if (!error && data) return { success: true, data: data as Invoice };

  const newInvoice: Invoice = {
    id: generateId(),
    invoice_number: invoiceNumber,
    customer_id: input.customer_id,
    sales_rep_id: input.sales_rep_id,
    location_id: input.location_id,
    items: invoiceItems,
    subtotal,
    vat,
    total,
    status: 'draft',
    created_at: new Date().toISOString(),
    due_date: input.due_date,
  };
  MOCK_INVOICES.push(newInvoice);
  return { success: true, data: newInvoice };
}

/**
 * Generates the next sequential invoice number for the current year.
 * Format: INV-{YYYY}-{NNN}
 */
export function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const existing = MOCK_INVOICES.filter((i) => i.invoice_number.includes(`INV-${year}`));
  const nextNum = String(existing.length + 1).padStart(3, '0');
  return `INV-${year}-${nextNum}`;
}

/** Valid invoice status transitions map */
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['partial', 'paid', 'overdue', 'cancelled'],
  partial: ['paid', 'overdue', 'cancelled'],
  paid: [],
  overdue: ['paid', 'cancelled'],
};

/**
 * Transitions an invoice to a new status with stock deduction on finalization.
 */
export async function transitionInvoice(invoiceId: string, newStatus: string): Promise<ServiceResponse> {
  const supabase = getSupabase();
  const { data: invData } = await supabase.from('invoices').select('*').eq('id', invoiceId).single();
  const currentStatus = invData ? (invData as any).status : undefined;
  let invoice = invData ? (invData as Invoice) : MOCK_INVOICES.find((i) => i.id === invoiceId);
  if (!invoice) return { success: false, error: 'Invoice not found' };
  const allowed = VALID_TRANSITIONS[currentStatus || invoice.status];
  if (!allowed || !allowed.includes(newStatus)) {
    return { success: false, error: `Cannot transition from ${currentStatus || invoice.status} to ${newStatus}` };
  }

  if ((currentStatus || invoice.status) === 'draft' && newStatus === 'sent') {
    for (const item of (invoice as Invoice).items || []) {
      const locationItems = MOCK_INVENTORY.filter(
        (i) => i.product_id === item.product_id && i.location_id === (invoice as Invoice).location_id
      );
      let toDeduct = item.quantity;
      for (const li of locationItems) {
        if (toDeduct <= 0) break;
        const taken = Math.min(li.quantity, toDeduct);
        li.quantity -= taken;
        toDeduct -= taken;
        if (li.quantity === 0) li.status = 'out_of_stock' as const;
        else if (li.quantity <= 50) li.status = 'low_stock' as const;
      }
    }
  }

  if (invData) {
    await supabase.from('invoices').update({ status: newStatus }).eq('id', invoiceId);
  }
  if (!invData) {
    const mockInv = MOCK_INVOICES.find((i) => i.id === invoiceId);
    if (mockInv) mockInv.status = newStatus as typeof mockInv.status;
  }
  return { success: true };
}

/* ============================================================
   4. PAYMENTS
   ============================================================ */

/** Returns all payments */
export async function getPayments(): Promise<Payment[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('payments').select('*').order('created_at', { ascending: false });
  if (!error && data) return data as Payment[];
  return [...MOCK_PAYMENTS];
}

/** Input shape for recording a new payment */
export interface RecordPaymentInput {
  invoice_id: string;
  customer_id: string;
  amount: number;
  method: 'cash' | 'bank_transfer';
  recorded_by: string;
  proof_url?: string | null;
  notes: string | null;
}

/** Records a new payment in 'pending' status for finance verification */
export async function recordPayment(input: RecordPaymentInput): Promise<ServiceResponse<Payment>> {
  if (!input.customer_id) return { success: false, error: 'Please select a customer' };
  if (input.amount <= 0) return { success: false, error: 'Amount must be greater than 0' };
  if (!input.method) return { success: false, error: 'Please select a payment method' };
  if (input.method === 'bank_transfer' && !input.proof_url) {
    return { success: false, error: 'Bank transfer requires a receipt upload' };
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.from('payments').insert({
    invoice_id: input.invoice_id,
    customer_id: input.customer_id,
    amount: input.amount,
    method: input.method,
    proof_url: input.proof_url || null,
    status: 'pending',
    recorded_by: input.recorded_by,
    approved_by: null,
    notes: input.notes?.trim() || null,
  }).select().single();

  if (!error && data) return { success: true, data: data as Payment };

  const newPayment: Payment = {
    id: generateId(),
    invoice_id: input.invoice_id,
    customer_id: input.customer_id,
    amount: input.amount,
    method: input.method,
    proof_url: input.proof_url || null,
    status: 'pending',
    recorded_by: input.recorded_by,
    approved_by: null,
    notes: input.notes?.trim() || null,
    created_at: new Date().toISOString(),
  };
  MOCK_PAYMENTS.push(newPayment);
  return { success: true, data: newPayment };
}

/** Reconcile cash — marks a cash payment as received by finance */
export async function reconcileCash(paymentId: string, approvedBy: string): Promise<ServiceResponse> {
  const supabase = getSupabase();
  const { data: pmt } = await supabase.from('payments').select('*').eq('id', paymentId).single();
  const payment = pmt ? (pmt as Payment) : MOCK_PAYMENTS.find((p) => p.id === paymentId);
  if (!payment) return { success: false, error: 'Payment not found' };
  if (payment.status !== 'pending') return { success: false, error: 'Payment is not pending' };
  if (payment.method !== 'cash') return { success: false, error: 'Only cash payments can be reconciled' };
  return approvePayment(paymentId, approvedBy);
}

/** Approves a pending payment — updates payment, invoice status, and customer balance */
export async function approvePayment(paymentId: string, approvedBy: string): Promise<ServiceResponse> {
  let payment: Payment | undefined;
  const supabase = getSupabase();
  const { data: pmt } = await supabase.from('payments').select('*').eq('id', paymentId).single();
  payment = pmt ? (pmt as Payment) : MOCK_PAYMENTS.find((p) => p.id === paymentId);
  if (!payment) return { success: false, error: 'Payment not found' };
  if (payment.status !== 'pending') return { success: false, error: 'Payment is not pending' };

  if (payment.invoice_id) {
    let invoice = MOCK_INVOICES.find((i) => i.id === payment.invoice_id);
    if (!invoice) return { success: false, error: 'Linked invoice not found' };

    const approvedTotal = MOCK_PAYMENTS
      .filter((p) => p.invoice_id === payment?.invoice_id && p.status === 'approved')
      .reduce((sum, p) => sum + p.amount, 0);

    const newPaid = approvedTotal + payment.amount;
    if (newPaid > invoice.total) {
      return { success: false, error: `Payment exceeds remaining invoice balance. Max allowed: ₦${(invoice.total - approvedTotal).toLocaleString('en-NG')}` };
    }

    if (newPaid >= invoice.total) {
      invoice.status = 'paid';
    } else {
      invoice.status = 'partial';
    }

    const customer = MOCK_CUSTOMERS.find((c) => c.id === payment.customer_id);
    if (customer) {
      customer.outstanding_balance = Math.max(0, customer.outstanding_balance - payment.amount);
    }
  }

  if (pmt) {
    await supabase.from('payments').update({ status: 'approved', approved_by: approvedBy }).eq('id', paymentId);
  }
  if (!pmt) {
    const mockPmt = MOCK_PAYMENTS.find((p) => p.id === paymentId);
    if (mockPmt) { mockPmt.status = 'approved'; mockPmt.approved_by = approvedBy; }
  }
  return { success: true };
}

/** Rejects a pending payment */
export async function rejectPayment(paymentId: string, approvedBy: string, reason: string): Promise<ServiceResponse> {
  const supabase = getSupabase();
  const { data: pmt } = await supabase.from('payments').select('*').eq('id', paymentId).single();
  const payment = pmt ? (pmt as Payment) : MOCK_PAYMENTS.find((p) => p.id === paymentId);
  if (!payment) return { success: false, error: 'Payment not found' };
  if (payment.status !== 'pending') return { success: false, error: 'Payment is not pending' };

  if (pmt) {
    await supabase.from('payments').update({ status: 'rejected', approved_by: approvedBy, notes: reason || 'Rejected by finance' }).eq('id', paymentId);
  }
  if (!pmt) {
    const mockPmt = MOCK_PAYMENTS.find((p) => p.id === paymentId);
    if (mockPmt) { mockPmt.status = 'rejected'; mockPmt.approved_by = approvedBy; mockPmt.notes = reason || 'Rejected by finance'; }
  }
  return { success: true };
}

/* ============================================================
   5. INVENTORY
   ============================================================ */

/** Returns all inventory items */
export async function getInventory(): Promise<InventoryItem[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('inventory').select('*').order('expiry_date');
  if (!error && data) return data as InventoryItem[];
  return [...MOCK_INVENTORY];
}

/** Input shape for allocating stock from warehouse to a territory */
export interface AllocateStockInput {
  product_id: string;
  from_location_id: string;
  to_location_id: string;
  quantity: number;
  batch_number: string;
}

/**
 * Allocates stock from one location (warehouse) to another (territory)
 * using FEFO (First-Expiry-First-Out) principle.
 */
export async function allocateStock(input: AllocateStockInput): Promise<ServiceResponse> {
  if (!input.product_id) return { success: false, error: 'Please select a product' };
  if (!input.to_location_id) return { success: false, error: 'Please select a destination' };
  if (input.quantity <= 0) return { success: false, error: 'Quantity must be greater than 0' };

  const sourceBatches = MOCK_INVENTORY
    .filter((i) => i.product_id === input.product_id && i.location_id === input.from_location_id && i.quantity > 0)
    .sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());

  if (sourceBatches.length === 0) return { success: false, error: 'No stock found for this product at the source location' };

  const totalAvailable = sourceBatches.reduce((sum, b) => sum + b.quantity, 0);
  if (totalAvailable < input.quantity) {
    return { success: false, error: `Insufficient stock. Available: ${totalAvailable} units across ${sourceBatches.length} batch(es)` };
  }

  let toDeduct = input.quantity;
  let lastExpiry = '';
  for (const batch of sourceBatches) {
    if (toDeduct <= 0) break;
    const taken = Math.min(batch.quantity, toDeduct);
    batch.quantity -= taken;
    toDeduct -= taken;
    if (batch.quantity === 0) batch.status = 'out_of_stock';
    else if (batch.quantity <= 50) batch.status = 'low_stock';
    lastExpiry = batch.expiry_date;
  }

  const supabase = getSupabase();
  await supabase.from('inventory').insert({
    product_id: input.product_id,
    location_id: input.to_location_id,
    quantity: input.quantity,
    batch_number: `ALLOC-${new Date().toISOString().slice(0, 10)}`,
    expiry_date: lastExpiry,
    status: 'in_stock',
  });

  MOCK_INVENTORY.push({
    id: generateId(),
    product_id: input.product_id,
    location_id: input.to_location_id,
    quantity: input.quantity,
    batch_number: `ALLOC-${new Date().toISOString().slice(0, 10)}`,
    expiry_date: lastExpiry,
    status: 'in_stock',
  });
  return { success: true };
}

/** Input shape for a manual stock take adjustment */
export interface StockTakeInput {
  inventory_id: string;
  actual_quantity: number;
  notes?: string;
}

/** Performs a manual stock take — adjusts quantity and logs the movement */
export async function stockTake(input: StockTakeInput): Promise<ServiceResponse<{ item: InventoryItem; difference: number; notes?: string }>> {
  const supabase = getSupabase();
  const { data: invData } = await supabase.from('inventory').select('*').eq('id', input.inventory_id).single();
  const item = invData ? (invData as InventoryItem) : MOCK_INVENTORY.find((i) => i.id === input.inventory_id);
  if (!item) return { success: false, error: 'Inventory item not found' };
  if (input.actual_quantity < 0) return { success: false, error: 'Quantity cannot be negative' };

  const difference = input.actual_quantity - item.quantity;
  item.quantity = input.actual_quantity;
  item.status = input.actual_quantity === 0 ? 'out_of_stock' : input.actual_quantity <= 50 ? 'low_stock' : 'in_stock';

  if (invData) {
    await supabase.from('inventory').update({ quantity: input.actual_quantity, status: item.status }).eq('id', input.inventory_id);
  }
  return { success: true, data: { item, difference, notes: input.notes } };
}

/* ============================================================
   6. CHAT MESSAGES
   ============================================================ */

/** Returns all chat messages */
export async function getChatMessages(): Promise<ChatMessage[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('chat_messages').select('*').order('created_at');
  if (!error && data) return data as ChatMessage[];
  return [...MOCK_CHAT_MESSAGES];
}

/** Sends a new chat message (with optional attachment) */
export async function sendChatMessage(
  senderId: string,
  receiverId: string,
  content: string,
  attachment?: { url: string; type: string }
): Promise<ServiceResponse<ChatMessage>> {
  if (!content.trim() && !attachment) return { success: false, error: 'Message or attachment required' };

  const supabase = getSupabase();
  const { data, error } = await supabase.from('chat_messages').insert({
    sender_id: senderId,
    receiver_id: receiverId,
    content: content.trim(),
    attachment_url: attachment?.url || null,
    attachment_type: attachment?.type || null,
    is_read: false,
  }).select().single();

  if (!error && data) return { success: true, data: data as ChatMessage };

  const newMessage: ChatMessage = {
    id: generateId(),
    sender_id: senderId,
    receiver_id: receiverId,
    content: content.trim(),
    attachment_url: attachment?.url || null,
    attachment_type: attachment?.type || null,
    is_read: false,
    created_at: new Date().toISOString(),
  };
  MOCK_CHAT_MESSAGES.push(newMessage);
  return { success: true, data: newMessage };
}

/* ============================================================
   7. STAFF / USER MANAGEMENT
   ============================================================ */

/** Input shape for adding a new staff member */
export interface AddStaffUserInput {
  email: string;
  full_name: string;
  role: UserRole;
  location_id: string | null;
  phone: string | null;
}

/** Creates a new staff user record */
export async function addStaffUser(input: AddStaffUserInput): Promise<ServiceResponse<User>> {
  if (!input.email.trim()) return { success: false, error: 'Email is required' };
  if (!input.full_name.trim()) return { success: false, error: 'Full name is required' };
  if (!input.role) return { success: false, error: 'Role is required' };

  const supabase = getSupabase();
  const { data, error } = await supabase.from('profiles').insert({
    email: input.email.trim().toLowerCase(),
    full_name: input.full_name.trim(),
    role: input.role,
    location_id: input.location_id || null,
    phone: input.phone?.trim() || null,
    is_active: true,
  }).select().single();

  if (!error && data) return { success: true, data: data as User };

  const existing = MOCK_USERS.find(
    (u) => u.email.toLowerCase() === input.email.trim().toLowerCase()
  );
  if (existing) return { success: false, error: 'A user with this email already exists' };

  const newUser: User = {
    id: generateId(),
    email: input.email.trim().toLowerCase(),
    full_name: input.full_name.trim(),
    role: input.role,
    location_id: input.location_id || null,
    avatar_url: null,
    phone: input.phone?.trim() || null,
    created_at: new Date().toISOString(),
    is_active: true,
  };
  MOCK_USERS.push(newUser);
  return { success: true, data: newUser };
}

/** Toggles a user's active status (suspend / restore) */
export async function toggleUserStatus(userId: string): Promise<ServiceResponse<User>> {
  const supabase = getSupabase();
  const { data: userData } = await supabase.from('profiles').select('*').eq('id', userId).single();
  const user = userData ? (userData as User) : MOCK_USERS.find((u) => u.id === userId);
  if (!user) return { success: false, error: 'User not found' };
  user.is_active = !user.is_active;
  if (userData) {
    await supabase.from('profiles').update({ is_active: user.is_active }).eq('id', userId);
  }
  return { success: true, data: user };
}

/** Updates an existing staff user's profile fields */
export async function updateStaffUser(userId: string, input: Partial<AddStaffUserInput>): Promise<ServiceResponse<User>> {
  const supabase = getSupabase();
  const { data: userData } = await supabase.from('profiles').select('*').eq('id', userId).single();
  const user = userData ? (userData as User) : MOCK_USERS.find((u) => u.id === userId);
  if (!user) return { success: false, error: 'User not found' };

  if (userData) {
    const updates: Record<string, any> = {};
    if (input.full_name !== undefined) updates.full_name = input.full_name.trim();
    if (input.email !== undefined) updates.email = input.email.trim().toLowerCase();
    if (input.role !== undefined) updates.role = input.role;
    if (input.location_id !== undefined) updates.location_id = input.location_id || null;
    if (input.phone !== undefined) updates.phone = input.phone?.trim() || null;
    await supabase.from('profiles').update(updates).eq('id', userId);
  }

  if (input.full_name !== undefined) user.full_name = input.full_name.trim();
  if (input.email !== undefined) {
    const duplicate = MOCK_USERS.find((u) => u.email.toLowerCase() === input.email!.trim().toLowerCase() && u.id !== userId);
    if (duplicate) return { success: false, error: 'A user with this email already exists' };
    user.email = input.email.trim().toLowerCase();
  }
  if (input.role !== undefined) user.role = input.role;
  if (input.location_id !== undefined) user.location_id = input.location_id || null;
  if (input.phone !== undefined) user.phone = input.phone?.trim() || null;
  return { success: true, data: user };
}

/* ============================================================
   8. CUSTOMER UPDATES
   ============================================================ */

/** Input shape for updating a customer */
export interface UpdateCustomerInput {
  name?: string;
  business_name?: string;
  phone?: string;
  email?: string | null;
  address?: string;
  state?: string;
  credit_limit?: number;
  location_id?: string;
}

/** Updates an existing customer record */
export async function updateCustomer(customerId: string, input: UpdateCustomerInput): Promise<ServiceResponse<Customer>> {
  const supabase = getSupabase();
  const { data: custData } = await supabase.from('customers').select('*').eq('id', customerId).single();
  const customer = custData ? (custData as Customer) : MOCK_CUSTOMERS.find((c) => c.id === customerId);
  if (!customer) return { success: false, error: 'Customer not found' };

  if (custData) {
    const updates: Record<string, any> = {};
    if (input.name !== undefined) updates.name = input.name.trim();
    if (input.business_name !== undefined) updates.business_name = input.business_name.trim();
    if (input.phone !== undefined) updates.phone = input.phone.trim();
    if (input.email !== undefined) updates.email = input.email?.trim() || null;
    if (input.address !== undefined) updates.address = input.address.trim();
    if (input.state !== undefined) updates.state = input.state.trim();
    if (input.credit_limit !== undefined) updates.credit_limit = input.credit_limit;
    if (input.location_id !== undefined) updates.location_id = input.location_id;
    await supabase.from('customers').update(updates).eq('id', customerId);
  }

  if (input.name !== undefined) customer.name = input.name.trim();
  if (input.business_name !== undefined) customer.business_name = input.business_name.trim();
  if (input.phone !== undefined) customer.phone = input.phone.trim();
  if (input.email !== undefined) customer.email = input.email?.trim() || null;
  if (input.address !== undefined) customer.address = input.address.trim();
  if (input.state !== undefined) customer.state = input.state.trim();
  if (input.credit_limit !== undefined) customer.credit_limit = input.credit_limit;
  if (input.location_id !== undefined) customer.location_id = input.location_id;
  return { success: true, data: customer };
}

/* ============================================================
   9. PRODUCT UPDATES
   ============================================================ */

/** Input shape for updating a product */
export interface UpdateProductInput {
  name?: string;
  sku?: string;
  nafdac_number?: string;
  unit_price?: number;
  category?: string;
  description?: string | null;
}

/** Updates an existing product record */
export async function updateProduct(productId: string, input: UpdateProductInput): Promise<ServiceResponse<Product>> {
  const supabase = getSupabase();
  const { data: prodData } = await supabase.from('products').select('*').eq('id', productId).single();
  const product = prodData ? (prodData as Product) : MOCK_PRODUCTS.find((p) => p.id === productId);
  if (!product) return { success: false, error: 'Product not found' };

  if (prodData) {
    const updates: Record<string, any> = {};
    if (input.name !== undefined) updates.name = input.name.trim();
    if (input.sku !== undefined) updates.sku = input.sku.trim().toUpperCase();
    if (input.nafdac_number !== undefined) updates.nafdac_number = input.nafdac_number.trim();
    if (input.unit_price !== undefined) updates.unit_price = input.unit_price;
    if (input.category !== undefined) updates.category = input.category.trim();
    if (input.description !== undefined) updates.description = input.description?.trim() || null;
    await supabase.from('products').update(updates).eq('id', productId);
  }

  if (input.name !== undefined) product.name = input.name.trim();
  if (input.sku !== undefined) {
    const dup = MOCK_PRODUCTS.find((p) => p.sku.toLowerCase() === input.sku!.trim().toLowerCase() && p.id !== productId);
    if (dup) return { success: false, error: `SKU "${input.sku}" already exists` };
    product.sku = input.sku.trim().toUpperCase();
  }
  if (input.nafdac_number !== undefined) product.nafdac_number = input.nafdac_number.trim();
  if (input.unit_price !== undefined) product.unit_price = input.unit_price;
  if (input.category !== undefined) product.category = input.category.trim();
  if (input.description !== undefined) product.description = input.description?.trim() || null;
  return { success: true, data: product };
}

/* ============================================================
   10. STAFF & SALARY MANAGEMENT — Salary Grades
   ============================================================ */

/** Returns all salary grades */
export async function getSalaryGrades(): Promise<SalaryGrade[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('salary_grades').select('*').order('grade');
  if (!error && data) return data as SalaryGrade[];
  return [...MOCK_SALARY_GRADES];
}

/** Input for creating/updating a salary grade */
export interface AddSalaryGradeInput {
  grade: string;
  min_salary: number;
  max_salary: number;
  housing_allowance_pct: number;
  transport_allowance_pct: number;
  medical_allowance_pct: number;
}

/** Creates a new salary grade */
export async function addSalaryGrade(input: AddSalaryGradeInput): Promise<ServiceResponse<SalaryGrade>> {
  if (!input.grade.trim()) return { success: false, error: 'Grade name is required' };
  if (input.min_salary <= 0) return { success: false, error: 'Minimum salary must be greater than 0' };
  if (input.max_salary <= input.min_salary) return { success: false, error: 'Maximum salary must exceed minimum salary' };

  const supabase = getSupabase();
  const { data, error } = await supabase.from('salary_grades').insert({
    grade: input.grade.trim(),
    min_salary: input.min_salary,
    max_salary: input.max_salary,
    housing_allowance_pct: input.housing_allowance_pct,
    transport_allowance_pct: input.transport_allowance_pct,
    medical_allowance_pct: input.medical_allowance_pct,
  }).select().single();

  if (!error && data) return { success: true, data: data as SalaryGrade };

  const duplicate = MOCK_SALARY_GRADES.find((sg) => sg.grade.toLowerCase() === input.grade.trim().toLowerCase());
  if (duplicate) return { success: false, error: `Grade "${input.grade}" already exists` };

  const newGrade: SalaryGrade = {
    id: generateId(),
    grade: input.grade.trim(),
    min_salary: input.min_salary,
    max_salary: input.max_salary,
    housing_allowance_pct: input.housing_allowance_pct,
    transport_allowance_pct: input.transport_allowance_pct,
    medical_allowance_pct: input.medical_allowance_pct,
    created_at: new Date().toISOString(),
  };
  MOCK_SALARY_GRADES.push(newGrade);
  return { success: true, data: newGrade };
}

/* ============================================================
   11. STAFF & SALARY MANAGEMENT — Salaries
   ============================================================ */

/** Returns all salary records */
export async function getSalaries(): Promise<Salary[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('salaries').select('*');
  if (!error && data) return data as Salary[];
  return [...MOCK_SALARIES];
}

/** Returns the active salary for a specific user */
export function getSalaryForUser(userId: string): Salary | undefined {
  return MOCK_SALARIES.find((s) => s.user_id === userId && s.is_active);
}

/** Input for assigning/updating a salary */
export interface AssignSalaryInput {
  user_id: string;
  salary_grade_id: string;
  basic_salary: number;
  effective_date: string;
}

/** Calculates allowances based on salary grade percentages */
function calculateAllowances(basicSalary: number, gradeId: string): { housing: number; transport: number; medical: number } {
  const grade = MOCK_SALARY_GRADES.find((sg) => sg.id === gradeId);
  if (!grade) return { housing: 0, transport: 0, medical: 0 };
  return {
    housing: Math.round(basicSalary * (grade.housing_allowance_pct / 100)),
    transport: Math.round(basicSalary * (grade.transport_allowance_pct / 100)),
    medical: Math.round(basicSalary * (grade.medical_allowance_pct / 100)),
  };
}

/** Nigerian PAYE tax calculation (simplified progressive) */
function calculatePAYE(grossPay: number): number {
  if (grossPay <= 300000) return 0;
  if (grossPay <= 600000) return Math.round(grossPay * 0.07);
  if (grossPay <= 1100000) return Math.round(grossPay * 0.11);
  if (grossPay <= 1600000) return Math.round(grossPay * 0.15);
  if (grossPay <= 3200000) return Math.round(grossPay * 0.19);
  return Math.round(grossPay * 0.24);
}

/** Assigns a salary to a user with auto-calculated allowances and deductions */
export async function assignSalary(input: AssignSalaryInput): Promise<ServiceResponse<Salary>> {
  if (!input.user_id) return { success: false, error: 'User is required' };
  if (!input.salary_grade_id) return { success: false, error: 'Salary grade is required' };
  if (input.basic_salary <= 0) return { success: false, error: 'Basic salary must be greater than 0' };

  const user = MOCK_USERS.find((u) => u.id === input.user_id);
  if (!user) return { success: false, error: 'User not found' };

  const grade = MOCK_SALARY_GRADES.find((sg) => sg.id === input.salary_grade_id);
  if (!grade) return { success: false, error: 'Salary grade not found' };

  MOCK_SALARIES.forEach((s) => {
    if (s.user_id === input.user_id && s.is_active) s.is_active = false;
  });

  const allowances = calculateAllowances(input.basic_salary, input.salary_grade_id);
  const totalGross = input.basic_salary + allowances.housing + allowances.transport + allowances.medical;
  const taxRate = 7.5;
  const pensionRate = 8.0;
  const nhisRate = 2.5;
  const payeTax = calculatePAYE(totalGross);
  const pensionDed = Math.round(totalGross * (pensionRate / 100));
  const nhisDed = Math.round(totalGross * (nhisRate / 100));
  const totalDeductions = payeTax + pensionDed + nhisDed;
  const netPay = totalGross - totalDeductions;

  const supabase = getSupabase();
  const { data, error } = await supabase.from('salaries').insert({
    user_id: input.user_id,
    salary_grade_id: input.salary_grade_id,
    basic_salary: input.basic_salary,
    housing_allowance: allowances.housing,
    transport_allowance: allowances.transport,
    medical_allowance: allowances.medical,
    total_gross: totalGross,
    tax_rate: taxRate,
    pension_rate: pensionRate,
    nhis_rate: nhisRate,
    total_deductions: totalDeductions,
    net_pay: netPay,
    effective_date: input.effective_date,
    is_active: true,
  }).select().single();

  if (!error && data) return { success: true, data: data as Salary };

  const newSalary: Salary = {
    id: generateId(),
    user_id: input.user_id,
    salary_grade_id: input.salary_grade_id,
    basic_salary: input.basic_salary,
    housing_allowance: allowances.housing,
    transport_allowance: allowances.transport,
    medical_allowance: allowances.medical,
    total_gross: totalGross,
    tax_rate: taxRate,
    pension_rate: pensionRate,
    nhis_rate: nhisRate,
    total_deductions: totalDeductions,
    net_pay: netPay,
    effective_date: input.effective_date,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  MOCK_SALARIES.push(newSalary);
  return { success: true, data: newSalary };
}

/* ============================================================
   12. STAFF & SALARY MANAGEMENT — Payroll
   ============================================================ */

/** Returns all payroll runs */
export async function getPayrollRuns(): Promise<PayrollRun[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('payroll_runs').select('*').order('created_at', { ascending: false });
  if (!error && data) return data as PayrollRun[];
  return [...MOCK_PAYROLL_RUNS];
}

/** Returns a single payroll run by ID */
export function getPayrollRunById(id: string): PayrollRun | undefined {
  return MOCK_PAYROLL_RUNS.find((pr) => pr.id === id);
}

/** Returns payslips for a given payroll run */
export function getPayslipsForRun(payrollRunId: string): Payslip[] {
  return MOCK_PAYSLIPS.filter((ps) => ps.payroll_run_id === payrollRunId);
}

/** Returns payslips for a specific user */
export function getPayslipsForUser(userId: string): Payslip[] {
  return MOCK_PAYSLIPS.filter((ps) => ps.user_id === userId);
}

/** Processes payroll for all active employees for a given period */
export async function processPayroll(
  periodStart: string,
  periodEnd: string,
  paymentDate: string,
  processedBy: string
): Promise<ServiceResponse<PayrollRun>> {
  const activeSalaries = MOCK_SALARIES.filter((s) => s.is_active);
  if (activeSalaries.length === 0) return { success: false, error: 'No active salaries found to process' };

  const existingRun = MOCK_PAYROLL_RUNS.find(
    (pr) => pr.period_start === periodStart && pr.period_end === periodEnd && pr.status !== 'cancelled'
  );
  if (existingRun) return { success: false, error: `Payroll for ${periodStart} to ${periodEnd} already exists (status: ${existingRun.status})` };

  const payslips: Payslip[] = [];
  let totalGross = 0, totalDeductions = 0, totalNet = 0;

  for (const salary of activeSalaries) {
    const tg = salary.basic_salary + salary.housing_allowance + salary.transport_allowance + salary.medical_allowance;
    const payeTax = calculatePAYE(tg);
    const pensionDed = Math.round(tg * (salary.pension_rate / 100));
    const nhisDed = Math.round(tg * (salary.nhis_rate / 100));
    const td = payeTax + pensionDed + nhisDed;
    const np = tg - td;

    payslips.push({
      id: generateId(),
      payroll_run_id: '',
      user_id: salary.user_id,
      basic_salary: salary.basic_salary,
      housing_allowance: salary.housing_allowance,
      transport_allowance: salary.transport_allowance,
      medical_allowance: salary.medical_allowance,
      gross_pay: tg,
      paye_tax: payeTax,
      pension_deduction: pensionDed,
      nhis_deduction: nhisDed,
      total_deductions: td,
      net_pay: np,
      created_at: new Date().toISOString(),
    });
    totalGross += tg;
    totalDeductions += td;
    totalNet += np;
  }

  const supabase = getSupabase();
  const { data: prData, error } = await supabase.from('payroll_runs').insert({
    period_start: periodStart,
    period_end: periodEnd,
    payment_date: paymentDate,
    status: 'completed',
    total_gross: totalGross,
    total_deductions: totalDeductions,
    total_net: totalNet,
    employee_count: payslips.length,
    processed_by: processedBy,
  }).select().single();

  if (!error && prData) {
    const runId = (prData as any).id;
    for (const ps of payslips) {
      await supabase.from('payslips').insert({ ...ps, id: undefined, payroll_run_id: runId, created_at: new Date().toISOString() });
    }
    return { success: true, data: prData as PayrollRun };
  }

  const payrollRun: PayrollRun = {
    id: generateId(),
    period_start: periodStart,
    period_end: periodEnd,
    payment_date: paymentDate,
    status: 'completed',
    total_gross: totalGross,
    total_deductions: totalDeductions,
    total_net: totalNet,
    employee_count: payslips.length,
    processed_by: processedBy,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  for (const ps of payslips) { ps.payroll_run_id = payrollRun.id; }
  MOCK_PAYROLL_RUNS.push(payrollRun);
  MOCK_PAYSLIPS.push(...payslips);
  return { success: true, data: payrollRun };
}

/* ============================================================
   13. STAFF & SALARY MANAGEMENT — Leave Requests
   ============================================================ */

/** Returns all leave requests */
export async function getLeaveRequests(): Promise<LeaveRequest[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('leave_requests').select('*').order('created_at', { ascending: false });
  if (!error && data) return data as LeaveRequest[];
  return [...MOCK_LEAVE_REQUESTS];
}

/** Returns leave requests for a specific user */
export function getLeaveRequestsForUser(userId: string): LeaveRequest[] {
  return MOCK_LEAVE_REQUESTS.filter((lr) => lr.user_id === userId);
}

/** Returns leave balances for a specific user */
export function getLeaveBalancesForUser(userId: string): LeaveBalance[] {
  return MOCK_LEAVE_BALANCES.filter((lb) => lb.user_id === userId);
}

/** Input for submitting a leave request */
export interface SubmitLeaveInput {
  user_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string;
}

/** Submits a new leave request */
export async function submitLeaveRequest(input: SubmitLeaveInput): Promise<ServiceResponse<LeaveRequest>> {
  if (!input.leave_type) return { success: false, error: 'Leave type is required' };
  if (!input.start_date) return { success: false, error: 'Start date is required' };
  if (!input.end_date) return { success: false, error: 'End date is required' };

  const start = new Date(input.start_date);
  const end = new Date(input.end_date);
  if (end < start) return { success: false, error: 'End date must be after start date' };

  const diffTime = Math.abs(end.getTime() - start.getTime());
  const durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  const year = start.getFullYear();
  const balance = MOCK_LEAVE_BALANCES.find(
    (lb) => lb.user_id === input.user_id && lb.leave_type === input.leave_type && lb.year === year
  );
  if (balance && durationDays > balance.remaining_days) {
    return { success: false, error: `Insufficient leave balance. Only ${balance.remaining_days} ${input.leave_type} day(s) remaining.` };
  }

  const overlapping = MOCK_LEAVE_REQUESTS.find((lr) => {
    if (lr.user_id !== input.user_id || lr.status === 'cancelled') return false;
    const lrStart = new Date(lr.start_date);
    const lrEnd = new Date(lr.end_date);
    return start <= lrEnd && end >= lrStart;
  });
  if (overlapping) return { success: false, error: 'You already have a leave request overlapping with these dates' };

  const supabase = getSupabase();
  const { data, error } = await supabase.from('leave_requests').insert({
    user_id: input.user_id,
    leave_type: input.leave_type,
    start_date: input.start_date,
    end_date: input.end_date,
    duration_days: durationDays,
    reason: input.reason.trim(),
    status: 'pending',
  }).select().single();

  if (!error && data) return { success: true, data: data as LeaveRequest };

  const newRequest: LeaveRequest = {
    id: generateId(),
    user_id: input.user_id,
    leave_type: input.leave_type,
    start_date: input.start_date,
    end_date: input.end_date,
    duration_days: durationDays,
    reason: input.reason.trim(),
    status: 'pending',
    approved_by: null,
    reviewed_at: null,
    reviewer_notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  MOCK_LEAVE_REQUESTS.push(newRequest);
  return { success: true, data: newRequest };
}

/** Approves or rejects a leave request */
export async function reviewLeaveRequest(
  leaveRequestId: string,
  reviewerId: string,
  newStatus: 'approved' | 'rejected',
  reviewerNotes?: string
): Promise<ServiceResponse<LeaveRequest>> {
  const supabase = getSupabase();
  const { data: lrData } = await supabase.from('leave_requests').select('*').eq('id', leaveRequestId).single();
  const leaveRequest = lrData ? (lrData as LeaveRequest) : MOCK_LEAVE_REQUESTS.find((lr) => lr.id === leaveRequestId);
  if (!leaveRequest) return { success: false, error: 'Leave request not found' };
  if (leaveRequest.status !== 'pending') return { success: false, error: `Leave request is already ${leaveRequest.status}` };

  if (lrData) {
    await supabase.from('leave_requests').update({
      status: newStatus,
      approved_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: reviewerNotes?.trim() || null,
    }).eq('id', leaveRequestId);
  }

  leaveRequest.status = newStatus;
  leaveRequest.approved_by = reviewerId;
  leaveRequest.reviewed_at = new Date().toISOString();
  leaveRequest.reviewer_notes = reviewerNotes?.trim() || null;
  leaveRequest.updated_at = new Date().toISOString();

  if (newStatus === 'approved') {
    const year = new Date(leaveRequest.start_date).getFullYear();
    const balance = MOCK_LEAVE_BALANCES.find(
      (lb) => lb.user_id === leaveRequest.user_id && lb.leave_type === leaveRequest.leave_type && lb.year === year
    );
    if (balance) {
      balance.used_days += leaveRequest.duration_days;
      balance.updated_at = new Date().toISOString();
    }
  }
  return { success: true, data: leaveRequest };
}

/** Cancels a leave request (only if pending) */
export async function cancelLeaveRequest(leaveRequestId: string, userId: string): Promise<ServiceResponse<LeaveRequest>> {
  const supabase = getSupabase();
  const { data: lrData } = await supabase.from('leave_requests').select('*').eq('id', leaveRequestId).single();
  const leaveRequest = lrData ? (lrData as LeaveRequest) : MOCK_LEAVE_REQUESTS.find((lr) => lr.id === leaveRequestId);
  if (!leaveRequest) return { success: false, error: 'Leave request not found' };
  if (leaveRequest.status !== 'pending') return { success: false, error: 'Only pending requests can be cancelled' };
  if (leaveRequest.user_id !== userId) return { success: false, error: 'You can only cancel your own leave requests' };

  if (lrData) {
    await supabase.from('leave_requests').update({ status: 'cancelled' }).eq('id', leaveRequestId);
  }
  leaveRequest.status = 'cancelled';
  leaveRequest.updated_at = new Date().toISOString();
  return { success: true, data: leaveRequest };
}

/* ============================================================
   14. STAFF & SALARY MANAGEMENT — Attendance
   ============================================================ */

/** Returns all attendance logs */
export async function getAttendanceLogs(): Promise<AttendanceLog[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('attendance_logs').select('*').order('date', { ascending: false });
  if (!error && data) return data as AttendanceLog[];
  return [...MOCK_ATTENDANCE_LOGS];
}

/** Returns attendance logs for a specific user */
export function getAttendanceLogsForUser(userId: string): AttendanceLog[] {
  return MOCK_ATTENDANCE_LOGS.filter((a) => a.user_id === userId);
}

/** Returns attendance for a specific user on a specific date */
export function getAttendanceForDate(userId: string, date: string): AttendanceLog | undefined {
  return MOCK_ATTENDANCE_LOGS.find((a) => a.user_id === userId && a.date === date);
}

/** Clocks in a user for the current date */
export async function clockIn(userId: string): Promise<ServiceResponse<AttendanceLog>> {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const hour = now.getHours();
  const status: AttendanceStatus = hour > 9 ? 'late' : 'present';

  const supabase = getSupabase();
  const { data, error } = await supabase.from('attendance_logs').insert({
    user_id: userId,
    date: today,
    clock_in: now.toISOString(),
    clock_out: null,
    status,
    hours_worked: null,
    notes: null,
  }).select().single();

  if (!error && data) return { success: true, data: data as AttendanceLog };

  const existing = MOCK_ATTENDANCE_LOGS.find((a) => a.user_id === userId && a.date === today);
  if (existing) {
    if (existing.clock_in) return { success: false, error: 'Already clocked in today' };
    existing.clock_in = now.toISOString();
    existing.status = 'present';
    existing.updated_at = now.toISOString();
    return { success: true, data: existing };
  }

  const newLog: AttendanceLog = {
    id: generateId(),
    user_id: userId,
    date: today,
    clock_in: now.toISOString(),
    clock_out: null,
    status,
    hours_worked: null,
    notes: null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
  MOCK_ATTENDANCE_LOGS.push(newLog);
  return { success: true, data: newLog };
}

/** Clocks out a user for the current date */
export async function clockOut(userId: string): Promise<ServiceResponse<AttendanceLog>> {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();

  const supabase = getSupabase();
  const { data: existingData, error: findError } = await supabase.from('attendance_logs')
    .select('*').eq('user_id', userId).eq('date', today).single();

  if (!findError && existingData) {
    const log = existingData as AttendanceLog;
    if (log.clock_out) return { success: false, error: 'Already clocked out today' };
    const clockInTime = new Date(log.clock_in!).getTime();
    const endTime = now.getTime();
    const hoursWorked = Math.round(((endTime - clockInTime) / (1000 * 60 * 60)) * 100) / 100;
    await supabase.from('attendance_logs').update({
      clock_out: now.toISOString(),
      hours_worked: hoursWorked,
    }).eq('id', log.id);
    return { success: true, data: { ...log, clock_out: now.toISOString(), hours_worked: hoursWorked } as AttendanceLog };
  }

  const log = MOCK_ATTENDANCE_LOGS.find((a) => a.user_id === userId && a.date === today);
  if (!log) return { success: false, error: 'No clock-in record found for today. Please clock in first.' };
  if (log.clock_out) return { success: false, error: 'Already clocked out today' };

  log.clock_out = now.toISOString();
  log.updated_at = now.toISOString();
  if (log.clock_in) {
    const startTime = new Date(log.clock_in).getTime();
    const endTime = now.getTime();
    log.hours_worked = Math.round(((endTime - startTime) / (1000 * 60 * 60)) * 100) / 100;
  }
  return { success: true, data: log };
}

/* ============================================================
   15. STAFF & SALARY MANAGEMENT — Employee Documents
   ============================================================ */

/** Returns all employee documents */
export async function getEmployeeDocuments(): Promise<EmployeeDocument[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('employee_documents').select('*').order('created_at', { ascending: false });
  if (!error && data) return data as EmployeeDocument[];
  return [...MOCK_EMPLOYEE_DOCUMENTS];
}

/** Returns documents for a specific user */
export function getDocumentsForUser(userId: string): EmployeeDocument[] {
  return MOCK_EMPLOYEE_DOCUMENTS.filter((d) => d.user_id === userId);
}

/** Input for uploading an employee document */
export interface UploadDocumentInput {
  user_id: string;
  document_type: DocumentType;
  document_name: string;
  file_url: string;
  file_size?: number;
  expiry_date?: string;
  notes?: string;
}

/** Adds an employee document record */
export async function addEmployeeDocument(input: UploadDocumentInput): Promise<ServiceResponse<EmployeeDocument>> {
  if (!input.user_id) return { success: false, error: 'User is required' };
  if (!input.document_type) return { success: false, error: 'Document type is required' };
  if (!input.document_name.trim()) return { success: false, error: 'Document name is required' };
  if (!input.file_url.trim()) return { success: false, error: 'File URL is required' };

  const supabase = getSupabase();
  const { data, error } = await supabase.from('employee_documents').insert({
    user_id: input.user_id,
    document_type: input.document_type,
    document_name: input.document_name.trim(),
    file_url: input.file_url.trim(),
    file_size: input.file_size || null,
    expiry_date: input.expiry_date || null,
    is_verified: false,
    notes: input.notes?.trim() || null,
  }).select().single();

  if (!error && data) return { success: true, data: data as EmployeeDocument };

  const newDoc: EmployeeDocument = {
    id: generateId(),
    user_id: input.user_id,
    document_type: input.document_type,
    document_name: input.document_name.trim(),
    file_url: input.file_url.trim(),
    file_size: input.file_size || null,
    expiry_date: input.expiry_date || null,
    is_verified: false,
    verified_by: null,
    notes: input.notes?.trim() || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  MOCK_EMPLOYEE_DOCUMENTS.push(newDoc);
  return { success: true, data: newDoc };
}

/** Verifies an employee document */
export async function verifyDocument(documentId: string, verifiedBy: string): Promise<ServiceResponse<EmployeeDocument>> {
  const supabase = getSupabase();
  const { data: docData } = await supabase.from('employee_documents').select('*').eq('id', documentId).single();
  const doc = docData ? (docData as EmployeeDocument) : MOCK_EMPLOYEE_DOCUMENTS.find((d) => d.id === documentId);
  if (!doc) return { success: false, error: 'Document not found' };
  if (doc.is_verified) return { success: false, error: 'Document is already verified' };

  if (docData) {
    await supabase.from('employee_documents').update({ is_verified: true, verified_by: verifiedBy }).eq('id', documentId);
  }
  doc.is_verified = true;
  doc.verified_by = verifiedBy;
  doc.updated_at = new Date().toISOString();
  return { success: true, data: doc };
}

/* ============================================================
   16. STAFF & SALARY MANAGEMENT — Performance Targets
   ============================================================ */

/** Returns all performance targets */
export async function getPerformanceTargets(): Promise<PerformanceTarget[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('performance_targets').select('*').order('created_at', { ascending: false });
  if (!error && data) return data as PerformanceTarget[];
  return [...MOCK_PERFORMANCE_TARGETS];
}

/** Returns performance targets for a specific user */
export function getPerformanceTargetsForUser(userId: string): PerformanceTarget[] {
  return MOCK_PERFORMANCE_TARGETS.filter((t) => t.user_id === userId);
}

/** Input for setting a performance target */
export interface SetTargetInput {
  user_id: string;
  target_type: TargetType;
  period_start: string;
  period_end: string;
  sales_target: number;
  collection_target: number;
  new_customers_target: number;
  notes?: string;
}

/** Creates a new performance target */
export async function setPerformanceTarget(input: SetTargetInput): Promise<ServiceResponse<PerformanceTarget>> {
  if (!input.user_id) return { success: false, error: 'User is required' };
  if (!input.target_type) return { success: false, error: 'Target type is required' };
  if (!input.period_start) return { success: false, error: 'Period start is required' };
  if (!input.period_end) return { success: false, error: 'Period end is required' };
  if (input.sales_target < 0) return { success: false, error: 'Sales target cannot be negative' };

  const supabase = getSupabase();
  const { data, error } = await supabase.from('performance_targets').insert({
    user_id: input.user_id,
    target_type: input.target_type,
    period_start: input.period_start,
    period_end: input.period_end,
    sales_target: input.sales_target,
    actual_sales: 0,
    collection_target: input.collection_target,
    actual_collection: 0,
    new_customers_target: input.new_customers_target,
    new_customers_actual: 0,
    status: 'active',
    notes: input.notes?.trim() || null,
  }).select().single();

  if (!error && data) return { success: true, data: data as PerformanceTarget };

  const newTarget: PerformanceTarget = {
    id: generateId(),
    user_id: input.user_id,
    target_type: input.target_type,
    period_start: input.period_start,
    period_end: input.period_end,
    sales_target: input.sales_target,
    actual_sales: 0,
    collection_target: input.collection_target,
    actual_collection: 0,
    new_customers_target: input.new_customers_target,
    new_customers_actual: 0,
    status: 'active',
    notes: input.notes?.trim() || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  MOCK_PERFORMANCE_TARGETS.push(newTarget);
  return { success: true, data: newTarget };
}

/** Updates actual progress against a performance target */
export async function updateTargetProgress(
  targetId: string,
  actualSales: number,
  actualCollection: number,
  newCustomersActual: number
): Promise<ServiceResponse<PerformanceTarget>> {
  const supabase = getSupabase();
  const { data: tgtData } = await supabase.from('performance_targets').select('*').eq('id', targetId).single();
  const target = tgtData ? (tgtData as PerformanceTarget) : MOCK_PERFORMANCE_TARGETS.find((t) => t.id === targetId);
  if (!target) return { success: false, error: 'Performance target not found' };
  if (target.status === 'achieved' || target.status === 'cancelled') {
    return { success: false, error: `Target is already ${target.status}` };
  }

  target.actual_sales = actualSales;
  target.actual_collection = actualCollection;
  target.new_customers_actual = newCustomersActual;
  target.updated_at = new Date().toISOString();

  const salesMet = actualSales >= target.sales_target;
  const collectionMet = actualCollection >= target.collection_target;
  const customersMet = newCustomersActual >= target.new_customers_target;
  const periodEnded = new Date(target.period_end) < new Date();
  if (periodEnded) {
    target.status = salesMet && collectionMet && customersMet ? 'achieved' : 'missed';
  } else {
    target.status = 'active';
  }

  if (tgtData) {
    await supabase.from('performance_targets').update({
      actual_sales: actualSales,
      actual_collection: actualCollection,
      new_customers_actual: newCustomersActual,
      status: target.status,
    }).eq('id', targetId);
  }
  return { success: true, data: target };
}

/** Returns performance reviews for a specific user */
export function getPerformanceReviewsForUser(userId: string): PerformanceReview[] {
  return MOCK_PERFORMANCE_REVIEWS.filter((r) => r.user_id === userId);
}

/* ============================================================
   18. CLINIC — Patient, Appointment, Treatment CRUD
   ============================================================ */

export interface AddPatientInput {
  owner_id: string;
  name: string;
  species: string;
  breed?: string;
  gender: string;
  date_of_birth?: string;
  weight_kg?: number;
  color?: string;
  microchip_id?: string;
  spayed_neutered?: boolean;
  allergies?: string;
  medical_notes?: string;
}

export async function addPatient(input: AddPatientInput): Promise<ServiceResponse<Patient>> {
  if (!input.name.trim()) return { success: false, error: 'Patient name is required' };
  if (!input.owner_id) return { success: false, error: 'Owner is required' };

  const supabase = getSupabase();
  const { data, error } = await supabase.from('patients').insert({
    owner_id: input.owner_id,
    name: input.name.trim(),
    species: input.species,
    breed: input.breed || null,
    gender: input.gender,
    date_of_birth: input.date_of_birth || null,
    weight_kg: input.weight_kg || null,
    color: input.color || null,
    microchip_id: input.microchip_id || null,
    spayed_neutered: input.spayed_neutered || false,
    allergies: input.allergies || null,
    medical_notes: input.medical_notes || null,
    is_active: true,
  }).select().single();

  if (!error && data) return { success: true, data: data as Patient };

  const newPatient: Patient = {
    id: generateId(),
    owner_id: input.owner_id,
    name: input.name.trim(),
    species: input.species as any,
    breed: input.breed || null,
    gender: input.gender as any,
    date_of_birth: input.date_of_birth || null,
    age_years: null,
    age_months: null,
    weight_kg: input.weight_kg || null,
    color: input.color || null,
    microchip_id: input.microchip_id || null,
    spayed_neutered: input.spayed_neutered || false,
    allergies: input.allergies || null,
    medical_notes: input.medical_notes || null,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  MOCK_PATIENTS.push(newPatient);
  return { success: true, data: newPatient };
}

export async function getPatients(): Promise<Patient[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('patients').select('*').order('name');
  if (!error && data) return data as Patient[];
  return [...MOCK_PATIENTS];
}

export function getPatientById(id: string): Patient | undefined {
  return MOCK_PATIENTS.find((p) => p.id === id);
}

export interface AddAppointmentInput {
  patient_id: string;
  owner_id: string;
  procedure_type?: string;
  date: string;
  time: string;
  duration_minutes?: number;
  reason?: string;
}

export async function addAppointment(input: AddAppointmentInput): Promise<ServiceResponse<Appointment>> {
  if (!input.patient_id) return { success: false, error: 'Patient is required' };
  if (!input.date) return { success: false, error: 'Date is required' };
  if (!input.time) return { success: false, error: 'Time is required' };

  const supabase = getSupabase();
  const { data, error } = await supabase.from('appointments').insert({
    patient_id: input.patient_id,
    owner_id: input.owner_id,
    procedure_type: input.procedure_type || null,
    date: input.date,
    time: input.time,
    duration_minutes: input.duration_minutes || 30,
    reason: input.reason || null,
    status: 'scheduled',
  }).select().single();

  if (!error && data) return { success: true, data: data as Appointment };

  const newAppt: Appointment = {
    id: generateId(),
    patient_id: input.patient_id,
    owner_id: input.owner_id,
    vet_id: null,
    location_id: null,
    procedure_type: input.procedure_type || null,
    date: input.date,
    time: input.time,
    duration_minutes: input.duration_minutes || 30,
    reason: input.reason || null,
    status: 'scheduled',
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  MOCK_APPOINTMENTS.push(newAppt);
  return { success: true, data: newAppt };
}

export async function getAppointments(): Promise<Appointment[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('appointments').select('*').order('date');
  if (!error && data) return data as Appointment[];
  return [...MOCK_APPOINTMENTS];
}

export async function updateAppointmentStatus(id: string, status: string): Promise<ServiceResponse> {
  const supabase = getSupabase();
  const { data: aptData } = await supabase.from('appointments').select('*').eq('id', id).single();
  const appt = aptData ? (aptData as Appointment) : MOCK_APPOINTMENTS.find((a) => a.id === id);
  if (!appt) return { success: false, error: 'Appointment not found' };

  if (aptData) {
    await supabase.from('appointments').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  }
  appt.status = status as any;
  appt.updated_at = new Date().toISOString();
  return { success: true };
}

export async function getQueue(): Promise<PatientQueue[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('patient_queue').select('*').order('created_at');
  if (!error && data) return data as PatientQueue[];
  return [...MOCK_PATIENT_QUEUE];
}

export async function getVetServices(): Promise<VetService[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('vet_services').select('*').order('name');
  if (!error && data) return data as VetService[];
  return [...MOCK_VET_SERVICES];
}

export async function getTreatments(): Promise<Treatment[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('treatments').select('*').order('date', { ascending: false });
  if (!error && data) return data as Treatment[];
  return [...MOCK_TREATMENTS];
}

export function getTreatmentMedications(treatmentId: string): TreatmentMedication[] {
  return MOCK_TREATMENT_MEDICATIONS.filter((m) => m.treatment_id === treatmentId);
}

/* ============================================================
   19. RE-EXPORTS (Convenience)
   ============================================================ */

export {
  MOCK_USERS,
  MOCK_LOCATIONS,
  MOCK_DASHBOARD_STATS,
  MOCK_SALARY_GRADES,
  MOCK_SALARIES,
  MOCK_PAYROLL_RUNS,
  MOCK_PAYSLIPS,
  MOCK_LEAVE_REQUESTS,
  MOCK_LEAVE_BALANCES,
  MOCK_ATTENDANCE_LOGS,
  MOCK_EMPLOYEE_DOCUMENTS,
  MOCK_PERFORMANCE_TARGETS,
  MOCK_PERFORMANCE_REVIEWS,
  MOCK_PATIENTS,
  MOCK_APPOINTMENTS,
  MOCK_TREATMENTS,
  MOCK_TREATMENT_MEDICATIONS,
  MOCK_PATIENT_QUEUE,
  MOCK_VET_SERVICES,
  findCustomerById,
  findProductById,
  findLocationById,
  findUserById,
  findSalaryGradeById,
  getSalaryByUserId,
  getPayslipsByUserId,
  getPayslipsByPayrollRun,
  getLeaveRequestsByUserId,
  getLeaveBalancesByUserId,
  getAttendanceLogsByUserId,
  getDocumentsByUserId,
  getPerformanceTargetsByUserId,
  getPerformanceReviewsByUserId,
} from '@/lib/mock-data';

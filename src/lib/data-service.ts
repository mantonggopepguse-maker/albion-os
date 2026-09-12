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
import { isSupabaseMockMode, isSupabaseConfigured } from '@/lib/supabase/config';
import type { SupabaseClient } from '@supabase/supabase-js';
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
  TargetStatus,
  Species,
  PetGender,
  AppointmentStatus,
  PerformanceReview,
  Patient,
  Appointment,
  Treatment,
  TreatmentMedication,
  PatientQueue,
  VetService,
  ProcedureMedicationProtocol,
  CustomPayrollAdjustment,
  BranchExpense,
  BranchFinancialInsights,
  LabOrder,
  LabStatus,
  LabResultParameter,
  HospitalizationRecord,
  ICUVitalEntry,
  SurgeryRecord,
  SurgeryStatus,
  CashReconciliation,
  DrugDoseResult,
  FluidRateResult,
  AuditLog,
  AuditCategory,
  AuditSeverity,
  ClinicShift,
  ShiftBlock,
  PatientReminder,
  ReminderType,
  ReminderStatus,
  StaffRequest,
  StaffRequestType,
  StaffRequestStatus,
  Announcement,
  AnnouncementScope,
  AnnouncementPriority,
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
  MOCK_LAB_ORDERS,
  MOCK_HOSPITALIZATIONS,
  MOCK_SURGERIES,
  MOCK_CASH_RECONCILIATIONS,
  MOCK_AUDIT_LOGS,
  MOCK_EXPENSES,
  MOCK_SHIFTS,
  MOCK_REMINDERS,
  MOCK_STAFF_REQUESTS,
  MOCK_ANNOUNCEMENTS,
  findProductById,
} from '@/lib/mock-data';

const USE_MOCK_DATA = isSupabaseMockMode() || !isSupabaseConfigured();

function getSupabase(): SupabaseClient {
  return createClient();
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
  if (USE_MOCK_DATA) return [...MOCK_CUSTOMERS];
  return [];
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
  if (USE_MOCK_DATA) MOCK_CUSTOMERS.push(newCustomer);
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
  if (USE_MOCK_DATA) return [...MOCK_PRODUCTS];
  return [];
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

  if (USE_MOCK_DATA) {
    const existingSku = MOCK_PRODUCTS.find(
      (p) => p.sku.toLowerCase() === input.sku.trim().toLowerCase()
    );
    if (existingSku) return { success: false, error: `SKU "${input.sku}" already exists` };
  }

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
  if (USE_MOCK_DATA) MOCK_PRODUCTS.push(newProduct);
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
  if (USE_MOCK_DATA) return [...MOCK_INVOICES];
  return [];
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
  vat_rate?: number;
  discount_type?: 'percent' | 'fixed';
  discount_value?: number;
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

  let discountAmount = 0;
  if (input.discount_type === 'percent' && input.discount_value) {
    discountAmount = Math.round((subtotal * Math.min(100, Math.max(0, input.discount_value))) / 100);
  } else if (input.discount_type === 'fixed' && input.discount_value) {
    discountAmount = Math.min(input.discount_value, subtotal);
  }

  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const vatRate = input.vat_rate !== undefined ? input.vat_rate : 7.5;
  const vat = Math.round((taxableAmount * vatRate) / 100);
  const total = taxableAmount + vat;

  const invoiceNumber = generateInvoiceNumber();

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
    vat_rate: vatRate,
    discount_type: input.discount_type,
    discount_value: input.discount_value,
    discount_amount: discountAmount,
    status: 'draft',
    created_at: new Date().toISOString(),
    due_date: input.due_date,
  };
  if (USE_MOCK_DATA) MOCK_INVOICES.push(newInvoice);
  return { success: true, data: newInvoice };
}

let _seqCounter = 0;
let _lastSeqTs = 0;

/**
 * Generates a unique invoice number for the current year.
 * Format: INV-{YYYY}-{XXXXX} (timestamp-based, no race condition)
 */
export function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const now = Date.now();
  if (now === _lastSeqTs) {
    _seqCounter++;
  } else {
    _lastSeqTs = now;
    _seqCounter = 0;
  }
  const seq = (now + _seqCounter).toString(36).toUpperCase().slice(-5);
  return `INV-${year}-${seq}`;
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
 * Deducts inventory (FEFO) when moving from draft → sent.
 */
export async function transitionInvoice(invoiceId: string, newStatus: string): Promise<ServiceResponse> {
  const supabase = getSupabase();
  type InvoiceWithItems = Invoice & { invoice_items?: InvoiceItem[] };
  const { data: invRaw } = await supabase.from('invoices').select('*, invoice_items(*)').eq('id', invoiceId).single();
  const invData = invRaw as InvoiceWithItems | null;
  const invoice = invData
    ? ({ ...invData, items: invData.invoice_items || [] }) as Invoice
    : (USE_MOCK_DATA ? MOCK_INVOICES.find((i) => i.id === invoiceId) : undefined);
  if (!invoice) return { success: false, error: 'Invoice not found' };
  const currentStatus = invData ? invData.status : invoice.status;
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(newStatus)) {
    return { success: false, error: `Cannot transition from ${currentStatus} to ${newStatus}` };
  }

  const isFinalizing = currentStatus === 'draft' && newStatus === 'sent';

  if (isFinalizing && invoice.items && invoice.items.length > 0) {
    const locationId = invoice.location_id;
    for (const item of invoice.items) {
      let toDeduct = item.quantity;

      if (invRaw) {
        const { data: batches } = await supabase
          .from('inventory')
          .select('*')
          .eq('product_id', item.product_id)
          .eq('location_id', locationId)
          .gt('quantity', 0)
          .order('expiry_date', { ascending: true });

        if (!batches || batches.length === 0) {
          return { success: false, error: `Insufficient stock for ${item.product_name} at this location` };
        }

        for (const batch of batches) {
          if (toDeduct <= 0) break;
          const taken = Math.min(batch.quantity, toDeduct);
          const newQty = batch.quantity - taken;
          await supabase
            .from('inventory')
            .update({
              quantity: newQty,
              status: newQty === 0 ? 'out_of_stock' : newQty <= 50 ? 'low_stock' : 'in_stock',
            })
            .eq('id', batch.id);
          toDeduct -= taken;
        }
      }

      if (USE_MOCK_DATA) {
        const locationItems = MOCK_INVENTORY.filter(
          (i) => i.product_id === item.product_id && i.location_id === locationId
        ).sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());

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

    /* Log stock movement for the entire invoice */
    if (invRaw) {
      for (const item of invoice.items) {
        await supabase.from('stock_movements').insert({
          product_id: item.product_id,
          from_location_id: locationId,
          to_location_id: null,
          quantity: item.quantity,
          movement_type: 'sale',
          reference_id: invoiceId,
          notes: `Invoice ${invoiceId} finalized`,
        });
      }
    }
  }

  if (invRaw) {
    await supabase.from('invoices').update({ status: newStatus }).eq('id', invoiceId);
    if (newStatus === 'paid') {
      const { data: cust } = await supabase.from('customers').select('outstanding_balance').eq('id', invoice.customer_id).single();
      if (cust) {
        const newBal = Math.max(0, (cust.outstanding_balance || 0) - invoice.total);
        await supabase.from('customers').update({ outstanding_balance: newBal }).eq('id', invoice.customer_id);
      }
    }
  }
  if (!invRaw && USE_MOCK_DATA) {
    const mockInv = MOCK_INVOICES.find((i) => i.id === invoiceId);
    if (mockInv) {
      mockInv.status = newStatus as typeof mockInv.status;
      if (newStatus === 'paid') {
        const mockCust = MOCK_CUSTOMERS.find((c) => c.id === invoice.customer_id);
        if (mockCust) {
          mockCust.outstanding_balance = Math.max(0, mockCust.outstanding_balance - invoice.total);
        }
      }
    }
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
  if (USE_MOCK_DATA) return [...MOCK_PAYMENTS];
  return [];
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
  if (USE_MOCK_DATA) MOCK_PAYMENTS.push(newPayment);
  return { success: true, data: newPayment };
}

/** Reconcile cash — marks a cash payment as received by finance */
export async function reconcileCash(paymentId: string, approvedBy: string): Promise<ServiceResponse> {
  const supabase = getSupabase();
  const { data: pmt } = await supabase.from('payments').select('*').eq('id', paymentId).single();
  const payment = pmt ? (pmt as Payment) : (USE_MOCK_DATA ? MOCK_PAYMENTS.find((p) => p.id === paymentId) : undefined);
  if (!payment) return { success: false, error: 'Payment not found' };
  if (payment.status !== 'pending') return { success: false, error: 'Payment is not pending' };
  if (payment.method !== 'cash') return { success: false, error: 'Only cash payments can be reconciled' };
  return approvePayment(paymentId, approvedBy);
}

/** Approves a pending payment — updates payment, invoice status, and customer balance */
export async function approvePayment(paymentId: string, approvedBy: string): Promise<ServiceResponse> {
  const supabase = getSupabase();
  const { data: pmt } = await supabase.from('payments').select('*').eq('id', paymentId).single();
  const payment = pmt ? (pmt as Payment) : MOCK_PAYMENTS.find((p) => p.id === paymentId);
  if (!payment) return { success: false, error: 'Payment not found' };
  if (payment.status !== 'pending') return { success: false, error: 'Payment is not pending' };

  if (payment.invoice_id && USE_MOCK_DATA) {
    const invoice = MOCK_INVOICES.find((i) => i.id === payment.invoice_id);
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
  if (!pmt && USE_MOCK_DATA) {
    const mockPmt = MOCK_PAYMENTS.find((p) => p.id === paymentId);
    if (mockPmt) { mockPmt.status = 'approved'; mockPmt.approved_by = approvedBy; }
  }
  return { success: true };
}

/** Rejects a pending payment */
export async function rejectPayment(paymentId: string, approvedBy: string, reason: string): Promise<ServiceResponse> {
  const supabase = getSupabase();
  const { data: pmt } = await supabase.from('payments').select('*').eq('id', paymentId).single();
  const payment = pmt ? (pmt as Payment) : (USE_MOCK_DATA ? MOCK_PAYMENTS.find((p) => p.id === paymentId) : undefined);
  if (!payment) return { success: false, error: 'Payment not found' };
  if (payment.status !== 'pending') return { success: false, error: 'Payment is not pending' };

  if (pmt) {
    await supabase.from('payments').update({ status: 'rejected', approved_by: approvedBy, notes: reason || 'Rejected by finance' }).eq('id', paymentId);
  }
  if (!pmt && USE_MOCK_DATA) {
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
  if (USE_MOCK_DATA) return [...MOCK_INVENTORY];
  return [];
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

  let lastExpiry = '';
  if (USE_MOCK_DATA) {
    const sourceBatches = MOCK_INVENTORY
      .filter((i) => i.product_id === input.product_id && i.location_id === input.from_location_id && i.quantity > 0)
      .sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());

    if (sourceBatches.length === 0) return { success: false, error: 'No stock found for this product at the source location' };

    const totalAvailable = sourceBatches.reduce((sum, b) => sum + b.quantity, 0);
    if (totalAvailable < input.quantity) {
      return { success: false, error: `Insufficient stock. Available: ${totalAvailable} units across ${sourceBatches.length} batch(es)` };
    }

    let toDeduct = input.quantity;
    for (const batch of sourceBatches) {
      if (toDeduct <= 0) break;
      const taken = Math.min(batch.quantity, toDeduct);
      batch.quantity -= taken;
      toDeduct -= taken;
      if (batch.quantity === 0) batch.status = 'out_of_stock';
      else if (batch.quantity <= 50) batch.status = 'low_stock';
      lastExpiry = batch.expiry_date;
    }
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

  if (USE_MOCK_DATA) {
    MOCK_INVENTORY.push({
      id: generateId(),
      product_id: input.product_id,
      location_id: input.to_location_id,
      quantity: input.quantity,
      batch_number: `ALLOC-${new Date().toISOString().slice(0, 10)}`,
      expiry_date: lastExpiry,
      status: 'in_stock',
    });
  }
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
  const item = invData ? (invData as InventoryItem) : (USE_MOCK_DATA ? MOCK_INVENTORY.find((i) => i.id === input.inventory_id) : undefined);
  if (!item) return { success: false, error: 'Inventory item not found' };
  if (input.actual_quantity < 0) return { success: false, error: 'Quantity cannot be negative' };

  const difference = input.actual_quantity - item.quantity;
  item.quantity = input.actual_quantity;
  item.status = input.actual_quantity === 0 ? 'out_of_stock' : input.actual_quantity <= 50 ? 'low_stock' : 'in_stock';

  if (invData) {
    await supabase.from('inventory').update({ quantity: input.actual_quantity, status: item.status }).eq('id', input.inventory_id);
  }

  await supabase.from('stock_movements').insert({
    product_id: item.product_id,
    quantity: difference,
    movement_type: 'adjustment',
    reference_id: input.inventory_id,
    notes: input.notes || `Stock take: ${item.quantity} → ${input.actual_quantity}`,
  });

  return { success: true, data: { item, difference, notes: input.notes } };
}

export interface ReceiveSupplierStockInput {
  supplier_id: string;
  supplier_name: string;
  product_id: string;
  location_id: string;
  quantity: number;
  batch_number?: string;
  expiry_date?: string;
  notes?: string;
}

/** Receives inventory from a supplier into a location and records a stock movement */
export async function receiveSupplierStock(input: ReceiveSupplierStockInput): Promise<ServiceResponse<InventoryItem>> {
  if (input.quantity <= 0) return { success: false, error: 'Quantity must be greater than 0' };
  if (!input.product_id) return { success: false, error: 'Product is required' };
  if (!input.location_id) return { success: false, error: 'Location is required' };

  const supabase = getSupabase();
  const batchNum = input.batch_number || `BATCH-${Date.now().toString().slice(-4)}`;

  const { data: existing } = await supabase
    .from('inventory')
    .select('*')
    .eq('product_id', input.product_id)
    .eq('location_id', input.location_id)
    .limit(1)
    .maybeSingle();

  let item: InventoryItem;

  if (existing) {
    const newQty = (existing.quantity || 0) + input.quantity;
    const status = newQty === 0 ? 'out_of_stock' : newQty <= 50 ? 'low_stock' : 'in_stock';
    const { data: updated, error: updateError } = await supabase
      .from('inventory')
      .update({ quantity: newQty, status })
      .eq('id', existing.id)
      .select()
      .single();

    if (updateError) return { success: false, error: updateError.message };
    item = updated as InventoryItem;
  } else {
    const status = input.quantity <= 50 ? 'low_stock' : 'in_stock';
    const { data: created, error: createError } = await supabase
      .from('inventory')
      .insert({
        product_id: input.product_id,
        location_id: input.location_id,
        quantity: input.quantity,
        batch_number: batchNum,
        expiry_date: input.expiry_date || null,
        status,
      })
      .select()
      .single();

    if (createError) return { success: false, error: createError.message };
    item = created as InventoryItem;
  }

  await supabase.from('stock_movements').insert({
    product_id: input.product_id,
    to_location_id: input.location_id,
    from_location_id: null,
    quantity: input.quantity,
    movement_type: 'transfer_in',
    reference_id: input.supplier_id,
    notes: input.notes || `Received ${input.quantity} units from supplier "${input.supplier_name}"`,
  });

  if (USE_MOCK_DATA) {
    const mockIdx = MOCK_INVENTORY.findIndex(
      (i) => i.product_id === input.product_id && i.location_id === input.location_id
    );
    if (mockIdx !== -1) {
      MOCK_INVENTORY[mockIdx].quantity += input.quantity;
      MOCK_INVENTORY[mockIdx].status =
        MOCK_INVENTORY[mockIdx].quantity === 0 ? 'out_of_stock' : MOCK_INVENTORY[mockIdx].quantity <= 50 ? 'low_stock' : 'in_stock';
      item = MOCK_INVENTORY[mockIdx];
    } else {
      const mockNew: InventoryItem = {
        id: `inv-${Date.now()}`,
        product_id: input.product_id,
        location_id: input.location_id,
        quantity: input.quantity,
        batch_number: batchNum,
        expiry_date: input.expiry_date || '',
        status: input.quantity <= 50 ? 'low_stock' : 'in_stock',
      };
      MOCK_INVENTORY.push(mockNew);
      item = mockNew;
    }
  }

  return { success: true, data: item };
}

/* ============================================================
   6. CHAT MESSAGES
   ============================================================ */

/** Returns all chat messages */
export async function getChatMessages(): Promise<ChatMessage[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('chat_messages').select('*').order('created_at');
  if (!error && data) return data as ChatMessage[];
  if (USE_MOCK_DATA) return [...MOCK_CHAT_MESSAGES];
  return [];
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
  if (USE_MOCK_DATA) MOCK_CHAT_MESSAGES.push(newMessage);
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
  roles?: UserRole[];
  location_id: string | null;
  phone: string | null;
}

/** Creates a new staff user record */
export async function addStaffUser(input: AddStaffUserInput): Promise<ServiceResponse<User>> {
  if (!input.email.trim()) return { success: false, error: 'Email is required' };
  if (!input.full_name.trim()) return { success: false, error: 'Full name is required' };
  if (!input.role) return { success: false, error: 'Role is required' };

  const effectiveRoles = input.roles && input.roles.length > 0 ? input.roles : [input.role];

  const supabase = getSupabase();
  const { data, error } = await supabase.from('profiles').insert({
    email: input.email.trim().toLowerCase(),
    full_name: input.full_name.trim(),
    role: input.role,
    roles: effectiveRoles,
    location_id: input.location_id || null,
    phone: input.phone?.trim() || null,
    is_active: true,
  }).select().single();

  if (!error && data) return { success: true, data: data as User };

  if (USE_MOCK_DATA) {
    const existing = MOCK_USERS.find(
      (u) => u.email.toLowerCase() === input.email.trim().toLowerCase()
    );
    if (existing) return { success: false, error: 'A user with this email already exists' };
  }

  const newUser: User = {
    id: generateId(),
    email: input.email.trim().toLowerCase(),
    full_name: input.full_name.trim(),
    role: input.role,
    roles: effectiveRoles,
    location_id: input.location_id || null,
    avatar_url: null,
    phone: input.phone?.trim() || null,
    created_at: new Date().toISOString(),
    is_active: true,
  };
  if (USE_MOCK_DATA) MOCK_USERS.push(newUser);
  return { success: true, data: newUser };
}

/** Toggles a user's active status (suspend / restore) */
export async function toggleUserStatus(userId: string): Promise<ServiceResponse<User>> {
  const supabase = getSupabase();
  const { data: userData } = await supabase.from('profiles').select('*').eq('id', userId).single();
  const user = userData ? (userData as User) : (USE_MOCK_DATA ? MOCK_USERS.find((u) => u.id === userId) : undefined);
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
  const user = userData ? (userData as User) : (USE_MOCK_DATA ? MOCK_USERS.find((u) => u.id === userId) : undefined);
  if (!user) return { success: false, error: 'User not found' };

  if (userData) {
    const updates: Partial<User> = {};
    if (input.full_name !== undefined) updates.full_name = input.full_name.trim();
    if (input.email !== undefined) updates.email = input.email.trim().toLowerCase();
    if (input.role !== undefined) updates.role = input.role;
    if (input.roles !== undefined) updates.roles = input.roles;
    if (input.location_id !== undefined) updates.location_id = input.location_id || null;
    if (input.phone !== undefined) updates.phone = input.phone?.trim() || null;
    await supabase.from('profiles').update(updates).eq('id', userId);
  }

  if (USE_MOCK_DATA) {
    if (input.full_name !== undefined) user.full_name = input.full_name.trim();
    if (input.email !== undefined) {
      const duplicate = MOCK_USERS.find((u) => u.email.toLowerCase() === input.email!.trim().toLowerCase() && u.id !== userId);
      if (duplicate) return { success: false, error: 'A user with this email already exists' };
      user.email = input.email.trim().toLowerCase();
    }
    if (input.role !== undefined) user.role = input.role;
    if (input.roles !== undefined) user.roles = input.roles;
    if (input.location_id !== undefined) user.location_id = input.location_id || null;
    if (input.phone !== undefined) user.phone = input.phone?.trim() || null;
  }
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
  const customer = custData ? (custData as Customer) : (USE_MOCK_DATA ? MOCK_CUSTOMERS.find((c) => c.id === customerId) : undefined);
  if (!customer) return { success: false, error: 'Customer not found' };

  if (custData) {
    const updates: Partial<Customer> = {};
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

  if (USE_MOCK_DATA) {
    if (input.name !== undefined) customer.name = input.name.trim();
    if (input.business_name !== undefined) customer.business_name = input.business_name.trim();
    if (input.phone !== undefined) customer.phone = input.phone.trim();
    if (input.email !== undefined) customer.email = input.email?.trim() || null;
    if (input.address !== undefined) customer.address = input.address.trim();
    if (input.state !== undefined) customer.state = input.state.trim();
    if (input.credit_limit !== undefined) customer.credit_limit = input.credit_limit;
    if (input.location_id !== undefined) customer.location_id = input.location_id;
  }
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
  const product = prodData ? (prodData as Product) : (USE_MOCK_DATA ? MOCK_PRODUCTS.find((p) => p.id === productId) : undefined);
  if (!product) return { success: false, error: 'Product not found' };

  if (prodData) {
    const updates: Partial<Product> = {};
    if (input.name !== undefined) updates.name = input.name.trim();
    if (input.sku !== undefined) updates.sku = input.sku.trim().toUpperCase();
    if (input.nafdac_number !== undefined) updates.nafdac_number = input.nafdac_number.trim();
    if (input.unit_price !== undefined) updates.unit_price = input.unit_price;
    if (input.category !== undefined) updates.category = input.category.trim();
    if (input.description !== undefined) updates.description = input.description?.trim() || null;
    await supabase.from('products').update(updates).eq('id', productId);
  }

  if (USE_MOCK_DATA) {
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
  }
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
  if (USE_MOCK_DATA) return [...MOCK_SALARY_GRADES];
  return [];
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

  if (USE_MOCK_DATA) {
    const duplicate = MOCK_SALARY_GRADES.find((sg) => sg.grade.toLowerCase() === input.grade.trim().toLowerCase());
    if (duplicate) return { success: false, error: `Grade "${input.grade}" already exists` };
  }

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
  if (USE_MOCK_DATA) MOCK_SALARY_GRADES.push(newGrade);
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
  if (USE_MOCK_DATA) return [...MOCK_SALARIES];
  return [];
}

/** Returns the active salary for a specific user */
export async function getSalaryForUser(userId: string): Promise<Salary | undefined> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('salaries').select('*').eq('user_id', userId).eq('is_active', true).maybeSingle();
  if (!error && data) return data as Salary;
  if (USE_MOCK_DATA) return MOCK_SALARIES.find((s) => s.user_id === userId && s.is_active);
  return undefined;
}

/** Input for assigning/updating a salary */
export interface AssignSalaryInput {
  user_id: string;
  salary_grade_id: string;
  basic_salary: number;
  effective_date: string;
  tax_deduction?: number;
  loan_repayment?: number;
  unmet_target_penalty?: number;
  custom_deductions?: CustomPayrollAdjustment[];
  custom_additions?: CustomPayrollAdjustment[];
}

/** Calculates allowances based on salary grade percentages */
async function calculateAllowances(basicSalary: number, gradeId: string): Promise<{ housing: number; transport: number; medical: number }> {
  const grade = ((): SalaryGrade | undefined => {
    if (USE_MOCK_DATA) return MOCK_SALARY_GRADES.find((sg) => sg.id === gradeId);
    return undefined;
  })();
  if (!grade && !USE_MOCK_DATA) {
    const supabase = getSupabase();
    const { data } = await supabase.from('salary_grades').select('*').eq('id', gradeId).maybeSingle();
    if (data) return {
      housing: Math.round(basicSalary * ((data as SalaryGrade).housing_allowance_pct / 100)),
      transport: Math.round(basicSalary * ((data as SalaryGrade).transport_allowance_pct / 100)),
      medical: Math.round(basicSalary * ((data as SalaryGrade).medical_allowance_pct / 100)),
    };
  }
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

  if (USE_MOCK_DATA) {
    const user = MOCK_USERS.find((u) => u.id === input.user_id);
    if (!user) return { success: false, error: 'User not found' };

    const grade = MOCK_SALARY_GRADES.find((sg) => sg.id === input.salary_grade_id);
    if (!grade) return { success: false, error: 'Salary grade not found' };

    MOCK_SALARIES.forEach((s) => {
      if (s.user_id === input.user_id && s.is_active) s.is_active = false;
    });
  }

  const customAdditionsList = (input.custom_additions || []).map((ca) => ({
    ...ca,
    amount: ca.type === 'percentage' ? Math.round(input.basic_salary * (ca.value / 100)) : ca.value,
  }));
  const totalCustomAdditions = customAdditionsList.reduce((sum, item) => sum + item.amount, 0);

  const allowances = await calculateAllowances(input.basic_salary, input.salary_grade_id);
  const totalGross = input.basic_salary + allowances.housing + allowances.transport + allowances.medical + totalCustomAdditions;
  const taxRate = 7.5;
  const pensionRate = 8.0;
  const nhisRate = 2.5;
  const payeTax = (input.tax_deduction && input.tax_deduction > 0) ? input.tax_deduction : calculatePAYE(totalGross);
  const pensionDed = Math.round(totalGross * (pensionRate / 100));
  const nhisDed = Math.round(totalGross * (nhisRate / 100));
  const loanRepayment = input.loan_repayment || 0;
  const unmetTargetPenalty = input.unmet_target_penalty || 0;

  const customDeductionsList = (input.custom_deductions || []).map((cd) => ({
    ...cd,
    amount: cd.type === 'percentage' ? Math.round(input.basic_salary * (cd.value / 100)) : cd.value,
  }));
  const totalCustomDeductions = customDeductionsList.reduce((sum, item) => sum + item.amount, 0);

  const totalDeductions = payeTax + pensionDed + nhisDed + loanRepayment + unmetTargetPenalty + totalCustomDeductions;
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
    tax_deduction: payeTax,
    loan_repayment: loanRepayment,
    unmet_target_penalty: unmetTargetPenalty,
    custom_deductions: customDeductionsList,
    custom_additions: customAdditionsList,
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
    tax_deduction: payeTax,
    loan_repayment: loanRepayment,
    unmet_target_penalty: unmetTargetPenalty,
    custom_deductions: customDeductionsList,
    custom_additions: customAdditionsList,
    total_deductions: totalDeductions,
    net_pay: netPay,
    effective_date: input.effective_date,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (USE_MOCK_DATA) MOCK_SALARIES.push(newSalary);
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
  if (USE_MOCK_DATA) return [...MOCK_PAYROLL_RUNS];
  return [];
}

/** Returns a single payroll run by ID */
export async function getPayrollRunById(id: string): Promise<PayrollRun | undefined> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('payroll_runs').select('*').eq('id', id).maybeSingle();
  if (!error && data) return data as PayrollRun;
  if (USE_MOCK_DATA) return MOCK_PAYROLL_RUNS.find((pr) => pr.id === id);
  return undefined;
}

/** Returns payslips for a given payroll run */
export async function getPayslipsForRun(payrollRunId: string): Promise<Payslip[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('payslips').select('*').eq('payroll_run_id', payrollRunId);
  if (!error && data) return data as Payslip[];
  if (USE_MOCK_DATA) return MOCK_PAYSLIPS.filter((ps) => ps.payroll_run_id === payrollRunId);
  return [];
}

/** Returns payslips for a specific user */
export async function getPayslipsForUser(userId: string): Promise<Payslip[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('payslips').select('*').eq('user_id', userId);
  if (!error && data) return data as Payslip[];
  if (USE_MOCK_DATA) return MOCK_PAYSLIPS.filter((ps) => ps.user_id === userId);
  return [];
}

/** Processes payroll for all active employees for a given period */
export async function processPayroll(
  periodStart: string,
  periodEnd: string,
  paymentDate: string,
  processedBy: string
): Promise<ServiceResponse<PayrollRun>> {
  const supabase = getSupabase();

  let activeSalaries: Salary[];
  let existingRun: PayrollRun | undefined;

  if (USE_MOCK_DATA) {
    activeSalaries = MOCK_SALARIES.filter((s) => s.is_active);
    existingRun = MOCK_PAYROLL_RUNS.find(
      (pr) => pr.period_start === periodStart && pr.period_end === periodEnd && pr.status !== 'cancelled'
    );
  } else {
    const { data: salData, error: salError } = await supabase.from('salaries').select('*').eq('is_active', true);
    if (salError || !salData) return { success: false, error: 'Could not fetch active salaries. Please try again.' };
    activeSalaries = salData as Salary[];
    const { data: runData } = await supabase.from('payroll_runs')
      .select('*').eq('period_start', periodStart).eq('period_end', periodEnd).neq('status', 'cancelled').maybeSingle();
    existingRun = (runData as PayrollRun) || undefined;
  }

  if (activeSalaries.length === 0) return { success: false, error: 'No active salaries found to process' };
  if (existingRun) return { success: false, error: `Payroll for ${periodStart} to ${periodEnd} already exists (status: ${existingRun.status})` };

  const payslips: Payslip[] = [];
  let totalGross = 0, totalDeductions = 0, totalNet = 0;

  for (const salary of activeSalaries) {
    const customAdditionsList = (salary.custom_additions || []).map((ca) => ({
      ...ca,
      amount: ca.type === 'percentage' ? Math.round(salary.basic_salary * (ca.value / 100)) : ca.value,
    }));
    const totalCustomAdditions = customAdditionsList.reduce((sum, item) => sum + item.amount, 0);

    const tg = salary.basic_salary + salary.housing_allowance + salary.transport_allowance + salary.medical_allowance + totalCustomAdditions;
    const payeTax = (salary.tax_deduction && salary.tax_deduction > 0) ? salary.tax_deduction : calculatePAYE(tg);
    const pensionDed = Math.round(tg * (salary.pension_rate / 100));
    const nhisDed = Math.round(tg * (salary.nhis_rate / 100));
    const loanRepayment = salary.loan_repayment || 0;
    const unmetTargetPenalty = salary.unmet_target_penalty || 0;

    const customDeductionsList = (salary.custom_deductions || []).map((cd) => ({
      ...cd,
      amount: cd.type === 'percentage' ? Math.round(salary.basic_salary * (cd.value / 100)) : cd.value,
    }));
    const totalCustomDeductions = customDeductionsList.reduce((sum, item) => sum + item.amount, 0);

    const td = payeTax + pensionDed + nhisDed + loanRepayment + unmetTargetPenalty + totalCustomDeductions;
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
      tax_deduction: payeTax,
      loan_repayment: loanRepayment,
      unmet_target_penalty: unmetTargetPenalty,
      custom_deductions: customDeductionsList,
      custom_additions: customAdditionsList,
      total_deductions: td,
      net_pay: np,
      created_at: new Date().toISOString(),
    });
    totalGross += tg;
    totalDeductions += td;
    totalNet += np;
  }

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
    const runId = prData.id;
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
  if (USE_MOCK_DATA) {
    MOCK_PAYROLL_RUNS.push(payrollRun);
    MOCK_PAYSLIPS.push(...payslips);
  }
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
  if (USE_MOCK_DATA) return [...MOCK_LEAVE_REQUESTS];
  return [];
}

/** Returns leave requests for a specific user */
export async function getLeaveRequestsForUser(userId: string): Promise<LeaveRequest[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('leave_requests').select('*').eq('user_id', userId);
  if (!error && data) return data as LeaveRequest[];
  if (USE_MOCK_DATA) return MOCK_LEAVE_REQUESTS.filter((lr) => lr.user_id === userId);
  return [];
}

/** Returns leave balances for a specific user */
export async function getLeaveBalancesForUser(userId: string): Promise<LeaveBalance[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('leave_balances').select('*').eq('user_id', userId);
  if (!error && data) return data as LeaveBalance[];
  if (USE_MOCK_DATA) return MOCK_LEAVE_BALANCES.filter((lb) => lb.user_id === userId);
  return [];
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

  if (USE_MOCK_DATA) {
    const year = start.getFullYear();
    const balance = MOCK_LEAVE_BALANCES.find(
      (lb) => lb.user_id === input.user_id && lb.leave_type === input.leave_type && lb.year === year
    );
    if (balance && durationDays > balance.remaining_days) {
      return { success: false, error: `Insufficient leave balance. Only ${balance.remaining_days} ${input.leave_type} day(s) remaining.` };
    }
  }

  if (USE_MOCK_DATA) {
    const overlapping = MOCK_LEAVE_REQUESTS.find((lr) => {
    if (lr.user_id !== input.user_id || lr.status === 'cancelled') return false;
    const lrStart = new Date(lr.start_date);
    const lrEnd = new Date(lr.end_date);
    return start <= lrEnd && end >= lrStart;
  });
    if (overlapping) return { success: false, error: 'You already have a leave request overlapping with these dates' };
  }

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
  if (USE_MOCK_DATA) MOCK_LEAVE_REQUESTS.push(newRequest);
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
  const leaveRequest = lrData ? (lrData as LeaveRequest) : (USE_MOCK_DATA ? MOCK_LEAVE_REQUESTS.find((lr) => lr.id === leaveRequestId) : undefined);
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

  if (USE_MOCK_DATA) {
    leaveRequest.status = newStatus;
    leaveRequest.approved_by = reviewerId;
    leaveRequest.reviewed_at = new Date().toISOString();
    leaveRequest.reviewer_notes = reviewerNotes?.trim() || null;
    leaveRequest.updated_at = new Date().toISOString();
  }

  if (newStatus === 'approved' && USE_MOCK_DATA) {
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
  const leaveRequest = lrData ? (lrData as LeaveRequest) : (USE_MOCK_DATA ? MOCK_LEAVE_REQUESTS.find((lr) => lr.id === leaveRequestId) : undefined);
  if (!leaveRequest) return { success: false, error: 'Leave request not found' };
  if (leaveRequest.status !== 'pending') return { success: false, error: 'Only pending requests can be cancelled' };
  if (leaveRequest.user_id !== userId) return { success: false, error: 'You can only cancel your own leave requests' };

  if (lrData) {
    await supabase.from('leave_requests').update({ status: 'cancelled' }).eq('id', leaveRequestId);
  }
  if (USE_MOCK_DATA) {
    leaveRequest.status = 'cancelled';
    leaveRequest.updated_at = new Date().toISOString();
  }
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
  if (USE_MOCK_DATA) return [...MOCK_ATTENDANCE_LOGS];
  return [];
}

/** Returns attendance logs for a specific user */
export async function getAttendanceLogsForUser(userId: string): Promise<AttendanceLog[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('attendance_logs').select('*').eq('user_id', userId).order('date', { ascending: false });
  if (!error && data) return data as AttendanceLog[];
  if (USE_MOCK_DATA) return MOCK_ATTENDANCE_LOGS.filter((a) => a.user_id === userId);
  return [];
}

/** Returns attendance for a specific user on a specific date */
export async function getAttendanceForDate(userId: string, date: string): Promise<AttendanceLog | undefined> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('attendance_logs').select('*').eq('user_id', userId).eq('date', date).maybeSingle();
  if (!error && data) return data as AttendanceLog;
  if (USE_MOCK_DATA) return MOCK_ATTENDANCE_LOGS.find((a) => a.user_id === userId && a.date === date);
  return undefined;
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

  if (USE_MOCK_DATA) {
    const existing = MOCK_ATTENDANCE_LOGS.find((a) => a.user_id === userId && a.date === today);
    if (existing) {
      if (existing.clock_in) return { success: false, error: 'Already clocked in today' };
      existing.clock_in = now.toISOString();
      existing.status = 'present';
      existing.updated_at = now.toISOString();
      return { success: true, data: existing };
    }
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
  if (USE_MOCK_DATA) MOCK_ATTENDANCE_LOGS.push(newLog);
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

  if (USE_MOCK_DATA) {
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
  return { success: false, error: 'No clock-in record found for today. Please clock in first.' };
}

/* ============================================================
   15. STAFF & SALARY MANAGEMENT — Employee Documents
   ============================================================ */

/** Returns all employee documents */
export async function getEmployeeDocuments(): Promise<EmployeeDocument[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('employee_documents').select('*').order('created_at', { ascending: false });
  if (!error && data) return data as EmployeeDocument[];
  if (USE_MOCK_DATA) return [...MOCK_EMPLOYEE_DOCUMENTS];
  return [];
}

/** Returns documents for a specific user */
export async function getDocumentsForUser(userId: string): Promise<EmployeeDocument[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('employee_documents').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (!error && data) return data as EmployeeDocument[];
  if (USE_MOCK_DATA) return MOCK_EMPLOYEE_DOCUMENTS.filter((d) => d.user_id === userId);
  return [];
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
  if (USE_MOCK_DATA) MOCK_EMPLOYEE_DOCUMENTS.push(newDoc);
  return { success: true, data: newDoc };
}

/** Verifies an employee document */
export async function verifyDocument(documentId: string, verifiedBy: string): Promise<ServiceResponse<EmployeeDocument>> {
  const supabase = getSupabase();
  const { data: docData } = await supabase.from('employee_documents').select('*').eq('id', documentId).single();
  const doc = docData ? (docData as EmployeeDocument) : (USE_MOCK_DATA ? MOCK_EMPLOYEE_DOCUMENTS.find((d) => d.id === documentId) : undefined);
  if (!doc) return { success: false, error: 'Document not found' };
  if (doc.is_verified) return { success: false, error: 'Document is already verified' };

  if (docData) {
    await supabase.from('employee_documents').update({ is_verified: true, verified_by: verifiedBy }).eq('id', documentId);
  }
  if (USE_MOCK_DATA) {
    doc.is_verified = true;
    doc.verified_by = verifiedBy;
    doc.updated_at = new Date().toISOString();
  }
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
  if (USE_MOCK_DATA) return [...MOCK_PERFORMANCE_TARGETS];
  return [];
}

/** Returns performance targets for a specific user */
export async function getPerformanceTargetsForUser(userId: string): Promise<PerformanceTarget[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('performance_targets').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (!error && data) return data as PerformanceTarget[];
  if (USE_MOCK_DATA) return MOCK_PERFORMANCE_TARGETS.filter((t) => t.user_id === userId);
  return [];
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
  if (USE_MOCK_DATA) MOCK_PERFORMANCE_TARGETS.push(newTarget);
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
  const target = tgtData ? (tgtData as PerformanceTarget) : (USE_MOCK_DATA ? MOCK_PERFORMANCE_TARGETS.find((t) => t.id === targetId) : undefined);
  if (!target) return { success: false, error: 'Performance target not found' };
  if (target.status === 'achieved' || target.status === 'cancelled') {
    return { success: false, error: `Target is already ${target.status}` };
  }

  if (USE_MOCK_DATA) {
    target.actual_sales = actualSales;
    target.actual_collection = actualCollection;
    target.new_customers_actual = newCustomersActual;
    target.updated_at = new Date().toISOString();
  }

  const salesMet = actualSales >= target.sales_target;
  const collectionMet = actualCollection >= target.collection_target;
  const customersMet = newCustomersActual >= target.new_customers_target;
  const periodEnded = new Date(target.period_end) < new Date();
  let newStatus: TargetStatus;
  if (periodEnded) {
    newStatus = salesMet && collectionMet && customersMet ? 'achieved' : 'missed';
  } else {
    newStatus = 'active';
  }
  if (USE_MOCK_DATA) {
    target.status = newStatus;
  }

  if (tgtData) {
    await supabase.from('performance_targets').update({
      actual_sales: actualSales,
      actual_collection: actualCollection,
      new_customers_actual: newCustomersActual,
      status: newStatus,
    }).eq('id', targetId);
  }
  return { success: true, data: target };
}

/** Returns performance reviews for a specific user */
export async function getPerformanceReviewsForUser(userId: string): Promise<PerformanceReview[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('performance_reviews').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (!error && data) return data as PerformanceReview[];
  if (USE_MOCK_DATA) return MOCK_PERFORMANCE_REVIEWS.filter((r) => r.user_id === userId);
  return [];
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
    species: input.species as Species,
    breed: input.breed || null,
    gender: input.gender as PetGender,
    date_of_birth: input.date_of_birth || null,
    age_years: null,
    age_months: null,
    weight_kg: input.weight_kg || null,
    color: input.color || null,
    microchip_id: input.microchip_id || null,
    spayed_neutered: input.spayed_neutered || false,
    allergies: input.allergies || null,
    medical_notes: input.medical_notes || null,
    location_id: null,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (USE_MOCK_DATA) MOCK_PATIENTS.push(newPatient);
  return { success: true, data: newPatient };
}

export async function getPatients(): Promise<Patient[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('patients').select('*').order('name');
  if (!error && data) return data as Patient[];
  if (USE_MOCK_DATA) return [...MOCK_PATIENTS];
  return [];
}

export async function getPatientById(id: string): Promise<Patient | undefined> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('patients').select('*').eq('id', id).maybeSingle();
  if (!error && data) return data as Patient;
  if (USE_MOCK_DATA) return MOCK_PATIENTS.find((p) => p.id === id);
  return undefined;
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
  if (USE_MOCK_DATA) MOCK_APPOINTMENTS.push(newAppt);
  return { success: true, data: newAppt };
}

export async function getAppointments(): Promise<Appointment[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('appointments').select('*').order('date');
  if (!error && data) return data as Appointment[];
  if (USE_MOCK_DATA) return [...MOCK_APPOINTMENTS];
  return [];
}

export async function updateAppointmentStatus(id: string, status: string): Promise<ServiceResponse> {
  const supabase = getSupabase();
  const { data: aptData } = await supabase.from('appointments').select('*').eq('id', id).single();
  const appt = aptData ? (aptData as Appointment) : (USE_MOCK_DATA ? MOCK_APPOINTMENTS.find((a) => a.id === id) : undefined);
  if (!appt) return { success: false, error: 'Appointment not found' };

  if (aptData) {
    await supabase.from('appointments').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  }
  if (USE_MOCK_DATA) {
    appt.status = status as AppointmentStatus;
    appt.updated_at = new Date().toISOString();
  }
  return { success: true };
}

export async function getQueue(): Promise<PatientQueue[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('patient_queue').select('*').order('created_at');
  if (!error && data) return data as PatientQueue[];
  if (USE_MOCK_DATA) return [...MOCK_PATIENT_QUEUE];
  return [];
}

export async function getVetServices(): Promise<VetService[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('vet_services').select('*').order('name');
  if (!error && data) return data as VetService[];
  if (USE_MOCK_DATA) return [...MOCK_VET_SERVICES];
  return [];
}

export async function createVetService(input: {
  name: string;
  description?: string | null;
  category: string;
  species: string;
  price: number;
  duration_minutes?: number;
  medication_protocol?: ProcedureMedicationProtocol[];
  post_op_notes?: string;
}): Promise<ServiceResponse<VetService>> {
  if (!input.name.trim()) return { success: false, error: 'Service name is required' };
  if (!input.price || input.price < 0) return { success: false, error: 'Valid price is required' };

  const newService: VetService = {
    id: `vs-${Date.now()}`,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    category: input.category,
    species: input.species || 'All',
    price: input.price,
    duration_minutes: input.duration_minutes || 30,
    medication_protocol: input.medication_protocol || [],
    post_op_notes: input.post_op_notes || undefined,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (USE_MOCK_DATA) {
    MOCK_VET_SERVICES.push(newService);
    return { success: true, data: newService };
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.from('vet_services').insert({
    name: newService.name,
    description: newService.description,
    category: newService.category,
    species: newService.species,
    price: newService.price,
    is_active: true,
  }).select().single();

  if (!error && data) return { success: true, data: data as VetService };
  MOCK_VET_SERVICES.push(newService);
  return { success: true, data: newService };
}

export async function updateVetService(
  id: string,
  updates: Partial<Omit<VetService, 'id' | 'created_at'>>
): Promise<ServiceResponse<VetService>> {
  if (USE_MOCK_DATA) {
    const idx = MOCK_VET_SERVICES.findIndex((s) => s.id === id);
    if (idx !== -1) {
      MOCK_VET_SERVICES[idx] = { ...MOCK_VET_SERVICES[idx], ...updates, updated_at: new Date().toISOString() };
      return { success: true, data: MOCK_VET_SERVICES[idx] };
    }
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.from('vet_services').update({
    ...updates,
    updated_at: new Date().toISOString(),
  }).eq('id', id).select().single();

  if (!error && data) return { success: true, data: data as VetService };
  return { success: false, error: error?.message || 'Failed to update service' };
}

export async function getTreatments(): Promise<Treatment[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('treatments').select('*').order('date', { ascending: false });
  if (!error && data) return data as Treatment[];
  if (USE_MOCK_DATA) return [...MOCK_TREATMENTS];
  return [];
}

export async function getTreatmentMedications(treatmentId: string): Promise<TreatmentMedication[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('treatment_medications').select('*').eq('treatment_id', treatmentId);
  if (!error && data) return data as TreatmentMedication[];
  if (USE_MOCK_DATA) return MOCK_TREATMENT_MEDICATIONS.filter((m) => m.treatment_id === treatmentId);
  return [];
}

export async function addToQueue(input: {
  patient_id: string;
  owner_id: string;
  location_id?: string | null;
  department: string;
  priority: 'normal' | 'urgent' | 'emergency';
  reason?: string;
}): Promise<ServiceResponse<PatientQueue>> {
  const supabase = getSupabase();
  const id = `q-${Date.now()}`;
  const now = new Date().toISOString();
  const newEntry: PatientQueue = {
    id,
    patient_id: input.patient_id,
    owner_id: input.owner_id,
    location_id: input.location_id || null,
    department: input.department,
    priority: input.priority,
    status: 'waiting',
    reason: input.reason || null,
    assigned_vet_id: null,
    called_at: null,
    completed_at: null,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase.from('patient_queue').insert(newEntry).select().single();
  if (!error && data) return { success: true, data: data as PatientQueue };
  if (USE_MOCK_DATA) {
    MOCK_PATIENT_QUEUE.unshift(newEntry);
    return { success: true, data: newEntry };
  }
  return { success: false, error: error?.message || 'Failed to add to queue' };
}

export async function updateQueueStatus(
  id: string,
  status: 'waiting' | 'in_consultation' | 'completed' | 'cancelled',
  vetId?: string
): Promise<ServiceResponse<PatientQueue>> {
  const supabase = getSupabase();
  const now = new Date().toISOString();
  const updates: Partial<PatientQueue> = {
    status,
    updated_at: now,
    ...(status === 'in_consultation' ? { called_at: now, assigned_vet_id: vetId || null } : {}),
    ...(status === 'completed' ? { completed_at: now } : {}),
  };

  const { data, error } = await supabase
    .from('patient_queue')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (!error && data) return { success: true, data: data as PatientQueue };
  if (USE_MOCK_DATA) {
    const item = MOCK_PATIENT_QUEUE.find((q) => q.id === id);
    if (item) {
      Object.assign(item, updates);
      return { success: true, data: item };
    }
  }
  return { success: false, error: error?.message || 'Failed to update queue' };
}

export async function createTreatment(input: {
  patient_id: string;
  vet_id?: string | null;
  location_id?: string | null;
  date?: string;
  chief_complaint: string;
  diagnosis: string;
  assessment?: string;
  plan?: string;
  status?: 'ongoing' | 'completed' | 'referred';
  total_cost?: number;
}): Promise<ServiceResponse<Treatment>> {
  const supabase = getSupabase();
  const id = `trt-${Date.now()}`;
  const now = new Date().toISOString();
  const newTx: Treatment = {
    id,
    patient_id: input.patient_id,
    vet_id: input.vet_id || null,
    location_id: input.location_id || null,
    date: input.date || now.slice(0, 10),
    chief_complaint: input.chief_complaint,
    diagnosis: input.diagnosis,
    assessment: input.assessment || null,
    plan: input.plan || null,
    status: input.status || 'ongoing',
    follow_up_date: null,
    total_cost: input.total_cost || 0,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase.from('treatments').insert(newTx).select().single();
  if (!error && data) return { success: true, data: data as Treatment };
  if (USE_MOCK_DATA) {
    MOCK_TREATMENTS.unshift(newTx);
    return { success: true, data: newTx };
  }
  return { success: false, error: error?.message || 'Failed to create treatment' };
}

/* ============================================================
   18.5. BRANCH FINANCIAL INSIGHTS & EXPENSES
   ============================================================ */

export interface AddBranchExpenseInput {
  location_id: string;
  category: 'inventory_purchase' | 'utilities' | 'payroll' | 'maintenance' | 'rent' | 'equipment' | 'fuel' | 'consumables' | 'other';
  amount: number;
  description: string;
  expense_date?: string;
  recorded_by?: string;
  recorder_name?: string;
  vendor_name?: string | null;
  vendor?: string | null;
  payment_method?: 'cash' | 'bank_transfer' | 'pos' | 'check';
  receipt_url?: string | null;
}

export async function getBranchExpenses(locationId?: string): Promise<BranchExpense[]> {
  if (USE_MOCK_DATA) {
    let list = [...MOCK_EXPENSES];
    if (locationId) list = list.filter((e) => e.location_id === locationId);
    return list.sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime());
  }

  const supabase = getSupabase();
  let query = supabase.from('branch_expenses').select('*, location:location_id(name), recorder:recorded_by(full_name)').order('expense_date', { ascending: false });
  if (locationId) query = query.eq('location_id', locationId);
  const { data, error } = await query;
  if (!error && data && data.length > 0) {
    return data.map((d: any) => ({
      ...d,
      location_name: d.location?.name || 'Branch',
      recorder_name: d.recorder?.full_name || 'Staff User',
    }));
  }
  return [...MOCK_EXPENSES];
}

export async function addBranchExpense(input: AddBranchExpenseInput): Promise<ServiceResponse<BranchExpense>> {
  if (!input.location_id) return { success: false, error: 'Location is required' };
  if (!input.amount || input.amount <= 0) return { success: false, error: 'Valid amount is required' };
  if (!input.description.trim()) return { success: false, error: 'Description is required' };

  const expenseDate = input.expense_date || new Date().toISOString().slice(0, 10);
  const vendorVal = input.vendor_name || input.vendor || null;

  // Resolve recorder name from input or users list if available
  let recName = input.recorder_name;
  if (!recName && input.recorded_by) {
    const foundUser = MOCK_USERS.find((u) => u.id === input.recorded_by);
    if (foundUser) recName = `${foundUser.full_name} (${foundUser.role.replace('_', ' ')})`;
  }

  const newExpense: BranchExpense = {
    id: `exp-${Date.now()}`,
    location_id: input.location_id,
    category: input.category,
    amount: input.amount,
    description: input.description.trim(),
    expense_date: expenseDate,
    recorded_by: input.recorded_by || 'System',
    recorder_name: recName || 'Staff Member',
    vendor_name: vendorVal,
    vendor: vendorVal,
    payment_method: input.payment_method || 'bank_transfer',
    receipt_url: input.receipt_url || null,
    created_at: new Date().toISOString(),
  };

  if (USE_MOCK_DATA) {
    MOCK_EXPENSES.unshift(newExpense);
    return { success: true, data: newExpense };
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.from('branch_expenses').insert({
    location_id: input.location_id,
    category: input.category,
    amount: input.amount,
    description: input.description.trim(),
    expense_date: expenseDate,
    recorded_by: input.recorded_by,
  }).select().single();

  if (!error && data) return { success: true, data: data as BranchExpense };
  MOCK_EXPENSES.unshift(newExpense);
  return { success: true, data: newExpense };
}

export async function getBranchFinancialInsights(locationId: string): Promise<ServiceResponse<BranchFinancialInsights>> {
  const supabase = getSupabase();
  const { data: loc } = await supabase.from('locations').select('*').eq('id', locationId).maybeSingle();
  const locName = loc ? loc.name : 'Branch';
  const locType = loc ? loc.type : 'clinic';

  const { data: invoices } = await supabase.from('invoices').select('total').eq('location_id', locationId).in('status', ['paid', 'partial']);
  const totalInflow = (invoices || []).reduce((acc: number, inv: { total: number | null }) => acc + (inv.total || 0), 0);

  const { data: expData } = await supabase.from('branch_expenses').select('category, amount').eq('location_id', locationId);
  const expenses = expData || [];
  const totalExpenses = expenses.reduce((acc: number, e: { category: string; amount: number | null }) => acc + (e.amount || 0), 0);

  const categoryMap: Record<string, number> = {};
  expenses.forEach((e: { category: string; amount: number | null }) => {
    categoryMap[e.category] = (categoryMap[e.category] || 0) + (e.amount || 0);
  });

  const expensesBreakdown = Object.entries(categoryMap).map(([category, amount]) => ({ category, amount }));
  const netMargin = totalInflow - totalExpenses;
  const profitabilityRate = totalInflow > 0 ? Math.round((netMargin / totalInflow) * 100) : 0;

  return {
    success: true,
    data: {
      location_id: locationId,
      location_name: locName,
      location_type: locType,
      total_inflow: totalInflow,
      total_expenditure: totalExpenses,
      expenses_breakdown: expensesBreakdown,
      net_margin: netMargin,
      profitability_rate: profitabilityRate,
    },
  };
}

/* ============================================================
   18.6. ENTERPRISE AUDIT LOG VAULT
   ============================================================ */

export interface GetAuditLogsFilter {
  category?: AuditCategory;
  search?: string;
  limit?: number;
}

export async function getAuditLogs(filter?: GetAuditLogsFilter | AuditCategory): Promise<AuditLog[]> {
  const normFilter: GetAuditLogsFilter | undefined =
    typeof filter === 'string' ? { category: filter } : filter;

  if (USE_MOCK_DATA) {
    let list = [...MOCK_AUDIT_LOGS];
    if (normFilter?.category) list = list.filter((a) => a.category === normFilter.category);
    if (normFilter?.search && typeof normFilter.search === 'string') {
      const q = normFilter.search.toLowerCase();
      list = list.filter(
        (a) =>
          a.action.toLowerCase().includes(q) ||
          a.actor_name?.toLowerCase().includes(q) ||
          a.actor_role.toLowerCase().includes(q) ||
          a.table_name.toLowerCase().includes(q) ||
          JSON.stringify(a.details || {}).toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  const supabase = getSupabase();
  let query = supabase.from('audit_log').select('*, actor:actor_id(full_name, role)').order('created_at', { ascending: false });
  if (normFilter?.limit) query = query.limit(normFilter.limit);
  const { data, error } = await query;
  if (!error && data && data.length > 0) {
    let mapped = data.map((d: any) => ({
      ...d,
      actor_name: d.actor?.full_name || 'System User',
      actor_role: d.actor_role || d.actor?.role || 'user',
      category: (d.table_name === 'payments' || d.table_name === 'invoices' ? 'financial' :
                 d.table_name?.includes('narcotics') ? 'narcotics' :
                 d.table_name?.includes('stock') ? 'inventory' :
                 d.table_name?.includes('auth') ? 'security' :
                 d.table_name?.includes('surg') || d.table_name?.includes('treat') ? 'clinical' : 'system') as AuditCategory,
      severity: (d.action === 'rejected' ? 'warning' : d.details?.discrepancy ? 'critical' : 'info') as AuditSeverity,
    })) as AuditLog[];

    if (normFilter?.category) mapped = mapped.filter((a) => a.category === normFilter.category);
    if (normFilter?.search && typeof normFilter.search === 'string') {
      const q = normFilter.search.toLowerCase();
      mapped = mapped.filter(
        (a) =>
          a.action.toLowerCase().includes(q) ||
          a.actor_name?.toLowerCase().includes(q) ||
          a.actor_role.toLowerCase().includes(q) ||
          a.table_name.toLowerCase().includes(q) ||
          JSON.stringify(a.details || {}).toLowerCase().includes(q)
      );
    }
    return mapped;
  }
  return [...MOCK_AUDIT_LOGS];
}

export async function logAuditEvent(input: {
  table_name?: string;
  record_id?: string;
  entity_type?: string;
  entity_id?: string;
  action: string;
  actor_id?: string;
  actor_name?: string;
  actor_role?: string;
  user_id?: string;
  user_name?: string;
  category?: AuditCategory;
  severity?: AuditSeverity;
  details?: Record<string, any>;
  ip_address?: string | null;
}): Promise<ServiceResponse<AuditLog>> {
  const tableName = input.table_name || input.entity_type || 'general';
  const recordId = input.record_id || input.entity_id || `rec-${Date.now()}`;
  const actorId = input.actor_id || input.user_id || 'system';
  const actorName = input.actor_name || input.user_name || 'System User';
  const actorRole = input.actor_role || 'user';

  const newEntry: AuditLog = {
    id: `audit-${Date.now()}`,
    table_name: tableName,
    record_id: recordId,
    entity_type: tableName,
    entity_id: recordId,
    action: input.action,
    actor_id: actorId,
    actor_name: actorName,
    actor_role: actorRole,
    user_id: actorId,
    user_name: actorName,
    category: input.category || 'system',
    severity: input.severity || 'info',
    details: input.details || null,
    ip_address: input.ip_address || null,
    created_at: new Date().toISOString(),
  };

  if (USE_MOCK_DATA) {
    MOCK_AUDIT_LOGS.unshift(newEntry);
    return { success: true, data: newEntry };
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.from('audit_log').insert({
    table_name: input.table_name,
    record_id: input.record_id,
    action: input.action,
    actor_id: input.actor_id,
    actor_role: input.actor_role,
    details: input.details,
  }).select().single();

  if (!error && data) {
    return { success: true, data: { ...newEntry, ...data } };
  }
  MOCK_AUDIT_LOGS.unshift(newEntry);
  return { success: true, data: newEntry };
}

/* ============================================================
   18.7. CLINIC SHIFTS & DUTY ROSTER
   ============================================================ */

export async function getClinicShifts(locationId?: string): Promise<ClinicShift[]> {
  if (USE_MOCK_DATA) {
    let list = [...MOCK_SHIFTS];
    if (locationId) list = list.filter((s) => s.location_id === locationId);
    return list.sort((a, b) => new Date(a.shift_date).getTime() - new Date(b.shift_date).getTime());
  }

  const supabase = getSupabase();
  let query = supabase.from('clinic_shifts').select('*').order('shift_date');
  if (locationId) query = query.eq('location_id', locationId);
  const { data, error } = await query;
  if (!error && data && data.length > 0) return data as ClinicShift[];
  return [...MOCK_SHIFTS];
}

export async function assignClinicShift(input: {
  user_id: string;
  staff_name?: string;
  role?: string;
  location_id: string;
  location_name?: string;
  shift_date: string;
  shift_block: ShiftBlock;
  start_time: string;
  end_time: string;
  notes?: string | null;
}): Promise<ServiceResponse<ClinicShift>> {
  if (!input.user_id) return { success: false, error: 'Staff member is required' };
  if (!input.shift_date) return { success: false, error: 'Date is required' };

  const newShift: ClinicShift = {
    id: `shift-${Date.now()}`,
    user_id: input.user_id,
    staff_name: input.staff_name || 'Staff Member',
    role: input.role || 'clinical_staff',
    location_id: input.location_id,
    location_name: input.location_name || 'Clinic',
    shift_date: input.shift_date,
    shift_block: input.shift_block,
    start_time: input.start_time,
    end_time: input.end_time,
    notes: input.notes?.trim() || null,
    created_at: new Date().toISOString(),
  };

  MOCK_SHIFTS.push(newShift);
  return { success: true, data: newShift };
}

export async function deleteClinicShift(id: string): Promise<ServiceResponse> {
  const idx = MOCK_SHIFTS.findIndex((s) => s.id === id);
  if (idx !== -1) {
    MOCK_SHIFTS.splice(idx, 1);
    return { success: true };
  }
  return { success: true };
}

/* ============================================================
   18.8. PREVENTIVE CARE & PATIENT RECALLS
   ============================================================ */

export async function getPatientReminders(status?: ReminderStatus): Promise<PatientReminder[]> {
  if (USE_MOCK_DATA) {
    let list = [...MOCK_REMINDERS];
    if (status) list = list.filter((r) => r.status === status);
    return list.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  }

  const supabase = getSupabase();
  let query = supabase.from('patient_reminders').select('*').order('due_date');
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (!error && data && data.length > 0) return data as PatientReminder[];
  return [...MOCK_REMINDERS];
}

export async function createPatientReminder(input: {
  patient_id: string;
  patient_name?: string;
  owner_id?: string;
  owner_name?: string;
  owner_phone?: string;
  species?: string;
  reminder_type: ReminderType;
  title: string;
  due_date: string;
  notes?: string | null;
}): Promise<ServiceResponse<PatientReminder>> {
  if (!input.patient_id) return { success: false, error: 'Patient is required' };
  if (!input.title.trim()) return { success: false, error: 'Reminder title is required' };
  if (!input.due_date) return { success: false, error: 'Due date is required' };

  const newReminder: PatientReminder = {
    id: `rem-${Date.now()}`,
    patient_id: input.patient_id,
    patient_name: input.patient_name || 'Pet',
    owner_id: input.owner_id,
    owner_name: input.owner_name,
    owner_phone: input.owner_phone,
    species: input.species || 'Dog',
    reminder_type: input.reminder_type,
    title: input.title.trim(),
    due_date: input.due_date,
    status: 'pending',
    notes: input.notes?.trim() || null,
    last_notified_at: null,
    created_at: new Date().toISOString(),
  };

  MOCK_REMINDERS.push(newReminder);
  return { success: true, data: newReminder };
}

export async function updatePatientReminderStatus(
  id: string,
  status: ReminderStatus
): Promise<ServiceResponse<PatientReminder>> {
  const idx = MOCK_REMINDERS.findIndex((r) => r.id === id);
  if (idx !== -1) {
    MOCK_REMINDERS[idx] = {
      ...MOCK_REMINDERS[idx],
      status,
      last_notified_at: status === 'sent' ? new Date().toISOString() : MOCK_REMINDERS[idx].last_notified_at,
    };
    return { success: true, data: MOCK_REMINDERS[idx] };
  }
  return { success: false, error: 'Reminder not found' };
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
  MOCK_LAB_ORDERS,
  MOCK_HOSPITALIZATIONS,
  MOCK_SURGERIES,
  MOCK_CASH_RECONCILIATIONS,
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

/* ============================================================
   20. CLINICAL SPECIALTY OPERATIONS & CALCULATORS
   ============================================================ */

/* ── Diagnostic Lab Hub ── */

export async function getLabOrders(): Promise<LabOrder[]> {
  const supabase = getSupabase();
  const { data } = await supabase.from('lab_orders').select('*').order('collected_at', { ascending: false });
  if (data && data.length > 0) return data as LabOrder[];
  return [...MOCK_LAB_ORDERS];
}

export async function createLabOrder(input: Omit<LabOrder, 'id' | 'order_number' | 'collected_at'>): Promise<ServiceResponse<LabOrder>> {
  const newOrder: LabOrder = {
    ...input,
    id: `lab-${Date.now()}`,
    order_number: `LAB-${new Date().getFullYear()}-${String(MOCK_LAB_ORDERS.length + 1).padStart(3, '0')}`,
    collected_at: new Date().toISOString(),
  };

  const supabase = getSupabase();
  const { data, error } = await supabase.from('lab_orders').insert(newOrder).select().single();
  if (!error && data) return { success: true, data: data as LabOrder };

  if (USE_MOCK_DATA) {
    MOCK_LAB_ORDERS.unshift(newOrder);
  }
  return { success: true, data: newOrder };
}

export async function updateLabOrderStatus(
  id: string,
  status: LabStatus,
  results?: LabResultParameter[],
  pathology_summary?: string,
  reviewed_by?: string
): Promise<ServiceResponse<LabOrder>> {
  const supabase = getSupabase();
  const updates: Partial<LabOrder> = {
    status,
    ...(results ? { results } : {}),
    ...(pathology_summary ? { pathology_summary } : {}),
    ...(reviewed_by ? { reviewed_by } : {}),
    ...(status === 'ready' || status === 'reviewed' ? { completed_at: new Date().toISOString() } : {}),
  };

  await supabase.from('lab_orders').update(updates).eq('id', id);

  if (USE_MOCK_DATA) {
    const order = MOCK_LAB_ORDERS.find((o) => o.id === id);
    if (order) {
      Object.assign(order, updates);
      return { success: true, data: order };
    }
  }
  return { success: true };
}

/* ── Inpatient ICU & Hospitalization ── */

export async function getHospitalizations(): Promise<HospitalizationRecord[]> {
  const supabase = getSupabase();
  const { data } = await supabase.from('hospitalizations').select('*').order('admission_date', { ascending: false });
  if (data && data.length > 0) return data as HospitalizationRecord[];
  return [...MOCK_HOSPITALIZATIONS];
}

export async function admitToHospital(
  input: Omit<HospitalizationRecord, 'id' | 'admission_date' | 'vitals'>
): Promise<ServiceResponse<HospitalizationRecord>> {
  const newRecord: HospitalizationRecord = {
    ...input,
    id: `hosp-${Date.now()}`,
    admission_date: new Date().toISOString(),
    vitals: [],
  };

  const supabase = getSupabase();
  const { data, error } = await supabase.from('hospitalizations').insert(newRecord).select().single();
  if (!error && data) return { success: true, data: data as HospitalizationRecord };

  if (USE_MOCK_DATA) {
    MOCK_HOSPITALIZATIONS.unshift(newRecord);
  }
  return { success: true, data: newRecord };
}

export async function addICUVital(
  hospId: string,
  vital: Omit<ICUVitalEntry, 'id' | 'timestamp'>
): Promise<ServiceResponse<ICUVitalEntry>> {
  const newVital: ICUVitalEntry = {
    ...vital,
    id: `vit-${Date.now()}`,
    timestamp: new Date().toISOString(),
  };

  const supabase = getSupabase();
  await supabase.from('icu_vitals').insert({ ...newVital, hospitalization_id: hospId });

  if (USE_MOCK_DATA) {
    const hosp = MOCK_HOSPITALIZATIONS.find((h) => h.id === hospId);
    if (hosp) {
      hosp.vitals.push(newVital);
      return { success: true, data: newVital };
    }
  }
  return { success: true, data: newVital };
}

export async function dischargeHospitalization(
  hospId: string,
  summary: string
): Promise<ServiceResponse<HospitalizationRecord>> {
  const updates = {
    status: 'discharged' as const,
    discharge_date: new Date().toISOString(),
    discharge_summary: summary,
  };

  const supabase = getSupabase();
  await supabase.from('hospitalizations').update(updates).eq('id', hospId);

  if (USE_MOCK_DATA) {
    const hosp = MOCK_HOSPITALIZATIONS.find((h) => h.id === hospId);
    if (hosp) {
      Object.assign(hosp, updates);
      return { success: true, data: hosp };
    }
  }
  return { success: true };
}

/* ── Surgical Suite ── */

export async function getSurgeries(): Promise<SurgeryRecord[]> {
  const supabase = getSupabase();
  const { data } = await supabase.from('surgeries').select('*').order('scheduled_date', { ascending: false });
  if (data && data.length > 0) return data as SurgeryRecord[];
  return [...MOCK_SURGERIES];
}

export async function createSurgery(
  input: Omit<SurgeryRecord, 'id' | 'surgery_number'>
): Promise<ServiceResponse<SurgeryRecord>> {
  const newSurgery: SurgeryRecord = {
    ...input,
    id: `surg-${Date.now()}`,
    surgery_number: `SURG-${new Date().getFullYear()}-${String(MOCK_SURGERIES.length + 1).padStart(3, '0')}`,
  };

  const supabase = getSupabase();
  const { data, error } = await supabase.from('surgeries').insert(newSurgery).select().single();
  if (!error && data) return { success: true, data: data as SurgeryRecord };

  if (USE_MOCK_DATA) {
    MOCK_SURGERIES.unshift(newSurgery);
  }
  return { success: true, data: newSurgery };
}

export async function updateSurgeryStatus(
  id: string,
  status: SurgeryStatus,
  notes?: string
): Promise<ServiceResponse<SurgeryRecord>> {
  const updates: Partial<SurgeryRecord> = { status, ...(notes ? { surgical_notes: notes } : {}) };

  const supabase = getSupabase();
  await supabase.from('surgeries').update(updates).eq('id', id);

  if (USE_MOCK_DATA) {
    const surgery = MOCK_SURGERIES.find((s) => s.id === id);
    if (surgery) {
      Object.assign(surgery, updates);
      return { success: true, data: surgery };
    }
  }
  return { success: true };
}

/* ── Cash Reconciliation ── */

export async function getCashReconciliations(): Promise<CashReconciliation[]> {
  const supabase = getSupabase();
  const { data } = await supabase.from('cash_reconciliations').select('*').order('created_at', { ascending: false });
  if (data && data.length > 0) return data as CashReconciliation[];
  return [...MOCK_CASH_RECONCILIATIONS];
}

export async function submitCashReconciliation(
  input: Omit<CashReconciliation, 'id' | 'created_at' | 'total_expected' | 'total_actual' | 'variance' | 'status'>
): Promise<ServiceResponse<CashReconciliation>> {
  const total_expected = input.cash_expected + input.pos_card_expected + input.bank_transfer_expected;
  const total_actual = input.cash_actual + input.pos_card_actual + input.bank_transfer_actual;
  const variance = total_actual - total_expected;
  const status = variance === 0 ? 'balanced' : 'discrepancy';

  const newRec: CashReconciliation = {
    ...input,
    id: `rec-${Date.now()}`,
    total_expected,
    total_actual,
    variance,
    status,
    created_at: new Date().toISOString(),
  };

  const supabase = getSupabase();
  const { data, error } = await supabase.from('cash_reconciliations').insert(newRec).select().single();
  if (!error && data) return { success: true, data: data as CashReconciliation };

  if (USE_MOCK_DATA) {
    MOCK_CASH_RECONCILIATIONS.unshift(newRec);
  }
  return { success: true, data: newRec };
}

/* ── Clinical Calculators Math ── */

/**
 * Calculates standard veterinary medication dosage volume in mL.
 * Volume (mL) = (Weight in kg × Dose in mg/kg) ÷ Drug Concentration in mg/mL
 */
export function calculateDrugDose(
  weightKg: number,
  doseMgKg: number,
  concentrationMgMl: number
): DrugDoseResult {
  const totalDoseMg = Number((weightKg * doseMgKg).toFixed(2));
  const volumeMl = concentrationMgMl > 0 ? Number((totalDoseMg / concentrationMgMl).toFixed(2)) : 0;
  return {
    weightKg,
    doseMgKg,
    totalDoseMg,
    concentrationMgMl,
    volumeMl,
  };
}

/**
 * Calculates 24-hour veterinary fluid therapy requirement.
 * Maintenance (approx 50-60 mL/kg/day) + Dehydration deficit (Weight in kg × Dehydration % × 1000 mL) + Ongoing losses
 */
export function calculateFluidRate(
  weightKg: number,
  dehydrationPct: number = 0,
  ongoingLossesMl: number = 0
): FluidRateResult {
  const maintenanceMlDay = Math.round(weightKg * 55); // standard 55 mL/kg/day
  const dehydrationDeficitMl = Math.round(weightKg * (dehydrationPct / 100) * 1000);
  const total24hMl = maintenanceMlDay + dehydrationDeficitMl + ongoingLossesMl;
  const hourlyRateMlHr = Number((total24hMl / 24).toFixed(1));
  // Assuming standard 20 drops/mL IV infusion set
  const dropsPerMinute = Math.round((hourlyRateMlHr * 20) / 60);

  return {
    weightKg,
    maintenanceMlDay,
    dehydrationDeficitMl,
    ongoingLossesMlDay: ongoingLossesMl,
    total24hMl,
    hourlyRateMlHr,
    dropsPerMinute,
  };
}

/* ============================================================
   26. STAFF REQUESTS PORTAL
   ============================================================ */
export async function getStaffRequests(userId?: string, userRole?: UserRole): Promise<StaffRequest[]> {
  if (USE_MOCK_DATA) {
    let list = [...MOCK_STAFF_REQUESTS];
    const isManager = ['super_admin', 'ceo', 'inventory_manager', 'clinic_admin', 'finance_manager'].includes(userRole || '');
    if (!isManager && userId) {
      list = list.filter((r) => r.user_id === userId);
    }
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  const supabase = getSupabase();
  let query = supabase.from('staff_requests').select('*').order('created_at', { ascending: false });
  const isManager = ['super_admin', 'ceo', 'inventory_manager', 'clinic_admin', 'finance_manager'].includes(userRole || '');
  if (!isManager && userId) {
    query = query.eq('user_id', userId);
  }
  const { data, error } = await query;
  if (!error && data) return data as StaffRequest[];
  return [...MOCK_STAFF_REQUESTS];
}

export interface CreateStaffRequestInput {
  user_id: string;
  user_name: string;
  user_role: UserRole;
  location_id?: string | null;
  location_name?: string | null;
  type: StaffRequestType;
  title: string;
  details: StaffRequest['details'];
}

export async function createStaffRequest(input: CreateStaffRequestInput): Promise<ServiceResponse<StaffRequest>> {
  if (!input.title.trim()) return { success: false, error: 'Request title is required' };
  if (!input.details.reason.trim()) return { success: false, error: 'Reason/details are required' };

  const newReq: StaffRequest = {
    id: `req-${Date.now()}`,
    user_id: input.user_id,
    user_name: input.user_name,
    user_role: input.user_role,
    location_id: input.location_id,
    location_name: input.location_name,
    type: input.type,
    title: input.title.trim(),
    details: input.details,
    status: 'pending',
    created_at: new Date().toISOString(),
  };

  if (USE_MOCK_DATA) {
    MOCK_STAFF_REQUESTS.unshift(newReq);
    return { success: true, data: newReq };
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.from('staff_requests').insert(newReq).select().single();
  if (!error && data) return { success: true, data: data as StaffRequest };
  MOCK_STAFF_REQUESTS.unshift(newReq);
  return { success: true, data: newReq };
}

export async function updateStaffRequestStatus(
  id: string,
  status: StaffRequestStatus,
  reviewerId: string,
  reviewerName: string,
  reviewNotes?: string
): Promise<ServiceResponse<StaffRequest>> {
  const req = MOCK_STAFF_REQUESTS.find((r) => r.id === id);
  if (!req) return { success: false, error: 'Request not found' };

  req.status = status;
  req.reviewed_by = reviewerId;
  req.reviewer_name = reviewerName;
  req.reviewed_at = new Date().toISOString();
  req.review_notes = reviewNotes || null;

  if (status === 'approved') {
    if (req.type === 'restock' && req.details.product_id && req.details.quantity && req.location_id) {
      const existing = MOCK_INVENTORY.find((i) => i.product_id === req.details.product_id && i.location_id === req.location_id);
      if (existing) {
        existing.quantity += req.details.quantity;
      } else {
        MOCK_INVENTORY.push({
          id: `inv-${Date.now()}`,
          product_id: req.details.product_id,
          location_id: req.location_id,
          batch_number: req.details.batch_number || `BATCH-${new Date().getFullYear()}`,
          quantity: req.details.quantity,
          expiry_date: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
          status: 'in_stock',
        });
      }
    } else if (req.type === 'return' && req.details.product_id && req.details.quantity && req.location_id) {
      const existing = MOCK_INVENTORY.find((i) => i.product_id === req.details.product_id && i.location_id === req.location_id);
      if (existing) {
        existing.quantity = Math.max(0, existing.quantity - req.details.quantity);
      }
    }
  }

  const supabase = getSupabase();
  await supabase.from('staff_requests').update({
    status,
    reviewed_by: reviewerId,
    reviewer_name: reviewerName,
    reviewed_at: req.reviewed_at,
    review_notes: req.review_notes,
  }).eq('id', id);

  return { success: true, data: req };
}

/* ============================================================
   27. ANNOUNCEMENTS
   ============================================================ */
export async function getAnnouncements(userRole?: UserRole, locationId?: string | null): Promise<Announcement[]> {
  if (USE_MOCK_DATA) {
    let list = [...MOCK_ANNOUNCEMENTS];
    if (userRole && userRole !== 'super_admin' && userRole !== 'ceo') {
      list = list.filter((a) => a.scope === 'all' || (a.scope === 'clinic' && a.location_id === locationId));
    }
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
  if (!error && data) return data as Announcement[];
  return [...MOCK_ANNOUNCEMENTS];
}

export interface CreateAnnouncementInput {
  title: string;
  message: string;
  scope: AnnouncementScope;
  location_id?: string | null;
  location_name?: string | null;
  author_id: string;
  author_name: string;
  author_role: UserRole;
  priority: AnnouncementPriority;
}

export async function createAnnouncement(input: CreateAnnouncementInput): Promise<ServiceResponse<Announcement>> {
  if (!input.title.trim()) return { success: false, error: 'Title is required' };
  if (!input.message.trim()) return { success: false, error: 'Message content is required' };

  const newAnn: Announcement = {
    id: `ann-${Date.now()}`,
    title: input.title.trim(),
    message: input.message.trim(),
    scope: input.scope,
    location_id: input.location_id || null,
    location_name: input.location_name || null,
    author_id: input.author_id,
    author_name: input.author_name,
    author_role: input.author_role,
    priority: input.priority,
    created_at: new Date().toISOString(),
  };

  if (USE_MOCK_DATA) {
    MOCK_ANNOUNCEMENTS.unshift(newAnn);
    return { success: true, data: newAnn };
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.from('announcements').insert(newAnn).select().single();
  if (!error && data) return { success: true, data: data as Announcement };
  MOCK_ANNOUNCEMENTS.unshift(newAnn);
  return { success: true, data: newAnn };
}

/* ============================================================
   28. PRODUCT RECALL & PRICE BATCH EDITOR
   ============================================================ */
export async function recallProductBatch(
  batchNumber: string,
  reason: string,
  recalledBy: string
): Promise<ServiceResponse<{ affectedCount: number }>> {
  if (!batchNumber.trim()) return { success: false, error: 'Batch number is required' };
  
  let count = 0;
  for (const item of MOCK_INVENTORY) {
    if (item.batch_number.toLowerCase() === batchNumber.toLowerCase().trim()) {
      item.status = 'expired';
      count += item.quantity;
    }
  }

  MOCK_AUDIT_LOGS.unshift({
    id: `aud-${Date.now()}`,
    table_name: 'inventory',
    record_id: batchNumber,
    action: 'PRODUCT_RECALL_INITIATED',
    actor_id: recalledBy,
    actor_name: 'Inventory Operations',
    actor_role: 'inventory_manager',
    category: 'inventory',
    severity: 'critical',
    details: { batchNumber, reason, quarantinedUnits: count },
    created_at: new Date().toISOString(),
  });

  return { success: true, data: { affectedCount: count } };
}

export async function batchUpdateProductPrices(
  updates: Array<{ productId: string; newPrice: number }>
): Promise<ServiceResponse> {
  if (!updates.length) return { success: false, error: 'No updates provided' };

  for (const up of updates) {
    const prod = MOCK_PRODUCTS.find((p) => p.id === up.productId);
    if (prod && up.newPrice > 0) {
      prod.unit_price = up.newPrice;
    }
  }
  return { success: true };
}

/* ============================================================
   29. FINANCIAL & SALARY ADJUSTMENTS
   ============================================================ */
export async function applyCompensationAdjustment(
  employeeId: string,
  type: 'increase' | 'reduction' | 'bonus' | 'incentive',
  amount: number,
  reason: string,
  appliedBy: string
): Promise<ServiceResponse> {
  if (!employeeId) return { success: false, error: 'Employee is required' };
  if (!amount || amount <= 0) return { success: false, error: 'Valid amount is required' };
  if (!reason.trim()) return { success: false, error: 'Reason is required' };

  const salary = MOCK_SALARIES.find((s) => s.user_id === employeeId);
  if (salary) {
    if (type === 'increase') {
      salary.basic_salary += amount;
      salary.total_gross += amount;
      salary.net_pay += amount;
    } else if (type === 'reduction') {
      const reduction = Math.min(amount, Math.max(0, salary.basic_salary - 30000));
      salary.basic_salary -= reduction;
      salary.total_gross -= reduction;
      salary.net_pay -= reduction;
    } else if (type === 'bonus' || type === 'incentive') {
      salary.custom_additions = salary.custom_additions || [];
      salary.custom_additions.push({
        id: `adj-${Date.now()}`,
        label: `${type === 'bonus' ? 'Performance Bonus' : 'Sales Incentive'} - ${reason}`,
        type: 'flat',
        value: amount,
        amount,
      });
      salary.total_gross += amount;
      salary.net_pay += amount;
    }
    salary.updated_at = new Date().toISOString();
  }

  MOCK_AUDIT_LOGS.unshift({
    id: `aud-${Date.now()}`,
    table_name: 'salaries',
    record_id: employeeId,
    action: `COMPENSATION_ADJUSTMENT_${type.toUpperCase()}`,
    actor_id: appliedBy,
    actor_name: 'Finance Controller',
    actor_role: 'finance_manager',
    category: 'financial',
    severity: 'warning',
    details: { employeeId, type, amount, reason },
    created_at: new Date().toISOString(),
  });

  return { success: true };
}


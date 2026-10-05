/**
 * @file use-supabase-data.ts — React hooks for Supabase data operations
 *
 * Provides hooks for each entity (products, customers, invoices, payments,
 * inventory) that handle loading, error states, and CRUD operations against
 * the live Supabase database.
 *
 * Each hook returns: { data, loading, error, refetch, ...mutations }
 *
 * Why hooks instead of plain functions?
 *   - Supabase queries are async — React needs state management for loading/data
 *   - Hooks encapsulate the fetch-on-mount + refetch-after-mutation pattern
 *   - Pages only need to swap one line: `const { products } = useProducts()`
 *
 * @module hooks/use-supabase-data
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { clientCache } from '@/lib/cache';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseMockMode, isSupabaseConfigured } from '@/lib/supabase/config';
import type {
  SupabaseClient,
  RealtimePostgresInsertPayload,
  RealtimePostgresUpdatePayload,
} from '@supabase/supabase-js';
import type {
  Product, Customer, Invoice, InvoiceItem,
  Payment, InventoryItem, Location, User, ChatMessage,
  SalaryGrade, PayrollRun, Payslip,
  LeaveRequest, AttendanceLog,
  EmployeeDocument, PerformanceTarget, PerformanceReview,
  LeaveType, DocumentType, TargetType, Supplier,
  PatientWithOwner, AppointmentWithRelations, PatientQueueWithRelations,
  TreatmentWithRelations, VetService, StockMovementWithRelations,
  ClinicClient,
  LabOrder, HospitalizationRecord, ICUVitalEntry, SurgeryRecord, CashReconciliation,
  BranchExpense, AuditLog, AuditCategory,
  ClinicShift, PatientReminder, ReminderStatus,
  StaffRequest, StaffRequestType, StaffRequestStatus, Announcement,
  NarcoticLog,
} from '@/lib/types';
import { transitionInvoice as dataTransitionInvoice } from '@/lib/data-service';
import {
  MOCK_USERS,
  MOCK_LOCATIONS,
  MOCK_PRODUCTS,
  MOCK_CUSTOMERS,
  MOCK_INVOICES,
  MOCK_PAYMENTS,
  MOCK_INVENTORY,
  MOCK_SALARY_GRADES,
  MOCK_PAYROLL_RUNS,
  MOCK_PAYSLIPS,
  MOCK_LEAVE_REQUESTS,
  MOCK_ATTENDANCE_LOGS,
  MOCK_EMPLOYEE_DOCUMENTS,
  MOCK_PERFORMANCE_TARGETS,
  MOCK_PERFORMANCE_REVIEWS,
  MOCK_SUPPLIERS,
  MOCK_LAB_ORDERS,
  MOCK_HOSPITALIZATIONS,
  MOCK_SURGERIES,
  MOCK_CASH_RECONCILIATIONS,
  MOCK_CHAT_MESSAGES,
} from '@/lib/mock-data';

const USE_MOCK_DATA = isSupabaseMockMode() || !isSupabaseConfigured();

/* ── Supabase client singleton for this module ── */
function getSupabase(): SupabaseClient {
  return createClient();
}

/** `chat_messages` row with an index signature so it can serve as a
 *  RealtimePostgres*Payload row type (`T extends { [key: string]: any }`). */
type ChatRow = ChatMessage & { [key: string]: unknown };

/* ═══════════════════════════════════════════════════════════════
   PRODUCTS
   ═══════════════════════════════════════════════════════════════ */

export interface AddProductInput {
  name: string;
  sku: string;
  nafdac_number?: string;
  unit_price: number;
  category?: string;
  description?: string;
}

export function useProducts(fetchInactive: boolean = false) {
  const cacheKey = `products_${fetchInactive}`;
  const [products, setProducts] = useState<Product[]>(() => clientCache.get<Product[]>(cacheKey) || []);
  const [loading, setLoading] = useState(() => !clientCache.has(cacheKey));

  const refetch = useCallback(async () => {
    let query = getSupabase().from('products').select('*');
    if (!fetchInactive) {
      query = query.eq('is_active', true);
    }
    const { data, error } = await query.order('name');

    const fresh = (!error && data && data.length > 0)
      ? (data as Product[])
      : USE_MOCK_DATA
      ? (fetchInactive ? MOCK_PRODUCTS : MOCK_PRODUCTS.filter((p) => p.is_active !== false))
      : [];
    clientCache.set(cacheKey, fresh);
    setProducts(fresh);
    setLoading(false);
  }, [fetchInactive, cacheKey]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refetch]);

  const addProduct = useCallback(async (input: AddProductInput) => {
    const { data, error } = await getSupabase()
      .from('products')
      .insert({
        name: input.name,
        sku: input.sku,
        nafdac_number: input.nafdac_number || null,
        unit_price: input.unit_price,
        category: input.category || null,
        description: input.description || null,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    clientCache.invalidate('products');
    await refetch();
    return { success: true, data: data as Product };
  }, [refetch]);

  return { products, loading, refetch, addProduct };
}

/* ═══════════════════════════════════════════════════════════════
   CUSTOMERS
   ═══════════════════════════════════════════════════════════════ */

export interface AddCustomerInput {
  name: string;
  business_name: string;
  phone: string;
  email?: string;
  address: string;
  state: string;
  credit_limit: number;
  location_id: string;
}

export function useCustomers(fetchInactive: boolean = false) {
  const cacheKey = `customers_${fetchInactive}`;
  const [customers, setCustomers] = useState<Customer[]>(() => clientCache.get<Customer[]>(cacheKey) || []);
  const [loading, setLoading] = useState(() => !clientCache.has(cacheKey));

  const refetch = useCallback(async () => {
    let query = getSupabase().from('customers').select('*');
    if (!fetchInactive) {
      query = query.eq('is_active', true);
    }
    const { data, error } = await query.order('business_name');

    const fresh = (!error && data && data.length > 0)
      ? (data as Customer[])
      : USE_MOCK_DATA
      ? (fetchInactive ? MOCK_CUSTOMERS : MOCK_CUSTOMERS.filter((c) => c.is_active !== false))
      : [];
    clientCache.set(cacheKey, fresh);
    setCustomers(fresh);
    setLoading(false);
  }, [fetchInactive, cacheKey]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refetch]);

  const addCustomer = useCallback(async (input: AddCustomerInput) => {
    if (USE_MOCK_DATA) {
      const mockCust: Customer = {
        id: `cust-mock-${Date.now()}`,
        name: input.name,
        business_name: input.business_name,
        phone: input.phone,
        email: input.email || null,
        address: input.address,
        state: input.state,
        credit_limit: input.credit_limit,
        outstanding_balance: 0,
        location_id: input.location_id,
        is_active: true,
      };
      MOCK_CUSTOMERS.unshift(mockCust);
      clientCache.invalidate('customers');
      await refetch();
      return { success: true, data: mockCust };
    }

    const { data: { user } } = await getSupabase().auth.getUser();
    const { data, error } = await getSupabase()
      .from('customers')
      .insert({
        ...input,
        email: input.email || null,
        outstanding_balance: 0,
        created_by: user?.id || null,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    clientCache.invalidate('customers');
    await refetch();
    return { success: true, data: data as Customer };
  }, [refetch]);

  return { customers, loading, refetch, addCustomer };
}

/* ═══════════════════════════════════════════════════════════════
   INVOICES
   ═══════════════════════════════════════════════════════════════ */

export interface InvoiceLineInput {
  product_id: string;
  quantity: number;
}

export interface CreateInvoiceInput {
  customer_id: string;
  items: InvoiceLineInput[];
  due_date: string;
  vat_rate?: number;
  discount_type?: 'percent' | 'fixed';
  discount_value?: number;
}

export function useInvoices() {
  const cacheKey = 'invoices';
  const [invoices, setInvoices] = useState<Invoice[]>(() => clientCache.get<Invoice[]>(cacheKey) || []);
  const [loading, setLoading] = useState(() => !clientCache.has(cacheKey));

  const refetch = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from('invoices')
      .select('*, invoice_items(*)')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      const mapped = data.map((inv: Record<string, unknown>) => ({
        ...inv,
        items: (inv.invoice_items as InvoiceItem[]) || [],
      })) as Invoice[];
      clientCache.set(cacheKey, mapped);
      setInvoices(mapped);
    } else if (USE_MOCK_DATA) {
      const mock = [...MOCK_INVOICES];
      clientCache.set(cacheKey, mock);
      setInvoices(mock);
    } else {
      clientCache.set(cacheKey, []);
      setInvoices([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refetch]);

  const createInvoice = useCallback(async (
    input: CreateInvoiceInput,
    products: Product[],
    userId: string,
    locationId: string,
  ) => {
    /* Calculate totals from line items */
    const items = input.items.map((line) => {
      const product = products.find((p) => p.id === line.product_id);
      return {
        product_id: line.product_id,
        product_name: product?.name || 'Unknown',
        quantity: line.quantity,
        unit_price: product?.unit_price || 0,
        total: (product?.unit_price || 0) * line.quantity,
      };
    });

    const subtotal = items.reduce((sum, i) => sum + i.total, 0);
    const vatRate = typeof input.vat_rate === 'number' ? input.vat_rate : 7.5;
    const vatAmount = Math.round(subtotal * (vatRate / 100));

    let discountAmount = 0;
    if (input.discount_type === 'percent' && input.discount_value) {
      discountAmount = Math.round(subtotal * (input.discount_value / 100));
    } else if (input.discount_type === 'fixed' && input.discount_value) {
      discountAmount = Math.min(subtotal, Math.round(input.discount_value));
    }

    const total = Math.max(0, subtotal + vatAmount - discountAmount);

    /* Generate invoice number: INV-YYYY-XXXXX (timestamp-based, no race) */
    const year = new Date().getFullYear();
    const seq = Date.now().toString(36).toUpperCase().slice(-5);
    const invoiceNumber = `INV-${year}-${seq}`;

    if (USE_MOCK_DATA) {
      const mockInvId = `inv-mock-${Date.now()}`;
      const lineItems: InvoiceItem[] = items.map((it, idx) => ({
        id: `inv-item-${Date.now()}-${idx}`,
        ...it,
      }));
      const mockInv: Invoice = {
        id: mockInvId,
        invoice_number: invoiceNumber,
        customer_id: input.customer_id,
        sales_rep_id: userId,
        location_id: locationId,
        subtotal,
        vat: vatAmount,
        vat_rate: vatRate,
        discount_type: input.discount_type,
        discount_value: input.discount_value,
        discount_amount: discountAmount,
        total,
        status: 'draft',
        created_at: new Date().toISOString(),
        due_date: input.due_date,
        items: lineItems,
      };
      MOCK_INVOICES.unshift(mockInv);
      clientCache.invalidate('invoices');
      await refetch();
      return { success: true, data: mockInv };
    }

    /* Insert the invoice header */
    const { data: invData, error: invError } = await getSupabase()
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        customer_id: input.customer_id,
        sales_rep_id: userId,
        location_id: locationId,
        subtotal,
        vat: vatAmount,
        vat_rate: vatRate,
        discount_type: input.discount_type,
        discount_value: input.discount_value,
        discount_amount: discountAmount,
        total,
        status: 'draft',
        due_date: input.due_date,
      })
      .select()
      .single();

    if (invError || !invData) {
      return { success: false, error: invError?.message || 'Failed to create invoice' };
    }

    /* Insert line items */
    const lineItems = items.map((item) => ({
      invoice_id: invData.id,
      ...item,
    }));

    const { error: itemsError } = await getSupabase()
      .from('invoice_items')
      .insert(lineItems);

    if (itemsError) {
      // Clean up orphaned invoice header to prevent ghost invoices
      await getSupabase().from('invoices').delete().eq('id', invData.id);
      return { success: false, error: itemsError.message };
    }

    clientCache.invalidate('invoices');
    await refetch();
    return { success: true, data: { ...invData, items: lineItems } as Invoice };
  }, [refetch]);

  const updateInvoiceStatus = useCallback(async (invoiceId: string, status: string) => {
    const result = await dataTransitionInvoice(invoiceId, status);
    if (!result.success) return result;
    clientCache.invalidate('invoices');
    await refetch();
    return { success: true };
  }, [refetch]);

  return { invoices, loading, refetch, createInvoice, updateInvoiceStatus };
}

/* ═══════════════════════════════════════════════════════════════
   PAYMENTS
   ═══════════════════════════════════════════════════════════════ */

export interface RecordPaymentInput {
  customer_id: string;
  invoice_id?: string;
  amount: number;
  method: 'cash' | 'bank_transfer';
  proof_url?: string | null;
  notes?: string;
}

export function usePayments() {
  const cacheKey = 'payments';
  const [payments, setPayments] = useState<Payment[]>(() => clientCache.get<Payment[]>(cacheKey) || []);
  const [loading, setLoading] = useState(() => !clientCache.has(cacheKey));

  const refetch = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false });

    const fresh = (!error && data && data.length > 0)
      ? (data as Payment[])
      : USE_MOCK_DATA
      ? MOCK_PAYMENTS
      : [];
    clientCache.set(cacheKey, fresh);
    setPayments(fresh);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refetch]);

  const recordPayment = useCallback(async (input: RecordPaymentInput, userId: string) => {
    if (input.method === 'bank_transfer' && !input.proof_url) {
      return { success: false, error: 'Bank transfer requires a receipt upload' };
    }

    const { data, error } = await getSupabase()
      .from('payments')
      .insert({
        customer_id: input.customer_id,
        invoice_id: input.invoice_id || null,
        amount: input.amount,
        method: input.method,
        proof_url: input.proof_url || null,
        notes: input.notes || null,
        status: 'pending',
        recorded_by: userId,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    clientCache.invalidate('payments');
    clientCache.invalidate('invoices');
    await refetch();
    return { success: true, data: data as Payment };
  }, [refetch]);

  const approvePayment = useCallback(async (paymentId: string, approverId: string) => {
    const { data, error } = await getSupabase().rpc('approve_payment', {
      p_payment_id: paymentId,
      p_approver_id: approverId,
    });

    if (error) return { success: false, error: error.message };
    const result = data as { success: boolean; error?: string };
    if (!result.success) return { success: false, error: result.error };
    clientCache.invalidate('payments');
    clientCache.invalidate('invoices');
    await refetch();
    return { success: true };
  }, [refetch]);

  const rejectPayment = useCallback(async (paymentId: string, approverId: string, reason?: string) => {
    const { data, error } = await getSupabase().rpc('reject_payment', {
      p_payment_id: paymentId,
      p_approver_id: approverId,
      p_reason: reason || 'Rejected by finance',
    });

    if (error) return { success: false, error: error.message };
    const result = data as { success: boolean; error?: string };
    if (!result.success) return { success: false, error: result.error };
    clientCache.invalidate('payments');
    clientCache.invalidate('invoices');
    await refetch();
    return { success: true };
  }, [refetch]);

  return { payments, loading, refetch, recordPayment, approvePayment, rejectPayment };
}

/* ═══════════════════════════════════════════════════════════════
   INVENTORY
   ═══════════════════════════════════════════════════════════════ */

export interface AllocateStockInput {
  product_id: string;
  from_location_id: string;
  to_location_id: string;
  quantity: number;
  batch_number: string;
}

export function useInventory() {
  const cacheKey = 'inventory';
  const [inventory, setInventory] = useState<InventoryItem[]>(() => clientCache.get<InventoryItem[]>(cacheKey) || []);
  const [loading, setLoading] = useState(() => !clientCache.has(cacheKey));

  const refetch = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from('inventory')
      .select('*')
      .order('created_at', { ascending: false });

    const fresh = (!error && data && data.length > 0)
      ? (data as InventoryItem[])
      : USE_MOCK_DATA
      ? MOCK_INVENTORY
      : [];
    clientCache.set(cacheKey, fresh);
    setInventory(fresh);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refetch]);

  const allocateStock = useCallback(async (input: AllocateStockInput) => {
    const { data: { user } } = await getSupabase().auth.getUser();
    const { data, error } = await getSupabase().rpc('allocate_stock', {
      p_product_id: input.product_id,
      p_from_location_id: input.from_location_id,
      p_to_location_id: input.to_location_id,
      p_quantity: input.quantity,
      p_batch_number: input.batch_number || null,
      p_performed_by: user?.id || null,
    });

    if (error) return { success: false, error: error.message };
    if (!data.success) return { success: false, error: data.error };

    clientCache.invalidate('inventory');
    await refetch();
    return { success: true };
  }, [refetch]);

  return { inventory, loading, refetch, allocateStock };
}

/* ═══════════════════════════════════════════════════════════════
   LOCATIONS
   ═══════════════════════════════════════════════════════════════ */

export function useLocations() {
  const cacheKey = 'locations';
  const [locations, setLocations] = useState<Location[]>(() => clientCache.get<Location[]>(cacheKey) || []);
  const [loading, setLoading] = useState(() => !clientCache.has(cacheKey));

  const refetch = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from('locations')
      .select('*')
      .order('name');

    const fresh = (!error && data && data.length > 0)
      ? (data as Location[])
      : USE_MOCK_DATA
      ? MOCK_LOCATIONS
      : [];
    clientCache.set(cacheKey, fresh);
    setLocations(fresh);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refetch]);

  return { locations, loading, refetch };
}

/* ═══════════════════════════════════════════════════════════════
   USERS (profiles)
   ═══════════════════════════════════════════════════════════════ */

export function useUsers() {
  const cacheKey = 'users';
  const [users, setUsers] = useState<User[]>(() => clientCache.get<User[]>(cacheKey) || []);
  const [loading, setLoading] = useState(() => !clientCache.has(cacheKey));

  const refetch = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from('profiles')
      .select('*, locations(name)')
      .order('full_name');

    if (!error && data && data.length > 0) {
      const mapped = (data as unknown as Record<string, unknown>[]).map((p) => ({
        ...p,
        location_name: (p.locations as { name: string }[] | null)?.[0]?.name || 'Unknown',
      }));
      const fresh = mapped as unknown as User[];
      clientCache.set(cacheKey, fresh);
      setUsers(fresh);
    } else if (USE_MOCK_DATA) {
      clientCache.set(cacheKey, MOCK_USERS);
      setUsers(MOCK_USERS);
    } else {
      clientCache.set(cacheKey, []);
      setUsers([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refetch]);

  return { users, loading, refetch };
}

/* ═══════════════════════════════════════════════════════════════
   CHAT MESSAGES
   ═══════════════════════════════════════════════════════════════ */

export function useChatMessages(currentUserId: string | null, selectedUserId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!selectedUserId || !currentUserId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    if (USE_MOCK_DATA) {
      const thread = MOCK_CHAT_MESSAGES.filter(
        (m) =>
          (m.sender_id === currentUserId && m.receiver_id === selectedUserId) ||
          (m.sender_id === selectedUserId && m.receiver_id === currentUserId)
      ).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setMessages([...thread]);
      setLoading(false);
      return;
    }

    const { data, error } = await getSupabase()
      .from('chat_messages')
      .select('*')
      .or(
        `and(sender_id.eq.${currentUserId},receiver_id.eq.${selectedUserId}),` +
        `and(sender_id.eq.${selectedUserId},receiver_id.eq.${currentUserId})`
      )
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data as ChatMessage[]);
    } else {
      const thread = MOCK_CHAT_MESSAGES.filter(
        (m) =>
          (m.sender_id === currentUserId && m.receiver_id === selectedUserId) ||
          (m.sender_id === selectedUserId && m.receiver_id === currentUserId)
      ).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setMessages([...thread]);
    }
    setLoading(false);
  }, [currentUserId, selectedUserId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refetch]);

  // Local window event bus for instant messaging updates
  useEffect(() => {
    if (!currentUserId || !selectedUserId) return;

    const handleNewMessage = (e: Event) => {
      const customEvent = e as CustomEvent<ChatMessage>;
      const newMsg = customEvent.detail;
      if (
        (newMsg.sender_id === currentUserId && newMsg.receiver_id === selectedUserId) ||
        (newMsg.sender_id === selectedUserId && newMsg.receiver_id === currentUserId)
      ) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      }
    };

    const handleReadMessage = (e: Event) => {
      const customEvent = e as CustomEvent<{ unreadIds: string[] }>;
      const { unreadIds } = customEvent.detail;
      setMessages((prev) =>
        prev.map((m) => (unreadIds.includes(m.id) ? { ...m, is_read: true } : m))
      );
    };

    window.addEventListener('albion:chat-message', handleNewMessage);
    window.addEventListener('albion:chat-read', handleReadMessage);
    return () => {
      window.removeEventListener('albion:chat-message', handleNewMessage);
      window.removeEventListener('albion:chat-read', handleReadMessage);
    };
  }, [currentUserId, selectedUserId]);

  // Realtime subscription: listen for new messages in the current thread (Supabase mode)
  useEffect(() => {
    if (!currentUserId || !selectedUserId || USE_MOCK_DATA) return;

    const supabase = getSupabase();
    const channel = supabase
      .channel(`chat:${currentUserId}:${selectedUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `sender_id=in.(${currentUserId},${selectedUserId})`,
        },
        (payload: RealtimePostgresInsertPayload<ChatRow>) => {
          const newMsg = payload.new as ChatMessage;
          // Only add if it belongs to this conversation
          if (
            (newMsg.sender_id === currentUserId && newMsg.receiver_id === selectedUserId) ||
            (newMsg.sender_id === selectedUserId && newMsg.receiver_id === currentUserId)
          ) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUserId, selectedUserId]);

  // Auto-mark received messages as read when viewing the thread
  useEffect(() => {
    if (!currentUserId || !selectedUserId) return;

    const unread = messages.filter(
      (m) => m.receiver_id === currentUserId && m.sender_id === selectedUserId && !m.is_read
    );

    if (unread.length === 0) return;

    const unreadIds = unread.map((m) => m.id);

    // Sync in-memory mock messages
    MOCK_CHAT_MESSAGES.forEach((m) => {
      if (unreadIds.includes(m.id)) {
        m.is_read = true;
      }
    });

    queueMicrotask(() => {
      setMessages((prev) =>
        prev.map((m) => (unreadIds.includes(m.id) ? { ...m, is_read: true } : m))
      );
    });

    window.dispatchEvent(new CustomEvent('albion:chat-read', { detail: { unreadIds } }));

    if (!USE_MOCK_DATA) {
      getSupabase()
        .from('chat_messages')
        .update({ is_read: true })
        .in('id', unreadIds);
    }
  }, [currentUserId, selectedUserId, messages]);

  const sendMessage = useCallback(async (content: string, attachment?: { url: string; type: string }) => {
    if (!selectedUserId || !currentUserId) return { success: false, error: 'No recipient' };

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      sender_id: currentUserId,
      receiver_id: selectedUserId,
      content,
      attachment_url: attachment?.url || null,
      attachment_type: attachment?.type || null,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    MOCK_CHAT_MESSAGES.push(newMsg);
    window.dispatchEvent(new CustomEvent('albion:chat-message', { detail: newMsg }));

    if (!USE_MOCK_DATA) {
      const { error } = await getSupabase()
        .from('chat_messages')
        .insert({
          sender_id: currentUserId,
          receiver_id: selectedUserId,
          content,
          attachment_url: attachment?.url || null,
          attachment_type: attachment?.type || null,
        });

      if (error) {
        console.warn('Supabase chat sync notice:', error.message);
      }
    }

    await refetch();
    return { success: true };
  }, [currentUserId, selectedUserId, refetch]);

  return { messages, loading, refetch, sendMessage };
}

/* ═══════════════════════════════════════════════════════════════
   ALL MESSAGES (for contact list previews)
   ═══════════════════════════════════════════════════════════════ */

export function useMyMessages(userId: string | null) {
  const [allMessages, setAllMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!userId) {
      setAllMessages([]);
      setLoading(false);
      return;
    }

    if (USE_MOCK_DATA) {
      const list = MOCK_CHAT_MESSAGES.filter(
        (m) => m.sender_id === userId || m.receiver_id === userId
      ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setAllMessages([...list]);
      setLoading(false);
      return;
    }

    const { data, error } = await getSupabase()
      .from('chat_messages')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAllMessages(data as ChatMessage[]);
    } else {
      const list = MOCK_CHAT_MESSAGES.filter(
        (m) => m.sender_id === userId || m.receiver_id === userId
      ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setAllMessages([...list]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refetch]);

  // Local window event bus for live updates across components
  useEffect(() => {
    if (!userId) return;

    const handleNewMessage = (e: Event) => {
      const customEvent = e as CustomEvent<ChatMessage>;
      const newMsg = customEvent.detail;
      if (newMsg.sender_id === userId || newMsg.receiver_id === userId) {
        setAllMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [newMsg, ...prev];
        });
      }
    };

    const handleReadMessage = (e: Event) => {
      const customEvent = e as CustomEvent<{ unreadIds: string[] }>;
      const { unreadIds } = customEvent.detail;
      setAllMessages((prev) =>
        prev.map((m) => (unreadIds.includes(m.id) ? { ...m, is_read: true } : m))
      );
    };

    window.addEventListener('albion:chat-message', handleNewMessage);
    window.addEventListener('albion:chat-read', handleReadMessage);
    return () => {
      window.removeEventListener('albion:chat-message', handleNewMessage);
      window.removeEventListener('albion:chat-read', handleReadMessage);
    };
  }, [userId]);

  // Realtime subscription: keep contact-list previews and unread badges live in Supabase mode
  useEffect(() => {
    if (!userId || USE_MOCK_DATA) return;

    const supabase = getSupabase();
    const channel = supabase
      .channel(`my-messages:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload: RealtimePostgresInsertPayload<ChatRow>) => {
          const newMsg = payload.new as ChatMessage;
          if (newMsg.sender_id !== userId && newMsg.receiver_id !== userId) return;
          setAllMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [newMsg, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload: RealtimePostgresUpdatePayload<ChatRow>) => {
          const updated = payload.new as ChatMessage;
          if (updated.sender_id !== userId && updated.receiver_id !== userId) return;
          setAllMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? { ...updated } : m))
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  return { allMessages, loading, refetch };
}

/* ═══════════════════════════════════════════════════════════════
   SALARY GRADES
   ═══════════════════════════════════════════════════════════════ */

export function useSalaryGrades() {
  const cacheKey = 'salary_grades';
  const [salaryGrades, setSalaryGrades] = useState<SalaryGrade[]>(() => clientCache.get<SalaryGrade[]>(cacheKey) || []);
  const [loading, setLoading] = useState(() => !clientCache.has(cacheKey));

  const refetch = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from('salary_grades')
      .select('*')
      .order('grade');

    const fresh = (!error && data && data.length > 0)
      ? (data as SalaryGrade[])
      : USE_MOCK_DATA
      ? MOCK_SALARY_GRADES
      : [];
    clientCache.set(cacheKey, fresh);
    setSalaryGrades(fresh);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refetch]);

  return { salaryGrades, loading, refetch };
}

/* ═══════════════════════════════════════════════════════════════
   PAYROLL RUNS
   ═══════════════════════════════════════════════════════════════ */

export function usePayrollRuns() {
  const cacheKey = 'payroll_runs';
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>(() => clientCache.get<PayrollRun[]>(cacheKey) || []);
  const [loading, setLoading] = useState(() => !clientCache.has(cacheKey));

  const refetch = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from('payroll_runs')
      .select('*')
      .order('created_at', { ascending: false });

    const fresh = (!error && data && data.length > 0)
      ? (data as PayrollRun[])
      : USE_MOCK_DATA
      ? MOCK_PAYROLL_RUNS
      : [];
    clientCache.set(cacheKey, fresh);
    setPayrollRuns(fresh);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refetch]);

  const getPayslipsForRun = useCallback(async (payrollRunId: string): Promise<Payslip[]> => {
    const { data, error } = await getSupabase()
      .from('payslips')
      .select('*')
      .eq('payroll_run_id', payrollRunId);

    if (!error && data && data.length > 0) return data as Payslip[];
    if (USE_MOCK_DATA) return MOCK_PAYSLIPS.filter((ps) => ps.payroll_run_id === payrollRunId);
    return [];
  }, []);

  return { payrollRuns, loading, refetch, getPayslipsForRun };
}

/* ═══════════════════════════════════════════════════════════════
   LEAVE REQUESTS
   ═══════════════════════════════════════════════════════════════ */

export function useLeaveRequests() {
  const cacheKey = 'leave_requests';
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => clientCache.get<LeaveRequest[]>(cacheKey) || []);
  const [loading, setLoading] = useState(() => !clientCache.has(cacheKey));

  const refetch = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from('leave_requests')
      .select('*')
      .order('created_at', { ascending: false });

    const fresh = (!error && data && data.length > 0)
      ? (data as LeaveRequest[])
      : USE_MOCK_DATA
      ? MOCK_LEAVE_REQUESTS
      : [];
    clientCache.set(cacheKey, fresh);
    setLeaveRequests(fresh);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refetch]);

  const submitLeaveRequest = useCallback(async (input: {
    user_id: string;
    leave_type: LeaveType;
    start_date: string;
    end_date: string;
    reason: string;
  }): Promise<{ success: boolean; data?: LeaveRequest; error?: string }> => {
    const { data, error } = await getSupabase()
      .from('leave_requests')
      .insert({
        user_id: input.user_id,
        leave_type: input.leave_type,
        start_date: input.start_date,
        end_date: input.end_date,
        reason: input.reason,
        status: 'pending',
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    clientCache.invalidate('leave_requests');
    await refetch();
    return { success: true, data: data as LeaveRequest };
  }, [refetch]);

  const reviewLeaveRequest = useCallback(async (
    leaveRequestId: string,
    newStatus: 'approved' | 'rejected',
    reviewerNotes?: string,
  ): Promise<{ success: boolean; error?: string }> => {
    const { error } = await getSupabase()
      .from('leave_requests')
      .update({
        status: newStatus,
        reviewer_notes: reviewerNotes || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', leaveRequestId)
      .eq('status', 'pending');

    if (error) return { success: false, error: error.message };
    clientCache.invalidate('leave_requests');
    await refetch();
    return { success: true };
  }, [refetch]);

  const cancelLeaveRequest = useCallback(async (
    leaveRequestId: string,
    userId: string,
  ): Promise<{ success: boolean; error?: string }> => {
    const { error } = await getSupabase()
      .from('leave_requests')
      .update({ status: 'cancelled' })
      .eq('id', leaveRequestId)
      .eq('user_id', userId)
      .eq('status', 'pending');

    if (error) return { success: false, error: error.message };
    clientCache.invalidate('leave_requests');
    await refetch();
    return { success: true };
  }, [refetch]);

  return { leaveRequests, loading, refetch, submitLeaveRequest, reviewLeaveRequest, cancelLeaveRequest };
}

/* ═══════════════════════════════════════════════════════════════
   ATTENDANCE LOGS
   ═══════════════════════════════════════════════════════════════ */

export function useAttendanceLogs() {
  const cacheKey = 'attendance_logs';
  const [logs, setLogs] = useState<AttendanceLog[]>(() => clientCache.get<AttendanceLog[]>(cacheKey) || []);
  const [loading, setLoading] = useState(() => !clientCache.has(cacheKey));

  const refetch = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from('attendance_logs')
      .select('*')
      .order('date', { ascending: false });

    const fresh = (!error && data && data.length > 0)
      ? (data as AttendanceLog[])
      : USE_MOCK_DATA
      ? MOCK_ATTENDANCE_LOGS
      : [];
    clientCache.set(cacheKey, fresh);
    setLogs(fresh);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refetch]);

  const clockIn = useCallback(async (userId: string): Promise<{ success: boolean; data?: AttendanceLog; error?: string }> => {
    const today = new Date().toISOString().slice(0, 10);
    const { data: existing } = await getSupabase()
      .from('attendance_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();

    if (existing) {
      if (existing.clock_in) return { success: false, error: 'Already clocked in today' };
      const { data, error } = await getSupabase()
        .from('attendance_logs')
        .update({ clock_in: new Date().toISOString(), status: 'present' })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) return { success: false, error: error.message };
      clientCache.invalidate('attendance_logs');
      await refetch();
      return { success: true, data: data as AttendanceLog };
    }

    const hour = new Date().getHours();
    const status = hour > 9 ? 'late' : 'present';

    const { data, error } = await getSupabase()
      .from('attendance_logs')
      .insert({ user_id: userId, date: today, clock_in: new Date().toISOString(), status })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    clientCache.invalidate('attendance_logs');
    await refetch();
    return { success: true, data: data as AttendanceLog };
  }, [refetch]);

  const clockOut = useCallback(async (userId: string): Promise<{ success: boolean; data?: AttendanceLog; error?: string }> => {
    const today = new Date().toISOString().slice(0, 10);
    const { data: log } = await getSupabase()
      .from('attendance_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();

    if (!log) return { success: false, error: 'No clock-in record found for today. Please clock in first.' };
    if (log.clock_out) return { success: false, error: 'Already clocked out today' };

    const now = new Date();
    const hoursWorked = log.clock_in
      ? Math.round(((now.getTime() - new Date(log.clock_in).getTime()) / (1000 * 60 * 60)) * 100) / 100
      : null;

    const { data, error } = await getSupabase()
      .from('attendance_logs')
      .update({ clock_out: now.toISOString(), hours_worked: hoursWorked })
      .eq('id', log.id)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    clientCache.invalidate('attendance_logs');
    await refetch();
    return { success: true, data: data as AttendanceLog };
  }, [refetch]);

  return { logs, loading, refetch, clockIn, clockOut };
}

/* ═══════════════════════════════════════════════════════════════
   EMPLOYEE DOCUMENTS
   ═══════════════════════════════════════════════════════════════ */

export interface AddDocumentInput {
  user_id: string;
  document_type: DocumentType;
  document_name: string;
  file_url: string;
  file_size?: number;
  expiry_date?: string;
  notes?: string;
}

export function useEmployeeDocuments() {
  const cacheKey = 'employee_documents';
  const [documents, setDocuments] = useState<EmployeeDocument[]>(() => clientCache.get<EmployeeDocument[]>(cacheKey) || []);
  const [loading, setLoading] = useState(() => !clientCache.has(cacheKey));

  const refetch = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from('employee_documents')
      .select('*')
      .order('created_at', { ascending: false });

    const fresh = (!error && data && data.length > 0)
      ? (data as EmployeeDocument[])
      : USE_MOCK_DATA
      ? MOCK_EMPLOYEE_DOCUMENTS
      : [];
    clientCache.set(cacheKey, fresh);
    setDocuments(fresh);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refetch]);

  const addDocument = useCallback(async (input: AddDocumentInput): Promise<{ success: boolean; data?: EmployeeDocument; error?: string }> => {
    const { data, error } = await getSupabase()
      .from('employee_documents')
      .insert({
        user_id: input.user_id,
        document_type: input.document_type,
        document_name: input.document_name,
        file_url: input.file_url,
        file_size: input.file_size || null,
        expiry_date: input.expiry_date || null,
        notes: input.notes || null,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    clientCache.invalidate('employee_documents');
    await refetch();
    return { success: true, data: data as EmployeeDocument };
  }, [refetch]);

  const verifyDocument = useCallback(async (documentId: string): Promise<{ success: boolean; data?: EmployeeDocument; error?: string }> => {
    const { data, error } = await getSupabase()
      .from('employee_documents')
      .update({ is_verified: true })
      .eq('id', documentId)
      .eq('is_verified', false)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    clientCache.invalidate('employee_documents');
    await refetch();
    return { success: true, data: data as EmployeeDocument };
  }, [refetch]);

  return { documents, loading, refetch, addDocument, verifyDocument };
}

/* ═══════════════════════════════════════════════════════════════
   PERFORMANCE TARGETS
   ═══════════════════════════════════════════════════════════════ */

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

export function usePerformanceTargets() {
  const cacheKey = 'performance_targets';
  const [targets, setTargets] = useState<PerformanceTarget[]>(() => clientCache.get<PerformanceTarget[]>(cacheKey) || []);
  const [loading, setLoading] = useState(() => !clientCache.has(cacheKey));

  const refetch = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from('performance_targets')
      .select('*')
      .order('created_at', { ascending: false });

    const fresh = (!error && data && data.length > 0)
      ? (data as PerformanceTarget[])
      : USE_MOCK_DATA
      ? MOCK_PERFORMANCE_TARGETS
      : [];
    clientCache.set(cacheKey, fresh);
    setTargets(fresh);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refetch]);

  const setTarget = useCallback(async (input: SetTargetInput): Promise<{ success: boolean; data?: PerformanceTarget; error?: string }> => {
    const { data, error } = await getSupabase()
      .from('performance_targets')
      .insert({
        user_id: input.user_id,
        target_type: input.target_type,
        period_start: input.period_start,
        period_end: input.period_end,
        sales_target: input.sales_target,
        collection_target: input.collection_target,
        new_customers_target: input.new_customers_target,
        notes: input.notes || null,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    clientCache.invalidate('performance_targets');
    await refetch();
    return { success: true, data: data as PerformanceTarget };
  }, [refetch]);

  const updateProgress = useCallback(async (
    targetId: string,
    actualSales: number,
    actualCollection: number,
    newCustomersActual: number,
  ): Promise<{ success: boolean; data?: PerformanceTarget; error?: string }> => {
    const target = await getSupabase()
      .from('performance_targets')
      .select('*')
      .eq('id', targetId)
      .single();

    if (target.error || !target.data) return { success: false, error: 'Target not found' };
    const t = target.data as PerformanceTarget;
    if (t.status === 'achieved' || t.status === 'cancelled') {
      return { success: false, error: `Target is already ${t.status}` };
    }

    const periodEnded = new Date(t.period_end) < new Date();
    let newStatus = 'active';
    if (periodEnded) {
      newStatus = (actualSales >= t.sales_target && actualCollection >= t.collection_target && newCustomersActual >= t.new_customers_target)
        ? 'achieved' : 'missed';
    }

    const { data, error } = await getSupabase()
      .from('performance_targets')
      .update({
        actual_sales: actualSales,
        actual_collection: actualCollection,
        new_customers_actual: newCustomersActual,
        status: newStatus,
      })
      .eq('id', targetId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    clientCache.invalidate('performance_targets');
    await refetch();
    return { success: true, data: data as PerformanceTarget };
  }, [refetch]);

  return { targets, loading, refetch, setTarget, updateProgress };
}

/* ═══════════════════════════════════════════════════════════════
   PERFORMANCE REVIEWS
   ═══════════════════════════════════════════════════════════════ */

export function usePerformanceReviews() {
  const cacheKey = 'performance_reviews';
  const [reviews, setReviews] = useState<PerformanceReview[]>(() => clientCache.get<PerformanceReview[]>(cacheKey) || []);
  const [loading, setLoading] = useState(() => !clientCache.has(cacheKey));

  const refetch = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from('performance_reviews')
      .select('*')
      .order('created_at', { ascending: false });

    const fresh = (!error && data && data.length > 0)
      ? (data as PerformanceReview[])
      : USE_MOCK_DATA
      ? MOCK_PERFORMANCE_REVIEWS
      : [];
    clientCache.set(cacheKey, fresh);
    setReviews(fresh);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refetch]);

  return { reviews, loading, refetch };
}

/* ═══════════════════════════════════════════════════════════════
   HELPER: Find by ID (for display lookups)
   ═══════════════════════════════════════════════════════════════ */

/** Find a product by ID from a local products array */
export function findProductById(products: Product[], id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

/** Find a customer by ID from a local customers array */
export function findCustomerById(customers: Customer[], id: string): Customer | undefined {
  return customers.find((c) => c.id === id);
}

/** Find a location by ID from a local locations array */
export function findLocationById(locations: Location[], id: string): Location | undefined {
  return locations.find((l) => l.id === id);
}

/** Find a user by ID from a local users array */
export function findUserById(users: User[], id: string): User | undefined {
  return users.find((u) => u.id === id);
}

/* ═══════════════════════════════════════════════════════════════
   CLINIC — Clients, Patients, Appointments, Treatments, Queue
   ═══════════════════════════════════════════════════════════════ */

export function useClinicClients(locationId?: string) {
  const cacheKey = locationId ? `clinic_clients_${locationId}` : 'clinic_clients';
  const [clients, setClients] = useState<ClinicClient[]>(() => clientCache.get<ClinicClient[]>(cacheKey) || []);
  const [loading, setLoading] = useState(() => !clientCache.has(cacheKey));

  const refetch = useCallback(async () => {
    if (!clientCache.has(cacheKey)) setLoading(true);
    const { getClinicClients } = await import('@/lib/data-service');
    const fresh = await getClinicClients(locationId);
    clientCache.set(cacheKey, fresh);
    setClients(fresh);
    setLoading(false);
  }, [cacheKey, locationId]);

  useEffect(() => {
    const id = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(id);
  }, [refetch]);

  return { clients, loading, refetch };
}

export function useClinicPatients() {
  const cacheKey = 'clinic_patients';
  const [patients, setPatients] = useState<PatientWithOwner[]>(() => clientCache.get<PatientWithOwner[]>(cacheKey) || []);
  const [loading, setLoading] = useState(() => !clientCache.has(cacheKey));

  const refetch = useCallback(async () => {
    if (!clientCache.has(cacheKey)) setLoading(true);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('patients')
      .select('*, owner:owner_id(id, full_name, phone)')
      .order('created_at', { ascending: false });

    let fresh: PatientWithOwner[];
    if (!error && data && data.length > 0) {
      fresh = data as PatientWithOwner[];
    } else {
      const { getPatients } = await import('@/lib/data-service');
      fresh = await getPatients();
    }
    clientCache.set(cacheKey, fresh);
    setPatients(fresh);
    setLoading(false);
  }, [cacheKey]);

  useEffect(() => {
    const id = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(id);
  }, [refetch]);

  return { patients, loading, refetch };
}

export function useClinicAppointments() {
  const cacheKey = 'clinic_appointments';
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>(() => clientCache.get<AppointmentWithRelations[]>(cacheKey) || []);
  const [loading, setLoading] = useState(() => !clientCache.has(cacheKey));

  const refetch = useCallback(async () => {
    if (!clientCache.has(cacheKey)) setLoading(true);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('appointments')
      .select('*, patient:patient_id(id, name, species), owner:owner_id(id, full_name)')
      .order('date', { ascending: true });

    let hydrated: AppointmentWithRelations[];
    if (!error && data && data.length > 0) {
      hydrated = data as AppointmentWithRelations[];
    } else {
      const { getAppointments, getPatients, getCustomers } = await import('@/lib/data-service');
      const [rawAppts, rawPatients, rawCustomers] = await Promise.all([
        getAppointments(),
        getPatients(),
        getCustomers(),
      ]);
      const patientMap = new Map(rawPatients.map((p) => [p.id, p]));
      const customerMap = new Map(rawCustomers.map((c) => [c.id, c]));

      hydrated = rawAppts.map((a) => {
        const p = patientMap.get(a.patient_id);
        const o = customerMap.get(a.owner_id);
        return {
          ...a,
          patient: p ? { id: p.id, name: p.name, species: p.species, weight_kg: p.weight_kg } : undefined,
          owner: o ? { id: o.id, full_name: o.name || o.business_name || null, name: o.name, phone: o.phone } : undefined,
        };
      });
    }
    clientCache.set(cacheKey, hydrated);
    setAppointments(hydrated);
    setLoading(false);
  }, [cacheKey]);

  useEffect(() => {
    const id = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(id);
  }, [refetch]);

  return { appointments, loading, refetch };
}

export function useClinicQueue() {
  const cacheKey = 'clinic_queue';
  const [queue, setQueue] = useState<PatientQueueWithRelations[]>(() => clientCache.get<PatientQueueWithRelations[]>(cacheKey) || []);
  const [loading, setLoading] = useState(() => !clientCache.has(cacheKey));

  const refetch = useCallback(async () => {
    if (!clientCache.has(cacheKey)) setLoading(true);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('patient_queue')
      .select('*, patient:patient_id(id, name, species, weight_kg), owner:owner_id(id, full_name, phone)')
      .order('created_at', { ascending: false });

    let fresh: PatientQueueWithRelations[];
    if (!error && data && data.length > 0) {
      fresh = data as PatientQueueWithRelations[];
    } else {
      const { getQueue } = await import('@/lib/data-service');
      fresh = await getQueue();
    }
    clientCache.set(cacheKey, fresh);
    setQueue(fresh);
    setLoading(false);
  }, [cacheKey]);

  useEffect(() => {
    const id = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(id);
  }, [refetch]);

  return { queue, loading, refetch };
}

export function useVetServices() {
  const cacheKey = 'vet_services';
  const [services, setServices] = useState<VetService[]>(() => clientCache.get<VetService[]>(cacheKey) || []);
  const [loading, setLoading] = useState(() => !clientCache.has(cacheKey));

  const refetch = useCallback(async () => {
    if (!clientCache.has(cacheKey)) setLoading(true);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('vet_services')
      .select('*')
      .eq('is_active', true)
      .order('name');

    let fresh: VetService[];
    if (!error && data && data.length > 0) {
      fresh = data as VetService[];
    } else {
      const { getVetServices } = await import('@/lib/data-service');
      fresh = await getVetServices();
    }
    clientCache.set(cacheKey, fresh);
    setServices(fresh);
    setLoading(false);
  }, [cacheKey]);

  useEffect(() => {
    const id = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(id);
  }, [refetch]);

  return { services, loading, refetch };
}

export function useClinicTreatments() {
  const cacheKey = 'clinic_treatments';
  const [treatments, setTreatments] = useState<TreatmentWithRelations[]>(() => clientCache.get<TreatmentWithRelations[]>(cacheKey) || []);
  const [loading, setLoading] = useState(() => !clientCache.has(cacheKey));

  const refetch = useCallback(async () => {
    if (!clientCache.has(cacheKey)) setLoading(true);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('treatments')
      .select('*, patient:patient_id(id, name, species), vet:vet_id(id, full_name)')
      .order('date', { ascending: false });

    let fresh: TreatmentWithRelations[];
    if (!error && data && data.length > 0) {
      fresh = data as TreatmentWithRelations[];
    } else {
      const { getTreatments } = await import('@/lib/data-service');
      fresh = await getTreatments();
    }
    clientCache.set(cacheKey, fresh);
    setTreatments(fresh);
    setLoading(false);
  }, [cacheKey]);

  useEffect(() => {
    const id = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(id);
  }, [refetch]);

  return { treatments, loading, refetch };
}

export function useStockMovements(limit = 20) {
  const cacheKey = `stock_movements_${limit}`;
  const [movements, setMovements] = useState<StockMovementWithRelations[]>(() => clientCache.get<StockMovementWithRelations[]>(cacheKey) || []);
  const [loading, setLoading] = useState(() => !clientCache.has(cacheKey));

  const refetch = useCallback(async () => {
    if (!clientCache.has(cacheKey)) setLoading(true);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('stock_movements')
      .select('*, product:product_id(name), from_location:from_location_id(name), to_location:to_location_id(name)')
      .order('created_at', { ascending: false })
      .limit(limit);

    const fresh = (!error && data) ? (data as StockMovementWithRelations[]) : [];
    clientCache.set(cacheKey, fresh);
    setMovements(fresh);
    setLoading(false);
  }, [limit, cacheKey]);

  useEffect(() => {
    const id = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(id);
  }, [refetch]);

  return { movements, loading, refetch };
}

/* ═══════════════════════════════════════════════════════════════
   SUPPLIERS
   ═══════════════════════════════════════════════════════════════ */

export function useSuppliers() {
  const cacheKey = 'suppliers';
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => clientCache.get<Supplier[]>(cacheKey) || []);
  const [loading, setLoading] = useState(() => !clientCache.has(cacheKey));

  const refetch = useCallback(async () => {
    if (USE_MOCK_DATA) {
      const fresh = MOCK_SUPPLIERS.filter((s) => s.is_active !== false);
      clientCache.set(cacheKey, fresh);
      setSuppliers(fresh);
      setLoading(false);
      return;
    }
    const { data, error } = await getSupabase()
      .from('suppliers')
      .select('*')
      .eq('is_active', true)
      .order('name');

    const fresh = (!error && data && data.length > 0) ? (data as Supplier[]) : [];
    clientCache.set(cacheKey, fresh);
    setSuppliers(fresh);
    setLoading(false);
  }, [cacheKey]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refetch]);

  const addSupplier = useCallback(async (input: {
    name: string;
    contact_person?: string;
    email?: string;
    phone?: string;
    address?: string;
  }) => {
    if (USE_MOCK_DATA) {
      const newSup: Supplier = {
        id: `sup-${Date.now()}`,
        name: input.name.trim(),
        contact_person: input.contact_person?.trim() || null,
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        address: input.address?.trim() || null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      MOCK_SUPPLIERS.unshift(newSup);
      clientCache.invalidate('suppliers');
      await refetch();
      return { success: true, data: newSup };
    }
    const { data, error } = await getSupabase()
      .from('suppliers')
      .insert({
        name: input.name.trim(),
        contact_person: input.contact_person?.trim() || null,
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        address: input.address?.trim() || null,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    await refetch();
    return { success: true, data: data as Supplier };
  }, [refetch]);

  const updateSupplier = useCallback(async (
    supplierId: string,
    input: {
      name?: string;
      contact_person?: string;
      email?: string;
      phone?: string;
      address?: string;
    }
  ) => {
    if (USE_MOCK_DATA) {
      const idx = MOCK_SUPPLIERS.findIndex((s) => s.id === supplierId);
      if (idx !== -1) {
        MOCK_SUPPLIERS[idx] = {
          ...MOCK_SUPPLIERS[idx],
          ...(input.name ? { name: input.name.trim() } : {}),
          ...(input.contact_person !== undefined ? { contact_person: input.contact_person?.trim() || null } : {}),
          ...(input.email !== undefined ? { email: input.email?.trim() || null } : {}),
          ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
          ...(input.address !== undefined ? { address: input.address?.trim() || null } : {}),
          updated_at: new Date().toISOString(),
        };
      }
      await refetch();
      return { success: true };
    }
    const { error } = await getSupabase()
      .from('suppliers')
      .update({
        ...(input.name ? { name: input.name.trim() } : {}),
        ...(input.contact_person !== undefined ? { contact_person: input.contact_person?.trim() || null } : {}),
        ...(input.email !== undefined ? { email: input.email?.trim() || null } : {}),
        ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
        ...(input.address !== undefined ? { address: input.address?.trim() || null } : {}),
      })
      .eq('id', supplierId);

    if (error) return { success: false, error: error.message };
    await refetch();
    return { success: true };
  }, [refetch]);

  const deleteSupplier = useCallback(async (supplierId: string) => {
    if (USE_MOCK_DATA) {
      const idx = MOCK_SUPPLIERS.findIndex((s) => s.id === supplierId);
      if (idx !== -1) {
        MOCK_SUPPLIERS[idx].is_active = false;
      }
      await refetch();
      return { success: true };
    }
    const { error } = await getSupabase()
      .from('suppliers')
      .update({ is_active: false })
      .eq('id', supplierId);

    if (error) return { success: false, error: error.message };
    await refetch();
    return { success: true };
  }, [refetch]);

  return { suppliers, loading, refetch, addSupplier, updateSupplier, deleteSupplier };
}

/* ═══════════════════════════════════════════════════════════════
   DIAGNOSTIC LAB ORDERS
   ═══════════════════════════════════════════════════════════════ */

export function useLabOrders() {
  const cacheKey = 'lab_orders';
  const [labOrders, setLabOrders] = useState<LabOrder[]>(() => clientCache.get<LabOrder[]>(cacheKey) || []);
  const [loading, setLoading] = useState(() => !clientCache.has(cacheKey));

  const refetch = useCallback(async () => {
    if (!clientCache.has(cacheKey)) setLoading(true);
    const { getLabOrders } = await import('@/lib/data-service');
    const data = await getLabOrders();
    clientCache.set(cacheKey, data);
    setLabOrders(data);
    setLoading(false);
  }, [cacheKey]);

  useEffect(() => {
    const id = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(id);
  }, [refetch]);

  return { labOrders, loading, refetch };
}

/* ═══════════════════════════════════════════════════════════════
   HOSPITALIZATIONS & ICU
   ═══════════════════════════════════════════════════════════════ */

export function useHospitalizations() {
  const cacheKey = 'hospitalizations';
  const [hospitalizations, setHospitalizations] = useState<HospitalizationRecord[]>(() => clientCache.get<HospitalizationRecord[]>(cacheKey) || []);
  const [loading, setLoading] = useState(() => !clientCache.has(cacheKey));

  const refetch = useCallback(async () => {
    if (!clientCache.has(cacheKey)) setLoading(true);
    const { getHospitalizations } = await import('@/lib/data-service');
    const data = await getHospitalizations();
    clientCache.set(cacheKey, data);
    setHospitalizations(data);
    setLoading(false);
  }, [cacheKey]);

  useEffect(() => {
    const id = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(id);
  }, [refetch]);

  return { hospitalizations, loading, refetch };
}

/* ═══════════════════════════════════════════════════════════════
   SURGERIES
   ═══════════════════════════════════════════════════════════════ */

export function useSurgeries() {
  const cacheKey = 'surgeries';
  const [surgeries, setSurgeries] = useState<SurgeryRecord[]>(() => clientCache.get<SurgeryRecord[]>(cacheKey) || []);
  const [loading, setLoading] = useState(() => !clientCache.has(cacheKey));

  const refetch = useCallback(async () => {
    if (!clientCache.has(cacheKey)) setLoading(true);
    const { getSurgeries } = await import('@/lib/data-service');
    const data = await getSurgeries();
    clientCache.set(cacheKey, data);
    setSurgeries(data);
    setLoading(false);
  }, [cacheKey]);

  useEffect(() => {
    const id = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(id);
  }, [refetch]);

  return { surgeries, loading, refetch };
}

/* ═══════════════════════════════════════════════════════════════
   CASH RECONCILIATIONS
   ═══════════════════════════════════════════════════════════════ */

export function useCashReconciliations() {
  const cacheKey = 'cash_reconciliations';
  const [reconciliations, setReconciliations] = useState<CashReconciliation[]>(() => clientCache.get<CashReconciliation[]>(cacheKey) || []);
  const [loading, setLoading] = useState(() => !clientCache.has(cacheKey));

  const refetch = useCallback(async () => {
    if (!clientCache.has(cacheKey)) setLoading(true);
    const { getCashReconciliations } = await import('@/lib/data-service');
    const data = await getCashReconciliations();
    clientCache.set(cacheKey, data);
    setReconciliations(data);
    setLoading(false);
  }, [cacheKey]);

  useEffect(() => {
    const id = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(id);
  }, [refetch]);

  return { reconciliations, loading, refetch };
}

/* ═══════════════════════════════════════════════════════════════
   ENTERPRISE AUDIT LOG VAULT
   ═══════════════════════════════════════════════════════════════ */

export function useAuditLogs(filter?: { category?: AuditCategory; search?: string }) {
  const cacheKey = `audit_logs_${filter?.category || 'all'}_${filter?.search || ''}`;
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => clientCache.get<AuditLog[]>(cacheKey) || []);
  const [loading, setLoading] = useState(() => !clientCache.has(cacheKey));

  const refetch = useCallback(async () => {
    if (!clientCache.has(cacheKey)) setLoading(true);
    const { getAuditLogs } = await import('@/lib/data-service');
    const data = await getAuditLogs(filter);
    clientCache.set(cacheKey, data);
    setAuditLogs(data);
    setLoading(false);
  }, [filter, cacheKey]);

  useEffect(() => {
    const id = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(id);
  }, [refetch]);

  return { auditLogs, loading, refetch };
}

/* ═══════════════════════════════════════════════════════════════
   OPERATING EXPENSES
   ═══════════════════════════════════════════════════════════════ */

export function useExpenses(locationId?: string) {
  const cacheKey = `expenses_${locationId || 'all'}`;
  const [expenses, setExpenses] = useState<BranchExpense[]>(() => clientCache.get<BranchExpense[]>(cacheKey) || []);
  const [loading, setLoading] = useState(() => !clientCache.has(cacheKey));

  const refetch = useCallback(async () => {
    if (!clientCache.has(cacheKey)) setLoading(true);
    const { getBranchExpenses } = await import('@/lib/data-service');
    const data = await getBranchExpenses(locationId);
    clientCache.set(cacheKey, data);
    setExpenses(data);
    setLoading(false);
  }, [locationId, cacheKey]);

  useEffect(() => {
    const id = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(id);
  }, [refetch]);

  return { expenses, loading, refetch };
}

/* ═══════════════════════════════════════════════════════════════
   CLINIC SHIFTS & DUTY ROSTER
   ═══════════════════════════════════════════════════════════════ */

export function useClinicShifts(locationId?: string) {
  const cacheKey = `clinic_shifts_${locationId || 'all'}`;
  const [shifts, setShifts] = useState<ClinicShift[]>(() => clientCache.get<ClinicShift[]>(cacheKey) || []);
  const [loading, setLoading] = useState(() => !clientCache.has(cacheKey));

  const refetch = useCallback(async () => {
    if (!clientCache.has(cacheKey)) setLoading(true);
    const { getClinicShifts } = await import('@/lib/data-service');
    const data = await getClinicShifts(locationId);
    clientCache.set(cacheKey, data);
    setShifts(data);
    setLoading(false);
  }, [locationId, cacheKey]);

  useEffect(() => {
    const id = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(id);
  }, [refetch]);

  return { shifts, loading, refetch };
}

/* ═══════════════════════════════════════════════════════════════
   PREVENTIVE CARE & PATIENT RECALLS
   ═══════════════════════════════════════════════════════════════ */

export function usePatientReminders(status?: ReminderStatus) {
  const cacheKey = `patient_reminders_${status || 'all'}`;
  const [reminders, setReminders] = useState<PatientReminder[]>(() => clientCache.get<PatientReminder[]>(cacheKey) || []);
  const [loading, setLoading] = useState(() => !clientCache.has(cacheKey));

  const refetch = useCallback(async () => {
    if (!clientCache.has(cacheKey)) setLoading(true);
    const { getPatientReminders } = await import('@/lib/data-service');
    const data = await getPatientReminders(status);
    clientCache.set(cacheKey, data);
    setReminders(data);
    setLoading(false);
  }, [status, cacheKey]);

  useEffect(() => {
    const id = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(id);
  }, [refetch]);

  return { reminders, loading, refetch };
}

/* ═══════════════════════════════════════════════════════════════
   STAFF REQUESTS PORTAL
   ═══════════════════════════════════════════════════════════════ */

export function useStaffRequests(userId?: string, userRole?: any) {
  const cacheKey = `staff_requests_${userId || 'all'}_${userRole || 'all'}`;
  const [requests, setRequests] = useState<StaffRequest[]>(() => clientCache.get<StaffRequest[]>(cacheKey) || []);
  const [loading, setLoading] = useState(() => !clientCache.has(cacheKey));

  const refetch = useCallback(async () => {
    if (!clientCache.has(cacheKey)) setLoading(true);
    const { getStaffRequests } = await import('@/lib/data-service');
    const data = await getStaffRequests(userId, userRole);
    clientCache.set(cacheKey, data);
    setRequests(data);
    setLoading(false);
  }, [userId, userRole, cacheKey]);

  useEffect(() => {
    const id = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(id);
  }, [refetch]);

  const createRequest = useCallback(async (input: any) => {
    const { createStaffRequest } = await import('@/lib/data-service');
    const res = await createStaffRequest(input);
    if (res.success) {
      clientCache.invalidate('staff_requests');
      await refetch();
    }
    return res;
  }, [refetch]);

  const updateStatus = useCallback(async (id: string, status: StaffRequestStatus, reviewerId: string, reviewerName: string, reviewNotes?: string) => {
    const { updateStaffRequestStatus } = await import('@/lib/data-service');
    const res = await updateStaffRequestStatus(id, status, reviewerId, reviewerName, reviewNotes);
    if (res.success) {
      clientCache.invalidate('staff_requests');
      await refetch();
    }
    return res;
  }, [refetch]);

  return { requests, loading, refetch, createRequest, updateStatus };
}

/* ═══════════════════════════════════════════════════════════════
   COMPANY & CLINIC ANNOUNCEMENTS
   ═══════════════════════════════════════════════════════════════ */

export function useAnnouncements(userRole?: any, locationId?: string | null) {
  const cacheKey = `announcements_${userRole || 'all'}_${locationId || 'all'}`;
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => clientCache.get<Announcement[]>(cacheKey) || []);
  const [loading, setLoading] = useState(() => !clientCache.has(cacheKey));
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const stored = localStorage.getItem('albion_dismissed_announcements');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const refetch = useCallback(async () => {
    if (!clientCache.has(cacheKey)) setLoading(true);
    const { getAnnouncements } = await import('@/lib/data-service');
    const data = await getAnnouncements(userRole, locationId);
    clientCache.set(cacheKey, data);
    setAnnouncements(data);
    setLoading(false);
  }, [userRole, locationId, cacheKey]);

  useEffect(() => {
    const id = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(id);
  }, [refetch]);

  const createNotice = useCallback(async (input: any) => {
    const { createAnnouncement } = await import('@/lib/data-service');
    const res = await createAnnouncement(input);
    if (res.success) {
      clientCache.invalidate('announcements');
      await refetch();
    }
    return res;
  }, [refetch]);

  const dismissNotice = useCallback((id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem('albion_dismissed_announcements', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  }, []);

  const activeAnnouncements = announcements.filter((a) => !dismissedIds.has(a.id));

  return { announcements: activeAnnouncements, allAnnouncements: announcements, loading, refetch, createNotice, dismissNotice };
}

/* ═══════════════════════════════════════════════════════════════
   NARCOTICS SAFE REGISTER
   ═══════════════════════════════════════════════════════════════ */

export function useNarcoticLogs(locationId?: string | null) {
  const cacheKey = `narcotic_logs_${locationId || 'all'}`;
  const [logs, setLogs] = useState<NarcoticLog[]>(() => clientCache.get<NarcoticLog[]>(cacheKey) || []);
  const [loading, setLoading] = useState(() => !clientCache.has(cacheKey));

  const refetch = useCallback(async () => {
    if (!clientCache.has(cacheKey)) setLoading(true);
    const { getNarcoticLogs } = await import('@/lib/data-service');
    const data = await getNarcoticLogs(locationId);
    clientCache.set(cacheKey, data);
    setLogs(data);
    setLoading(false);
  }, [locationId, cacheKey]);

  useEffect(() => {
    const id = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(id);
  }, [refetch]);

  return { logs, loading, refetch };
}





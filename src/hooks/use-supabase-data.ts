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
  LabOrder, HospitalizationRecord, ICUVitalEntry, SurgeryRecord, CashReconciliation,
  BranchExpense, AuditLog, AuditCategory,
  ClinicShift, PatientReminder, ReminderStatus,
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
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    let query = getSupabase().from('products').select('*');
    if (!fetchInactive) {
      query = query.eq('is_active', true);
    }
    const { data, error } = await query.order('name');

    if (!error && data && data.length > 0) setProducts(data as Product[]);
    else if (USE_MOCK_DATA) setProducts(fetchInactive ? MOCK_PRODUCTS : MOCK_PRODUCTS.filter((p) => p.is_active !== false));
    else setProducts([]);
    setLoading(false);
  }, [fetchInactive]);

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
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    let query = getSupabase().from('customers').select('*');
    if (!fetchInactive) {
      query = query.eq('is_active', true);
    }
    const { data, error } = await query.order('business_name');

    if (!error && data && data.length > 0) setCustomers(data as Customer[]);
    else if (USE_MOCK_DATA) setCustomers(fetchInactive ? MOCK_CUSTOMERS : MOCK_CUSTOMERS.filter((c) => c.is_active !== false));
    else setCustomers([]);
    setLoading(false);
  }, [fetchInactive]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refetch]);

  const addCustomer = useCallback(async (input: AddCustomerInput) => {
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
}

export function useInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from('invoices')
      .select('*, invoice_items(*)')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      const mapped = data.map((inv: Record<string, unknown>) => ({
        ...inv,
        items: (inv.invoice_items as InvoiceItem[]) || [],
      }));
      setInvoices(mapped as Invoice[]);
    } else if (USE_MOCK_DATA) {
      setInvoices(MOCK_INVOICES);
    } else {
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
    const vatAmount = Math.round(subtotal * 0.075);
    const total = subtotal + vatAmount;

    /* Generate invoice number: INV-YYYY-XXXXX (timestamp-based, no race) */
    const year = new Date().getFullYear();
    const seq = Date.now().toString(36).toUpperCase().slice(-5);
    const invoiceNumber = `INV-${year}-${seq}`;

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
      return { success: false, error: itemsError.message };
    }

    await refetch();
    return { success: true, data: { ...invData, items: lineItems } as Invoice };
  }, [refetch]);

  const updateInvoiceStatus = useCallback(async (invoiceId: string, status: string) => {
    const result = await dataTransitionInvoice(invoiceId, status);
    if (!result.success) return result;
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
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) setPayments(data as Payment[]);
    else if (USE_MOCK_DATA) setPayments(MOCK_PAYMENTS);
    else setPayments([]);
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
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from('inventory')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) setInventory(data as InventoryItem[]);
    else if (USE_MOCK_DATA) setInventory(MOCK_INVENTORY);
    else setInventory([]);
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

    await refetch();
    return { success: true };
  }, [refetch]);

  return { inventory, loading, refetch, allocateStock };
}

/* ═══════════════════════════════════════════════════════════════
   LOCATIONS
   ═══════════════════════════════════════════════════════════════ */

export function useLocations() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from('locations')
      .select('*')
      .order('name');

    if (!error && data && data.length > 0) {
      setLocations(data as Location[]);
    } else if (USE_MOCK_DATA) {
      setLocations(MOCK_LOCATIONS);
    } else {
      setLocations([]);
    }
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
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

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
      setUsers(mapped as unknown as User[]);
    } else if (USE_MOCK_DATA) {
      setUsers(MOCK_USERS);
    } else {
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

    const { data, error } = await getSupabase()
      .from('chat_messages')
      .select('*')
      .or(
        `and(sender_id.eq.${currentUserId},receiver_id.eq.${selectedUserId}),` +
        `and(sender_id.eq.${selectedUserId},receiver_id.eq.${currentUserId})`
      )
      .order('created_at', { ascending: true });

    if (!error && data) setMessages(data as ChatMessage[]);
    setLoading(false);
  }, [currentUserId, selectedUserId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refetch]);

  // Realtime subscription: listen for new messages in the current thread
  useEffect(() => {
    if (!currentUserId || !selectedUserId) return;

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

  // Auto-mark received messages as read when viewing the thread.
  // `messages` is a dep so messages that arrive via the realtime
  // subscription are also marked read while the thread is open.
  useEffect(() => {
    if (!currentUserId || !selectedUserId) return;

    const unread = messages.filter(
      (m) => m.receiver_id === currentUserId && m.sender_id === selectedUserId && !m.is_read
    );

    if (unread.length === 0) return;

    const unreadIds = unread.map((m) => m.id);
    getSupabase()
      .from('chat_messages')
      .update({ is_read: true })
      .in('id', unreadIds)
      .then(() => {
        setMessages((prev) =>
          prev.map((m) => (unreadIds.includes(m.id) ? { ...m, is_read: true } : m))
        );
      });
  }, [currentUserId, selectedUserId, messages]);

  const sendMessage = useCallback(async (content: string, attachment?: { url: string; type: string }) => {
    if (!selectedUserId || !currentUserId) return { success: false, error: 'No recipient' };

    const { error } = await getSupabase()
      .from('chat_messages')
      .insert({
        sender_id: currentUserId,
        receiver_id: selectedUserId,
        content,
        attachment_url: attachment?.url || null,
        attachment_type: attachment?.type || null,
      });

    if (error) return { success: false, error: error.message };
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
    const { data, error } = await getSupabase()
      .from('chat_messages')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (!error && data) setAllMessages(data as ChatMessage[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refetch]);

  // Realtime subscription: keep contact-list previews and unread badges live.
  // RLS restricts each user to their own conversations, so the feed is
  // filtered client-side to messages involving this user.
  useEffect(() => {
    if (!userId) return;

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
  const [salaryGrades, setSalaryGrades] = useState<SalaryGrade[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from('salary_grades')
      .select('*')
      .order('grade');

    if (!error && data && data.length > 0) setSalaryGrades(data as SalaryGrade[]);
    else if (USE_MOCK_DATA) setSalaryGrades(MOCK_SALARY_GRADES);
    else setSalaryGrades([]);
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
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from('payroll_runs')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) setPayrollRuns(data as PayrollRun[]);
    else if (USE_MOCK_DATA) setPayrollRuns(MOCK_PAYROLL_RUNS);
    else setPayrollRuns([]);
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
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from('leave_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) setLeaveRequests(data as LeaveRequest[]);
    else if (USE_MOCK_DATA) setLeaveRequests(MOCK_LEAVE_REQUESTS);
    else setLeaveRequests([]);
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
    await refetch();
    return { success: true };
  }, [refetch]);

  return { leaveRequests, loading, refetch, submitLeaveRequest, reviewLeaveRequest, cancelLeaveRequest };
}

/* ═══════════════════════════════════════════════════════════════
   ATTENDANCE LOGS
   ═══════════════════════════════════════════════════════════════ */

export function useAttendanceLogs() {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from('attendance_logs')
      .select('*')
      .order('date', { ascending: false });

    if (!error && data && data.length > 0) setLogs(data as AttendanceLog[]);
    else if (USE_MOCK_DATA) setLogs(MOCK_ATTENDANCE_LOGS);
    else setLogs([]);
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
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from('employee_documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) setDocuments(data as EmployeeDocument[]);
    else if (USE_MOCK_DATA) setDocuments(MOCK_EMPLOYEE_DOCUMENTS);
    else setDocuments([]);
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
  const [targets, setTargets] = useState<PerformanceTarget[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from('performance_targets')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) setTargets(data as PerformanceTarget[]);
    else if (USE_MOCK_DATA) setTargets(MOCK_PERFORMANCE_TARGETS);
    else setTargets([]);
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
    await refetch();
    return { success: true, data: data as PerformanceTarget };
  }, [refetch]);

  return { targets, loading, refetch, setTarget, updateProgress };
}

/* ═══════════════════════════════════════════════════════════════
   PERFORMANCE REVIEWS
   ═══════════════════════════════════════════════════════════════ */

export function usePerformanceReviews() {
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from('performance_reviews')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) setReviews(data as PerformanceReview[]);
    else if (USE_MOCK_DATA) setReviews(MOCK_PERFORMANCE_REVIEWS);
    else setReviews([]);
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
   CLINIC — Patients, Appointments, Treatments, Queue
   ═══════════════════════════════════════════════════════════════ */

export function useClinicPatients() {
  const [patients, setPatients] = useState<PatientWithOwner[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('patients')
      .select('*, owner:owner_id(id, full_name, phone)')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      setPatients(data as PatientWithOwner[]);
    } else {
      const { getPatients } = await import('@/lib/data-service');
      setPatients(await getPatients());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(id);
  }, [refetch]);

  return { patients, loading, refetch };
}

export function useClinicAppointments() {
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('appointments')
      .select('*, patient:patient_id(id, name, species), owner:owner_id(id, full_name)')
      .order('date', { ascending: true });

    if (!error && data && data.length > 0) {
      setAppointments(data as AppointmentWithRelations[]);
    } else {
      const { getAppointments } = await import('@/lib/data-service');
      setAppointments(await getAppointments());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(id);
  }, [refetch]);

  return { appointments, loading, refetch };
}

export function useClinicQueue() {
  const [queue, setQueue] = useState<PatientQueueWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('patient_queue')
      .select('*, patient:patient_id(id, name, species, weight_kg), owner:owner_id(id, full_name, phone)')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      setQueue(data as PatientQueueWithRelations[]);
    } else {
      const { getQueue } = await import('@/lib/data-service');
      setQueue(await getQueue());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(id);
  }, [refetch]);

  return { queue, loading, refetch };
}

export function useVetServices() {
  const [services, setServices] = useState<VetService[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('vet_services')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (!error && data && data.length > 0) {
      setServices(data as VetService[]);
    } else {
      const { getVetServices } = await import('@/lib/data-service');
      setServices(await getVetServices());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(id);
  }, [refetch]);

  return { services, loading, refetch };
}

export function useClinicTreatments() {
  const [treatments, setTreatments] = useState<TreatmentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('treatments')
      .select('*, patient:patient_id(id, name, species), vet:vet_id(id, full_name)')
      .order('date', { ascending: false });

    if (!error && data && data.length > 0) {
      setTreatments(data as TreatmentWithRelations[]);
    } else {
      const { getTreatments } = await import('@/lib/data-service');
      setTreatments(await getTreatments());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(id);
  }, [refetch]);

  return { treatments, loading, refetch };
}

export function useStockMovements(limit = 20) {
  const [movements, setMovements] = useState<StockMovementWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('stock_movements')
      .select('*, product:product_id(name), from_location:from_location_id(name), to_location:to_location_id(name)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!error && data) {
      setMovements(data as StockMovementWithRelations[]);
    } else {
      setMovements([]);
    }
    setLoading(false);
  }, [limit]);

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
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (USE_MOCK_DATA) {
      setSuppliers(MOCK_SUPPLIERS.filter((s) => s.is_active !== false));
      setLoading(false);
      return;
    }
    const { data, error } = await getSupabase()
      .from('suppliers')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (!error && data && data.length > 0) setSuppliers(data as Supplier[]);
    else setSuppliers([]);
    setLoading(false);
  }, []);

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
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { getLabOrders } = await import('@/lib/data-service');
    const data = await getLabOrders();
    setLabOrders(data);
    setLoading(false);
  }, []);

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
  const [hospitalizations, setHospitalizations] = useState<HospitalizationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { getHospitalizations } = await import('@/lib/data-service');
    const data = await getHospitalizations();
    setHospitalizations(data);
    setLoading(false);
  }, []);

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
  const [surgeries, setSurgeries] = useState<SurgeryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { getSurgeries } = await import('@/lib/data-service');
    const data = await getSurgeries();
    setSurgeries(data);
    setLoading(false);
  }, []);

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
  const [reconciliations, setReconciliations] = useState<CashReconciliation[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { getCashReconciliations } = await import('@/lib/data-service');
    const data = await getCashReconciliations();
    setReconciliations(data);
    setLoading(false);
  }, []);

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
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { getAuditLogs } = await import('@/lib/data-service');
    const data = await getAuditLogs(filter);
    setAuditLogs(data);
    setLoading(false);
  }, [filter?.category, filter?.search]);

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
  const [expenses, setExpenses] = useState<BranchExpense[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { getBranchExpenses } = await import('@/lib/data-service');
    const data = await getBranchExpenses(locationId);
    setExpenses(data);
    setLoading(false);
  }, [locationId]);

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
  const [shifts, setShifts] = useState<ClinicShift[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { getClinicShifts } = await import('@/lib/data-service');
    const data = await getClinicShifts(locationId);
    setShifts(data);
    setLoading(false);
  }, [locationId]);

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
  const [reminders, setReminders] = useState<PatientReminder[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { getPatientReminders } = await import('@/lib/data-service');
    const data = await getPatientReminders(status);
    setReminders(data);
    setLoading(false);
  }, [status]);

  useEffect(() => {
    const id = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(id);
  }, [refetch]);

  return { reminders, loading, refetch };
}



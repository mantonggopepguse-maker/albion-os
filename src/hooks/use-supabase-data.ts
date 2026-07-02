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
import type {
  Product, Customer, Invoice, InvoiceItem,
  Payment, InventoryItem, Location, User, ChatMessage,
  SalaryGrade, PayrollRun, Payslip,
  LeaveRequest, AttendanceLog,
  EmployeeDocument, PerformanceTarget, PerformanceReview,
  LeaveType, DocumentType, TargetType,
} from '@/lib/types';
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
} from '@/lib/mock-data';

/* ── Supabase client singleton for this module ── */
function getSupabase() {
  return createClient();
}

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
    else setProducts(fetchInactive ? MOCK_PRODUCTS : MOCK_PRODUCTS.filter((p) => p.is_active !== false));
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
    else setCustomers(fetchInactive ? MOCK_CUSTOMERS : MOCK_CUSTOMERS.filter((c) => c.is_active !== false));
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
    } else {
      setInvoices(MOCK_INVOICES);
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
    const { error } = await getSupabase()
      .from('invoices')
      .update({ status })
      .eq('id', invoiceId);

    if (error) return { success: false, error: error.message };
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
    else setPayments(MOCK_PAYMENTS);
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
    // Fetch payment to get invoice and amount
    const { data: payment } = await getSupabase()
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (!payment) return { success: false, error: 'Payment not found' };

    if (payment.invoice_id) {
      // Get the invoice to check outstanding balance
      const { data: invoice } = await getSupabase()
        .from('invoices')
        .select('*')
        .eq('id', payment.invoice_id)
        .single();

      if (invoice) {
        // Calculate total approved payments for this invoice
        const { data: approvedPayments } = await getSupabase()
          .from('payments')
          .select('amount')
          .eq('invoice_id', payment.invoice_id)
          .eq('status', 'approved');

        const approvedTotal = (approvedPayments || []).reduce((sum, p) => sum + p.amount, 0);
        const newPaid = approvedTotal + payment.amount;

        if (newPaid > invoice.total) {
          return { success: false, error: 'Payment exceeds remaining invoice balance' };
        }

        // Update invoice status
        const invStatus = newPaid >= invoice.total ? 'paid' : 'partial';
        await getSupabase()
          .from('invoices')
          .update({ status: invStatus })
          .eq('id', payment.invoice_id);

        // Update customer outstanding balance
        const { data: customer } = await getSupabase()
          .from('customers')
          .select('outstanding_balance')
          .eq('id', payment.customer_id)
          .single();

        if (customer) {
          const newBalance = Math.max(0, customer.outstanding_balance - payment.amount);
          await getSupabase()
            .from('customers')
            .update({ outstanding_balance: newBalance })
            .eq('id', payment.customer_id);
        }
      }
    }

    const { error } = await getSupabase()
      .from('payments')
      .update({ status: 'approved', approved_by: approverId })
      .eq('id', paymentId);

    if (error) return { success: false, error: error.message };
    await refetch();
    return { success: true };
  }, [refetch]);

  const rejectPayment = useCallback(async (paymentId: string, approverId: string, reason?: string) => {
    const { error } = await getSupabase()
      .from('payments')
      .update({
        status: 'rejected',
        approved_by: approverId,
        notes: reason || 'Rejected',
      })
      .eq('id', paymentId);

    if (error) return { success: false, error: error.message };
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
    else setInventory(MOCK_INVENTORY);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refetch]);

  const allocateStock = useCallback(async (input: AllocateStockInput) => {
    /* Find source batches sorted by expiry (FEFO) */
    const { data: sourceItems } = await getSupabase()
      .from('inventory')
      .select('*')
      .eq('product_id', input.product_id)
      .eq('location_id', input.from_location_id)
      .gt('quantity', 0)
      .order('expiry_date', { ascending: true });

    if (!sourceItems || sourceItems.length === 0) {
      return { success: false, error: 'No stock available at the source location' };
    }

    /* Pick the batch that matches the requested batch_number, or use earliest-expiring */
    let sourceItem = sourceItems.find((s) => s.batch_number === input.batch_number);
    if (!sourceItem) {
      sourceItem = sourceItems[0];
    }

    if (sourceItem.quantity < input.quantity) {
      return { success: false, error: 'Insufficient stock in the selected batch' };
    }

    /* Deduct from source */
    const newQty = sourceItem.quantity - input.quantity;
    const { error: updateError } = await getSupabase()
      .from('inventory')
      .update({
        quantity: newQty,
        status: newQty === 0 ? 'out_of_stock' : newQty < 50 ? 'low_stock' : 'in_stock',
      })
      .eq('id', sourceItem.id);

    if (updateError) return { success: false, error: updateError.message };

    /* Check if destination already has this batch */
    const { data: destItem } = await getSupabase()
      .from('inventory')
      .select('*')
      .eq('product_id', input.product_id)
      .eq('location_id', input.to_location_id)
      .eq('batch_number', input.batch_number)
      .maybeSingle();

    if (destItem) {
      /* Add to existing record */
      await getSupabase()
        .from('inventory')
        .update({ quantity: destItem.quantity + input.quantity, status: 'in_stock' })
        .eq('id', destItem.id);
    } else {
      /* Create new record at destination */
      await getSupabase()
        .from('inventory')
        .insert({
          product_id: input.product_id,
          location_id: input.to_location_id,
          quantity: input.quantity,
          batch_number: input.batch_number,
          expiry_date: sourceItem.expiry_date,
          status: 'in_stock',
        });
    }

    /* Log the stock movement for audit */
    const { data: { user } } = await getSupabase().auth.getUser();
    await getSupabase()
      .from('stock_movements')
      .insert({
        product_id: input.product_id,
        from_location_id: input.from_location_id,
        to_location_id: input.to_location_id,
        quantity: input.quantity,
        movement_type: 'allocation',
        performed_by: user?.id || null,
      });

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
    } else {
      setLocations(MOCK_LOCATIONS);
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
    } else {
      setUsers(MOCK_USERS);
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
        (payload) => {
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

    unread.forEach((msg) => {
      getSupabase()
        .from('chat_messages')
        .update({ is_read: true })
        .eq('id', msg.id)
        .then(() => {
          setMessages((prev) =>
            prev.map((m) => (m.id === msg.id ? { ...m, is_read: true } : m))
          );
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, selectedUserId]);

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
    else setSalaryGrades(MOCK_SALARY_GRADES);
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
    else setPayrollRuns(MOCK_PAYROLL_RUNS);
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
    return MOCK_PAYSLIPS.filter((ps) => ps.payroll_run_id === payrollRunId);
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
    else setLeaveRequests(MOCK_LEAVE_REQUESTS);
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
    else setLogs(MOCK_ATTENDANCE_LOGS);
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
    else setDocuments(MOCK_EMPLOYEE_DOCUMENTS);
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
    else setTargets(MOCK_PERFORMANCE_TARGETS);
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
    else setReviews(MOCK_PERFORMANCE_REVIEWS);
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
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('patients')
      .select('*, owner:owner_id(id, full_name, phone)')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      setPatients(data as any[]);
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
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('appointments')
      .select('*, patient:patient_id(id, name, species), owner:owner_id(id, full_name)')
      .order('date', { ascending: true });

    if (!error && data && data.length > 0) {
      setAppointments(data as any[]);
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
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('patient_queue')
      .select('*, patient:patient_id(id, name, species, weight_kg), owner:owner_id(id, full_name, phone)')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      setQueue(data as any[]);
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
  const [services, setServices] = useState<any[]>([]);
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
      setServices(data as any[]);
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
  const [treatments, setTreatments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('treatments')
      .select('*, patient:patient_id(id, name, species), vet:vet_id(id, full_name)')
      .order('date', { ascending: false });

    if (!error && data && data.length > 0) {
      setTreatments(data as any[]);
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

import { createServerSupabaseClient } from './supabase/server';
import { ExpenseCategory, ExpenseData, FinanceSummary, InvoiceData, InvoiceStatus, PaymentData, PaymentMethod } from '@/types';
import { logActivity } from './data';
import { VAT_RATE, withVat } from './format';
import { normalizePeriod } from './period';
import { EXPENSE_CATEGORIES, INVOICE_STATUSES } from './constants';

export { EXPENSE_CATEGORIES, INVOICE_STATUSES };

const INVOICE_SELECT =
  'id, client_id, number, issue_date, due_date, period_label, subtotal, vat_rate, total, status, notes, created_by, created_at, clients(name)';

function mapInvoice(row: any, paidAmount = 0): InvoiceData {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.clients?.name,
    number: row.number,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    periodLabel: row.period_label,
    subtotal: Number(row.subtotal),
    vatRate: Number(row.vat_rate),
    total: Number(row.total),
    status: row.status,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    paidAmount,
  };
}

export async function fetchFinanceSummary(period?: string): Promise<FinanceSummary> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc('get_finance_summary', {
    p_period: normalizePeriod(period),
  });
  if (error) throw error;

  const raw = data as any;
  const series = (raw.monthlySeries || []).map((s: any) => ({
    month: s.month,
    revenue: Number(s.revenue || 0),
    expenses: Number(s.expenses || 0),
    profit: Number(s.revenue || 0) - Number(s.expenses || 0),
  }));
  const clients = (raw.clientProfitability || []).map((c: any) => ({
    clientId: c.clientId,
    name: c.name,
    revenue: Number(c.revenue || 0),
    expenses: Number(c.expenses || 0),
    profit: Number(c.revenue || 0) - Number(c.expenses || 0),
  }));
  const revenueReceived = Number(raw.revenueReceived || 0);
  const expenses = Number(raw.expenses || 0);
  const profit = revenueReceived - expenses;

  return {
    period: raw.period,
    revenueReceived,
    invoiced: Number(raw.invoiced || 0),
    outstanding: Number(raw.outstanding || 0),
    overdue: Number(raw.overdue || 0),
    expenses,
    profit,
    margin: revenueReceived > 0 ? Math.round((profit / revenueReceived) * 100) : 0,
    mrr: Number(raw.mrr || 0),
    expensesByCategory: raw.expensesByCategory || {},
    monthlySeries: series,
    clientProfitability: clients.sort((a: any, b: any) => b.profit - a.profit),
  };
}

export async function fetchInvoices(filters?: { status?: string; clientId?: string }): Promise<InvoiceData[]> {
  const supabase = createServerSupabaseClient();
  let query = supabase.from('invoices').select(INVOICE_SELECT).order('issue_date', { ascending: false });
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.clientId) query = query.eq('client_id', filters.clientId);
  const { data, error } = await query;
  if (error) throw error;

  const ids = (data || []).map((i: any) => i.id);
  let paidByInvoice = new Map<string, number>();
  if (ids.length) {
    const { data: pays } = await supabase.from('payments').select('invoice_id, amount').in('invoice_id', ids);
    for (const p of pays || []) {
      paidByInvoice.set(p.invoice_id, (paidByInvoice.get(p.invoice_id) || 0) + Number(p.amount));
    }
  }
  return (data || []).map((row: any) => mapInvoice(row, paidByInvoice.get(row.id) || 0));
}

export async function fetchInvoice(id: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from('invoices').select(INVOICE_SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: payments } = await supabase
    .from('payments')
    .select('id, invoice_id, amount, paid_at, method, reference')
    .eq('invoice_id', id)
    .order('paid_at', { ascending: true });
  const paid = (payments || []).reduce((s, p) => s + Number(p.amount), 0);
  return {
    invoice: mapInvoice(data, paid),
    payments: (payments || []).map(
      (p): PaymentData => ({
        id: p.id,
        invoiceId: p.invoice_id,
        amount: Number(p.amount),
        paidAt: p.paid_at,
        method: p.method as PaymentMethod,
        reference: p.reference,
      })
    ),
  };
}

async function nextInvoiceNumber(): Promise<string> {
  const supabase = createServerSupabaseClient();
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const { data } = await supabase
    .from('invoices')
    .select('number')
    .like('number', `${prefix}%`)
    .order('number', { ascending: false })
    .limit(1);
  const last = data?.[0]?.number as string | undefined;
  const seq = last ? Number(last.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

export async function createInvoice(input: {
  clientId: string;
  issueDate?: string;
  dueDate?: string | null;
  periodLabel?: string | null;
  subtotal: number;
  vatRate?: number;
  notes?: string | null;
  createdBy: string;
  status?: InvoiceStatus;
}) {
  const supabase = createServerSupabaseClient();
  const vatRate = input.vatRate ?? VAT_RATE;
  const { subtotal, total } = withVat(Number(input.subtotal), vatRate);
  const number = await nextInvoiceNumber();
  const { data, error } = await supabase
    .from('invoices')
    .insert({
      client_id: input.clientId,
      number,
      issue_date: input.issueDate || new Date().toISOString().slice(0, 10),
      due_date: input.dueDate || null,
      period_label: input.periodLabel || null,
      subtotal,
      vat_rate: vatRate,
      total,
      notes: input.notes || null,
      created_by: input.createdBy,
      status: input.status || 'draft',
    })
    .select(INVOICE_SELECT)
    .single();
  if (error) throw error;
  await logActivity({ action: 'create', entity: 'invoice', entityId: data.id, diff: { number, total } });
  return mapInvoice(data);
}

export async function updateInvoice(
  id: string,
  fields: Partial<{
    issueDate: string;
    dueDate: string | null;
    periodLabel: string | null;
    subtotal: number;
    vatRate: number;
    notes: string | null;
    status: InvoiceStatus;
  }>
) {
  const supabase = createServerSupabaseClient();
  const patch: Record<string, unknown> = {};
  if (fields.issueDate !== undefined) patch.issue_date = fields.issueDate;
  if (fields.dueDate !== undefined) patch.due_date = fields.dueDate;
  if (fields.periodLabel !== undefined) patch.period_label = fields.periodLabel;
  if (fields.notes !== undefined) patch.notes = fields.notes;
  if (fields.status !== undefined) patch.status = fields.status;
  if (fields.subtotal !== undefined || fields.vatRate !== undefined) {
    const { data: existing } = await supabase.from('invoices').select('subtotal, vat_rate').eq('id', id).single();
    const subtotal = fields.subtotal ?? Number(existing?.subtotal || 0);
    const vatRate = fields.vatRate ?? Number(existing?.vat_rate || VAT_RATE);
    const computed = withVat(subtotal, vatRate);
    patch.subtotal = computed.subtotal;
    patch.vat_rate = vatRate;
    patch.total = computed.total;
  }
  const { data, error } = await supabase.from('invoices').update(patch).eq('id', id).select(INVOICE_SELECT).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  await logActivity({ action: 'update', entity: 'invoice', entityId: id, diff: patch });
  return mapInvoice(data);
}

export async function recordPayment(input: {
  invoiceId: string;
  amount: number;
  paidAt?: string;
  method?: PaymentMethod;
  reference?: string | null;
}) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('payments')
    .insert({
      invoice_id: input.invoiceId,
      amount: input.amount,
      paid_at: input.paidAt || new Date().toISOString().slice(0, 10),
      method: input.method || 'bank_transfer',
      reference: input.reference || null,
    })
    .select()
    .single();
  if (error) throw error;
  await logActivity({
    action: 'create',
    entity: 'payment',
    entityId: data.id,
    diff: { invoiceId: input.invoiceId, amount: input.amount },
  });
  return data;
}

export async function fetchExpenses(filters?: {
  category?: string;
  clientId?: string;
  from?: string;
  to?: string;
}): Promise<ExpenseData[]> {
  const supabase = createServerSupabaseClient();
  let query = supabase
    .from('expenses')
    .select('*, clients(name), creators(name)')
    .order('date', { ascending: false });
  if (filters?.category) query = query.eq('category', filters.category);
  if (filters?.clientId) query = query.eq('client_id', filters.clientId);
  if (filters?.from) query = query.gte('date', filters.from);
  if (filters?.to) query = query.lte('date', filters.to);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(
    (row: any): ExpenseData => ({
      id: row.id,
      date: row.date,
      amount: Number(row.amount),
      category: row.category,
      description: row.description,
      clientId: row.client_id,
      clientName: row.clients?.name ?? null,
      partnerId: row.partner_id,
      partnerName: row.creators?.name ?? null,
      assignmentId: row.assignment_id,
      recurring: row.recurring,
      recurrence: row.recurrence,
      receiptUrl: row.receipt_url,
      createdBy: row.created_by,
      createdAt: row.created_at,
    })
  );
}

export async function createExpense(input: {
  date: string;
  amount: number;
  category: ExpenseCategory;
  description?: string | null;
  clientId?: string | null;
  partnerId?: string | null;
  assignmentId?: string | null;
  recurring?: boolean;
  recurrence?: 'monthly' | 'yearly' | null;
  createdBy: string;
}) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      date: input.date,
      amount: input.amount,
      category: input.category,
      description: input.description || null,
      client_id: input.clientId || null,
      partner_id: input.partnerId || null,
      assignment_id: input.assignmentId || null,
      recurring: Boolean(input.recurring),
      recurrence: input.recurrence || null,
      created_by: input.createdBy,
    })
    .select()
    .single();
  if (error) throw error;
  await logActivity({ action: 'create', entity: 'expense', entityId: data.id, diff: { amount: input.amount, category: input.category } });
  return data;
}

export async function deleteExpense(id: string) {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;
  await logActivity({ action: 'delete', entity: 'expense', entityId: id });
}

import { cache } from 'react';
import { createServerSupabaseClient } from './supabase/server';
import { ClientStatus, DashboardMetrics } from '@/types';
import { currentMonth, detectPeriodKind, normalizePeriod } from './period';

interface DashboardSnapshot {
  isYear: boolean;
  isAdmin: boolean;
  revenueActual: number | string | null;
  expensesActual: number | string | null;
  profitActual: number | string | null;
  outstanding: number | string | null;
  overdue: number | string | null;
  mrr: number | string | null;
  deliverablesActual: number;
  newClientsActual: number;
  viewsActual: number;
  pipeline: Record<string, number | string> | null;
  activeCount: number;
  churnedCount: number;
  totalClients: number;
  targets: Record<string, number | string> | null;
  topClients: Array<{
    id: string;
    name: string;
    status: ClientStatus;
    contract_value: number | string | null;
  }> | null;
}

export interface DashboardClient {
  id: string;
  name: string;
  status: ClientStatus;
  contractValue: number | null;
}

async function computeSnapshotDirectly(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  periodValue: string
): Promise<DashboardSnapshot> {
  let isYear = false;
  let startDateStr = '';
  let endDateStr = '';
  const now = new Date();

  if (/^\d{4}$/.test(periodValue)) {
    isYear = true;
    startDateStr = `${periodValue}-01-01`;
    endDateStr = `${periodValue}-12-31`;
  } else if (/^\d{4}-\d{2}$/.test(periodValue)) {
    isYear = false;
    const [y, m] = periodValue.split('-').map(Number);
    startDateStr = `${periodValue}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    endDateStr = `${periodValue}-${String(lastDay).padStart(2, '0')}`;
  } else {
    throw new Error(`Invalid period format: ${periodValue}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
    : { data: null };
  const isAdmin = profile?.role === 'admin';

  const [
    paymentsRes,
    expensesRes,
    invoicesRes,
    allPaymentsRes,
    contractsRes,
    deliverablesRes,
    clientsRes,
    goalsRes,
  ] = await Promise.all([
    isAdmin
      ? supabase.from('payments').select('amount').gte('paid_at', startDateStr).lte('paid_at', endDateStr)
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from('expenses').select('amount').gte('date', startDateStr).lte('date', endDateStr)
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from('invoices').select('id, total, status, due_date')
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from('payments').select('invoice_id, amount')
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase
          .from('client_contracts')
          .select('client_id, monthly_fee, contract_type, clients!inner(status)')
          .eq('contract_type', 'retainer')
          .eq('clients.status', 'active')
      : Promise.resolve({ data: [] }),
    supabase
      .from('deliverables')
      .select('id, published, publish_date, post_metrics(views)')
      .eq('published', true)
      .gte('publish_date', startDateStr)
      .lte('publish_date', endDateStr),
    supabase
      .from('clients')
      .select('id, name, status, created_at, client_contracts(monthly_fee)'),
    supabase.from('goals').select('metric, target').eq('period_value', periodValue),
  ]);

  const revenueActual = (paymentsRes.data || []).reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0);
  const expensesActual = (expensesRes.data || []).reduce((acc: number, e: any) => acc + Number(e.amount || 0), 0);

  const paidMap = new Map<string, number>();
  for (const p of allPaymentsRes.data || []) {
    if (p.invoice_id) {
      paidMap.set(p.invoice_id, (paidMap.get(p.invoice_id) || 0) + Number(p.amount || 0));
    }
  }

  let outstanding = 0;
  let overdue = 0;
  const todayStr = now.toISOString().slice(0, 10);
  for (const inv of invoicesRes.data || []) {
    const paid = paidMap.get(inv.id) || 0;
    const due = Number(inv.total || 0) - paid;
    if (['sent', 'partially_paid', 'overdue'].includes(inv.status)) {
      outstanding += due;
    }
    if (inv.status === 'overdue' || (['sent', 'partially_paid'].includes(inv.status) && inv.due_date < todayStr)) {
      overdue += due;
    }
  }

  const mrr = (contractsRes.data || []).reduce((acc: number, c: any) => acc + Number(c.monthly_fee || 0), 0);

  const deliverablesActual = (deliverablesRes.data || []).length;
  let viewsActual = 0;
  for (const d of deliverablesRes.data || []) {
    const metrics = (d as any).post_metrics || [];
    for (const pm of metrics) {
      viewsActual += Number(pm.views || 0);
    }
  }

  const pipeline: Record<string, number> = { potential: 0, starting: 0, active: 0, paused: 0, churned: 0 };
  let newClientsActual = 0;
  const startTs = new Date(`${startDateStr}T00:00:00Z`).getTime();
  const endTs = new Date(`${endDateStr}T23:59:59.999Z`).getTime();

  for (const c of clientsRes.data || []) {
    if (pipeline[c.status] !== undefined) {
      pipeline[c.status]++;
    }
    if (c.created_at) {
      const createdTs = new Date(c.created_at).getTime();
      if (createdTs >= startTs && createdTs <= endTs) {
        newClientsActual++;
      }
    }
  }

  const totalClients = (clientsRes.data || []).length;
  const activeCount = pipeline.active;
  const churnedCount = pipeline.churned;

  const targets: Record<string, number> = {};
  for (const g of goalsRes.data || []) {
    if (isAdmin || !['revenue', 'profit'].includes(g.metric)) {
      targets[g.metric] = Number(g.target || 0);
    }
  }

  let topClients: Array<{ id: string; name: string; status: ClientStatus; contract_value: number | null }> = [];
  if (isAdmin) {
    const sorted = [...(clientsRes.data || [])].sort((a: any, b: any) => {
      const feeA = Number(a.client_contracts?.[0]?.monthly_fee ?? a.client_contracts?.monthly_fee ?? 0);
      const feeB = Number(b.client_contracts?.[0]?.monthly_fee ?? b.client_contracts?.monthly_fee ?? 0);
      return feeB - feeA;
    });
    topClients = sorted.slice(0, 8).map((c: any) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      contract_value: c.client_contracts?.[0]?.monthly_fee ?? c.client_contracts?.monthly_fee ?? null,
    }));
  } else {
    topClients = (clientsRes.data || []).slice(0, 8).map((c: any) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      contract_value: null,
    }));
  }

  return {
    isYear,
    isAdmin,
    revenueActual: isAdmin ? revenueActual : null,
    expensesActual: isAdmin ? expensesActual : null,
    profitActual: isAdmin ? revenueActual - expensesActual : null,
    outstanding: isAdmin ? outstanding : null,
    overdue: isAdmin ? overdue : null,
    mrr: isAdmin ? mrr : null,
    deliverablesActual,
    newClientsActual,
    viewsActual,
    pipeline,
    activeCount,
    churnedCount,
    totalClients,
    targets,
    topClients,
  };
}

const getSnapshot = cache(async (periodValue: string): Promise<DashboardSnapshot> => {
  const supabase = createServerSupabaseClient();
  try {
    const { data, error } = await supabase.rpc('get_dashboard_snapshot', {
      p_period: periodValue,
    });

    if (!error && data) {
      return data as unknown as DashboardSnapshot;
    }
    if (error) {
      console.warn('get_dashboard_snapshot RPC returned error, using direct query fallback:', error.message);
    }
  } catch (err) {
    console.warn('get_dashboard_snapshot RPC call failed, using direct query fallback:', err);
  }

  return computeSnapshotDirectly(supabase, periodValue);
});

function calcPercent(actual: number, target: number) {
  if (target <= 0) return 100;
  return Math.round((actual / target) * 100);
}

export async function computeGoalsAndMetrics(periodValue?: string): Promise<DashboardMetrics> {
  const period = normalizePeriod(periodValue);
  const snap = await getSnapshot(period);
  const isYear = detectPeriodKind(period) === 'year';

  const pipelineBreakdown: Record<ClientStatus, number> = {
    potential: 0,
    starting: 0,
    active: 0,
    paused: 0,
    churned: 0,
  };

  let totalClients = 0;
  for (const [status, count] of Object.entries(snap.pipeline || {})) {
    pipelineBreakdown[status as ClientStatus] = Number(count);
    totalClients += Number(count);
  }

  const retentionDenominator = snap.activeCount + snap.churnedCount;
  const retentionActual =
    retentionDenominator > 0 ? Math.round((snap.activeCount / retentionDenominator) * 100) : 100;

  const targetMap: Record<string, number> = {};
  for (const [metric, target] of Object.entries(snap.targets || {})) {
    targetMap[metric] = Number(target);
  }

  const deliverablesActual = Number(snap.deliverablesActual || 0);
  const newClientsActual = Number(snap.newClientsActual || 0);
  const viewsActual = Number(snap.viewsActual || 0);

  const deliverablesTarget = targetMap['deliverables'] ?? (isYear ? 120 : 10);
  const newClientsTarget = targetMap['new_clients'] ?? (isYear ? 20 : 3);
  const retentionTarget = targetMap['retention'] ?? 90;
  const viewsTarget = targetMap['views'] ?? (isYear ? 5000000 : 400000);

  const admin = Boolean(snap.isAdmin);
  const revenueActual = admin ? Number(snap.revenueActual || 0) : 0;
  const profitActual = admin ? Number(snap.profitActual || 0) : 0;
  const revenueTarget = targetMap['revenue'] ?? (isYear ? 800000 : 75000);
  const profitTarget = targetMap['profit'] ?? (isYear ? 250000 : 20000);

  return {
    periodValue: period,
    isAdmin: admin,
    revenue: admin
      ? { actual: revenueActual, target: revenueTarget, percent: calcPercent(revenueActual, revenueTarget) }
      : null,
    profit: admin
      ? { actual: profitActual, target: profitTarget, percent: calcPercent(profitActual, profitTarget) }
      : null,
    expenses: admin ? Number(snap.expensesActual || 0) : null,
    outstanding: admin ? Number(snap.outstanding || 0) : null,
    overdue: admin ? Number(snap.overdue || 0) : null,
    mrr: admin ? Number(snap.mrr || 0) : null,
    deliverables: {
      actual: deliverablesActual,
      target: deliverablesTarget,
      percent: calcPercent(deliverablesActual, deliverablesTarget),
    },
    newClients: {
      actual: newClientsActual,
      target: newClientsTarget,
      percent: calcPercent(newClientsActual, newClientsTarget),
    },
    retention: {
      actual: retentionActual,
      target: retentionTarget,
      percent: calcPercent(retentionActual, retentionTarget),
    },
    views: {
      actual: viewsActual,
      target: viewsTarget,
      percent: calcPercent(viewsActual, viewsTarget),
    },
    pipelineBreakdown,
    totalClients,
  };
}

export async function getDashboardClients(periodValue: string = currentMonth()): Promise<DashboardClient[]> {
  const snap = await getSnapshot(normalizePeriod(periodValue));
  const hideMoney = !snap.isAdmin;
  return (snap.topClients || []).map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    contractValue:
      hideMoney || c.contract_value == null ? null : Number(c.contract_value),
  }));
}

import React from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser, isAdmin } from '@/lib/permissions';
import { fetchFinanceSummary } from '@/lib/finance';
import { AppShell } from '@/components/AppShell';
import FinanceTrend from '@/components/FinanceTrend';
import { PeriodPicker } from '@/components/PeriodPicker';
import { currentMonth, normalizePeriod, periodLabel } from '@/lib/period';
import { formatMoney, formatPercent } from '@/lib/format';
import { Suspense } from 'react';

export default async function FinancePage({ searchParams }: { searchParams?: { period?: string } }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) redirect('/dashboard');

  const period = normalizePeriod(searchParams?.period || currentMonth());
  const summary = await fetchFinanceSummary(period);

  return (
    <AppShell
      user={user}
      title="Finance"
      subtitle={`${periodLabel(period)} · TND`}
      actions={
        <Suspense fallback={null}>
          <PeriodPicker />
        </Suspense>
      }
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Link href="/finance/invoices" className="btn btn-primary btn-sm">
          Invoices
        </Link>
        <Link href="/finance/expenses" className="btn btn-secondary btn-sm">
          Expenses
        </Link>
      </div>

      <div className="grid-responsive-4" style={{ gap: 12, marginBottom: 16 }}>
        <Kpi label="Revenue received" value={formatMoney(summary.revenueReceived)} />
        <Kpi label="Expenses" value={formatMoney(summary.expenses)} />
        <Kpi label="Profit" value={formatMoney(summary.profit)} />
        <Kpi label="Margin" value={formatPercent(summary.margin)} />
      </div>
      <div className="grid-responsive-3" style={{ gap: 12, marginBottom: 16 }}>
        <Kpi label="Invoiced" value={formatMoney(summary.invoiced)} />
        <Kpi label="Outstanding" value={formatMoney(summary.outstanding)} />
        <Kpi label="Overdue" value={formatMoney(summary.overdue)} />
      </div>

      <div className="grid-split-wide" style={{ gap: 16 }}>
        <FinanceTrend data={summary.monthlySeries} />
        <div className="glass-card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13 }}>Expenses by category</div>
          {Object.entries(summary.expensesByCategory).map(([cat, amt]) => (
            <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0' }}>
              <span style={{ textTransform: 'capitalize' }}>{cat.replace('_', ' ')}</span>
              <span>{formatMoney(Number(amt))}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card" style={{ marginTop: 16, overflow: 'hidden' }}>
        <div style={{ padding: 16, fontWeight: 600, fontSize: 13 }}>Client profitability</div>
        <div className="table-responsive-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ minWidth: 140 }}>Client</th>
                <th>Revenue</th>
                <th>Expenses</th>
                <th>Profit</th>
              </tr>
            </thead>
            <tbody>
              {summary.clientProfitability.map((c) => (
                <tr key={c.clientId}>
                  <td>
                    <Link href={`/clients/${c.clientId}`}>{c.name}</Link>
                  </td>
                  <td>{formatMoney(c.revenue)}</td>
                  <td>{formatMoney(c.expenses)}</td>
                  <td style={{ fontWeight: 700 }}>{formatMoney(c.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card" style={{ padding: 16 }}>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{value}</div>
    </div>
  );
}

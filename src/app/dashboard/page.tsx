import React from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '@/lib/permissions';
import { computeGoalsAndMetrics, getDashboardClients } from '@/lib/goals';
import { fetchClients } from '@/lib/data';
import { AppShell } from '@/components/AppShell';
import { GoalProgressCard } from '@/components/GoalProgressCard';
import { GaugeCard } from '@/components/GaugeCard';
import { StageBarChart } from '@/components/StageBarChart';
import { StatusBadge } from '@/components/StatusBadge';
import { currentMonth, normalizePeriod, periodLabel } from '@/lib/period';
import { formatMoney } from '@/lib/format';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import FinanceTrend from '@/components/FinanceTrend';

interface DashboardPageProps {
  searchParams?: { period?: string };
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const period = normalizePeriod(searchParams?.period || currentMonth());
  const [metrics, top] = await Promise.all([
    computeGoalsAndMetrics(period),
    getDashboardClients(period),
  ]);

  const clients = await fetchClients({ userRole: user.role, userId: user.id });
  const sidebarClients = clients.slice(0, 4).map((c) => ({
    id: c.id,
    name: c.name,
    monthlyFee: user.role === 'admin' ? c.contract?.monthlyFee ?? null : null,
  }));

  const supabase = createServerSupabaseClient();
  const { data: atRisk } = await supabase
    .from('client_health_snapshots')
    .select('client_id, score, risk, ai_summary, computed_at, clients(id, name, status)')
    .in('risk', ['medium', 'high'])
    .order('score', { ascending: true })
    .limit(5);

  return (
    <AppShell
      user={user}
      title="Cockpit"
      subtitle={`${periodLabel(period)} • ${user.role === 'admin' ? 'Agency-wide' : 'Your accounts'}`}
      topClients={sidebarClients}
    >
      <div className="grid-responsive-4" style={{ marginBottom: 18 }}>
        {user.role === 'admin' && metrics.revenue ? (
          <GoalProgressCard title="Revenue received" actual={metrics.revenue.actual} target={metrics.revenue.target} isCurrency />
        ) : (
          <GoalProgressCard title="New clients" actual={metrics.newClients.actual} target={metrics.newClients.target} />
        )}
        <GoalProgressCard
          title="Deliverables published"
          actual={metrics.deliverables.actual}
          target={metrics.deliverables.target}
          unit="posts"
        />
        {user.role === 'admin' && metrics.profit ? (
          <GoalProgressCard title="Profit" actual={metrics.profit.actual} target={metrics.profit.target} isCurrency />
        ) : (
          <GoalProgressCard title="Views" actual={metrics.views.actual} target={metrics.views.target} />
        )}
        <GoalProgressCard title="Retention" actual={metrics.retention.actual} target={metrics.retention.target} unit="%" />
      </div>

      <div className="grid-cockpit-gauges" style={{ marginBottom: 18 }}>
        <GaugeCard
          title={user.role === 'admin' ? 'Revenue vs goal' : 'Content pace'}
          percentage={user.role === 'admin' ? metrics.revenue?.percent || 0 : metrics.deliverables.percent}
          color="#f97316"
          badgeLabel={`Active clients: ${metrics.pipelineBreakdown.active}`}
        />
        <GaugeCard
          title="Retention"
          percentage={metrics.retention.percent}
          color="#38bdf8"
          badgeLabel={`${metrics.retention.actual}% retained`}
        />
        {user.role === 'admin' ? (
          <FinanceSpark period={period} />
        ) : (
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Views this period</div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 12 }}>{metrics.views.actual.toLocaleString()}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Target {metrics.views.target.toLocaleString()}</div>
          </div>
        )}
      </div>

      {user.role === 'admin' && (
        <div className="grid-responsive-4" style={{ marginBottom: 18 }}>
          <MiniStat label="MRR" value={formatMoney(metrics.mrr)} />
          <MiniStat label="Expenses" value={formatMoney(metrics.expenses)} />
          <MiniStat label="Outstanding" value={formatMoney(metrics.outstanding)} />
          <MiniStat label="Overdue" value={formatMoney(metrics.overdue)} />
        </div>
      )}

      <div className="grid-split">
        <StageBarChart breakdown={metrics.pipelineBreakdown} totalClients={metrics.totalClients} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="glass-card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13 }}>At-risk clients</div>
            {(atRisk || []).length === 0 ? (
              <div style={{ fontSize: 12, color: '#9ca3af' }}>No health snapshots yet. Ask AI or run the health check from settings.</div>
            ) : (
              (atRisk || []).map((row: any) => (
                <Link
                  key={row.client_id}
                  href={`/clients/${row.client_id}`}
                  style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12 }}
                >
                  <span>{row.clients?.name}</span>
                  <span style={{ color: row.risk === 'high' ? '#e11d48' : '#d97706', fontWeight: 600 }}>
                    {row.score} · {row.risk}
                  </span>
                </Link>
              ))
            )}
          </div>
          <div className="glass-card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13 }}>
              {user.role === 'admin' ? 'Highest value accounts' : 'Your accounts'}
            </div>
            <div className="table-responsive-wrapper">
              <table className="data-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Account</th>
                    {user.role === 'admin' && <th>Fee</th>}
                    <th>Stage</th>
                  </tr>
                </thead>
              <tbody>
                {top.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/clients/${c.id}`} style={{ fontWeight: 600 }}>
                        {c.name}
                      </Link>
                    </td>
                    {user.role === 'admin' && <td>{c.contractValue != null ? formatMoney(c.contractValue) : '—'}</td>}
                    <td>
                      <StatusBadge status={c.status} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card" style={{ padding: '16px 20px' }}>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{value}</div>
    </div>
  );
}

async function FinanceSpark({ period }: { period: string }) {
  const { fetchFinanceSummary } = await import('@/lib/finance');
  try {
    const summary = await fetchFinanceSummary(period);
    return <FinanceTrend data={summary.monthlySeries} />;
  } catch {
    return (
      <div className="glass-card" style={{ padding: 20 }}>
        <div style={{ fontSize: 12, color: '#6b7280' }}>Revenue this year</div>
        <div style={{ fontSize: 13, marginTop: 12 }}>No finance data yet.</div>
      </div>
    );
  }
}

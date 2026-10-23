'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatCompactMoney } from '@/lib/format';

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatMonthTick(m: string): string {
  const num = parseInt(String(m).slice(5), 10);
  if (num >= 1 && num <= 12) return SHORT_MONTHS[num - 1];
  return String(m).slice(5);
}

export default function FinanceTrend({
  data,
}: {
  data: Array<{ month: string; revenue: number; expenses: number; profit: number }>;
}) {
  return (
    <div className="glass-card" style={{ padding: '18px 20px', minHeight: 190, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>Revenue vs expenses (year)</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: '#6b7280', fontWeight: 600 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#8b5cf6', display: 'inline-block' }} />
            Revenue
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#f43f5e', display: 'inline-block' }} />
            Expenses
          </span>
        </div>
      </div>
      <div style={{ width: '100%', height: 140 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
            <CartesianGrid stroke="#f1f3f5" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10.5, fill: '#6b7280' }} tickLine={false} axisLine={{ stroke: '#eaedf0' }} tickFormatter={formatMonthTick} />
            <YAxis tick={{ fontSize: 10.5, fill: '#6b7280' }} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompactMoney(v)} width={64} />
            <Tooltip formatter={(v: number) => formatCompactMoney(v)} labelFormatter={(m) => formatMonthTick(String(m))} />
            <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#8b5cf6" strokeWidth={2.5} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#f43f5e" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

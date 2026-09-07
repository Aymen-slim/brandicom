'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatCompactMoney } from '@/lib/format';

export default function FinanceTrend({
  data,
}: {
  data: Array<{ month: string; revenue: number; expenses: number; profit: number }>;
}) {
  return (
    <div className="glass-card" style={{ padding: 16, minHeight: 190 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>Revenue vs expenses (year)</div>
      <div style={{ width: '100%', height: 140 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid stroke="#f1f3f5" strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={(m) => String(m).slice(5)} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatCompactMoney(v)} width={60} />
            <Tooltip formatter={(v: number) => formatCompactMoney(v)} />
            <Line type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="expenses" stroke="#f43f5e" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

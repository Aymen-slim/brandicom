'use client';

import React, { useState } from 'react';
import { ExpenseData } from '@/types';
import { EXPENSE_CATEGORIES } from '@/lib/constants';
import { formatMoney } from '@/lib/format';

export function ExpenseManager({
  initialExpenses,
  clients,
  partners,
}: {
  initialExpenses: ExpenseData[];
  clients: Array<{ id: string; name: string }>;
  partners: Array<{ id: string; name: string }>;
}) {
  const [expenses, setExpenses] = useState(initialExpenses);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    category: 'other',
    description: '',
    clientId: '',
    partnerId: '',
    recurring: false,
  });

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        amount: Number(form.amount),
        clientId: form.clientId || null,
        partnerId: form.partnerId || null,
      }),
    });
    if (res.ok) {
      const row = await res.json();
      setExpenses((prev) => [
        {
          id: row.id,
          date: row.date,
          amount: Number(row.amount),
          category: row.category,
          description: row.description,
          clientId: row.client_id,
          partnerId: row.partner_id,
          assignmentId: row.assignment_id,
          recurring: row.recurring,
          recurrence: row.recurrence,
          receiptUrl: row.receipt_url,
          createdBy: row.created_by,
          createdAt: row.created_at,
        },
        ...prev,
      ]);
      setForm({ ...form, amount: '', description: '' });
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    if (res.ok) setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  return (
    <div>
      <form onSubmit={create} className="glass-card" style={{ padding: 16, marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
        <input className="input-field" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        <input className="input-field" type="number" step="0.001" required placeholder="Amount TND" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        <select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.replace('_', ' ')}
            </option>
          ))}
        </select>
        <select className="input-field" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
          <option value="">Client (opt.)</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="input-field" value={form.partnerId} onChange={(e) => setForm({ ...form, partnerId: e.target.value })}>
          <option value="">Partner (opt.)</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button className="btn btn-primary">Add</button>
        <input className="input-field" style={{ gridColumn: '1 / -2' }} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </form>
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Client</th>
              <th>Partner</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id}>
                <td>{e.date}</td>
                <td style={{ textTransform: 'capitalize' }}>{e.category.replace('_', ' ')}</td>
                <td>{formatMoney(e.amount)}</td>
                <td>{e.clientName || '—'}</td>
                <td>{e.partnerName || '—'}</td>
                <td>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(e.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

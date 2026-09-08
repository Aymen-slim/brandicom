'use client';

import React, { useState, useMemo } from 'react';
import { ExpenseCategory, ExpenseData } from '@/types';
import { EXPENSE_CATEGORIES } from '@/lib/constants';
import { formatMoney } from '@/lib/format';

interface ExpenseManagerProps {
  initialExpenses: ExpenseData[];
  clients: Array<{ id: string; name: string }>;
  partners: Array<{ id: string; name: string }>;
}

export function ExpenseManager({
  initialExpenses,
  clients,
  partners,
}: ExpenseManagerProps) {
  const [expenses, setExpenses] = useState<ExpenseData[]>(initialExpenses);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTypeTab, setActiveTypeTab] = useState<'all' | 'one_time' | 'regular'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    category: 'other' as ExpenseCategory,
    description: '',
    clientId: '',
    partnerId: '',
    recurring: false,
    recurrence: 'monthly' as 'monthly' | 'yearly',
  });

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const amountNum = parseFloat(form.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid expense amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        date: form.date,
        amount: amountNum,
        category: form.category,
        description: form.description.trim() || null,
        clientId: form.clientId || null,
        partnerId: form.partnerId || null,
        recurring: form.recurring,
        recurrence: form.recurring ? form.recurrence : null,
      };

      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save expense');
      }

      const row = await res.json();
      const matchedClient = clients.find((c) => c.id === (row.clientId || row.client_id));
      const matchedPartner = partners.find((p) => p.id === (row.partnerId || row.partner_id));

      const newExpense: ExpenseData = {
        id: row.id,
        date: row.date,
        amount: Number(row.amount),
        category: row.category,
        description: row.description,
        clientId: row.clientId || row.client_id || null,
        clientName: row.clientName || matchedClient?.name || null,
        partnerId: row.partnerId || row.partner_id || null,
        partnerName: row.partnerName || matchedPartner?.name || null,
        assignmentId: row.assignmentId || row.assignment_id || null,
        recurring: Boolean(row.recurring),
        recurrence: row.recurrence || null,
        receiptUrl: row.receiptUrl || row.receipt_url || null,
        createdBy: row.createdBy || row.created_by || null,
        createdAt: row.createdAt || row.created_at || new Date().toISOString(),
      };

      setExpenses((prev) => [newExpense, ...prev]);
      setForm((prev) => ({
        ...prev,
        amount: '',
        description: '',
        clientId: '',
        partnerId: '',
      }));
    } catch (err: any) {
      alert(err.message || 'Error creating expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setExpenses((prev) => prev.filter((e) => e.id !== id));
      } else {
        alert('Failed to delete expense.');
      }
    } catch {
      alert('Error deleting expense.');
    }
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const totalAmount = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const oneTimeExpenses = expenses.filter((e) => !e.recurring);
    const oneTimeAmount = oneTimeExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const regularExpenses = expenses.filter((e) => e.recurring);
    const regularAmount = regularExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

    // Monthly regular commitment
    const regularMonthlyRunrate = regularExpenses.reduce((s, e) => {
      const amt = Number(e.amount) || 0;
      if (e.recurrence === 'yearly') return s + amt / 12;
      return s + amt;
    }, 0);

    return {
      totalAmount,
      totalCount: expenses.length,
      oneTimeAmount,
      oneTimeCount: oneTimeExpenses.length,
      regularAmount,
      regularCount: regularExpenses.length,
      regularMonthlyRunrate,
    };
  }, [expenses]);

  // Filtering
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      // Type Tab Filter
      if (activeTypeTab === 'one_time' && e.recurring) return false;
      if (activeTypeTab === 'regular' && !e.recurring) return false;

      // Category Filter
      if (selectedCategory !== 'all' && e.category !== selectedCategory) return false;

      // Client Filter
      if (selectedClient !== 'all' && e.clientId !== selectedClient) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const descMatch = (e.description || '').toLowerCase().includes(q);
        const catMatch = e.category.toLowerCase().includes(q);
        const clientMatch = (e.clientName || '').toLowerCase().includes(q);
        const partnerMatch = (e.partnerName || '').toLowerCase().includes(q);
        if (!descMatch && !catMatch && !clientMatch && !partnerMatch) return false;
      }

      return true;
    });
  }, [expenses, activeTypeTab, selectedCategory, selectedClient, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div className="glass-card" style={{ padding: '16px 20px', borderRadius: 12 }}>
          <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, marginBottom: 4 }}>Total Recorded Expenses</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{formatMoney(stats.totalAmount)}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{stats.totalCount} total entries</div>
        </div>

        <div className="glass-card" style={{ padding: '16px 20px', borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#0284c7', fontWeight: 600, marginBottom: 4 }}>
            <span>⚡</span> One-time Expenses
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#0369a1' }}>{formatMoney(stats.oneTimeAmount)}</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{stats.oneTimeCount} one-off purchases</div>
        </div>

        <div className="glass-card" style={{ padding: '16px 20px', borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#7c3aed', fontWeight: 600, marginBottom: 4 }}>
            <span>🔄</span> Regular Commitments
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#6d28d9' }}>{formatMoney(stats.regularMonthlyRunrate)}<span style={{ fontSize: 13, fontWeight: 500, color: '#8b5cf6' }}>/mo</span></div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{stats.regularCount} recurring regular subscriptions</div>
        </div>
      </div>

      {/* Add Expense Form */}
      <div className="glass-card" style={{ padding: 20, borderRadius: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Record New Expense</span>
          <span style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', padding: '2px 8px', background: 'rgba(0,0,0,0.04)', borderRadius: 999 }}>
            One-time or Regular
          </span>
        </div>

        <form onSubmit={create} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Row 1: Expense Type Selector */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, padding: '10px 14px', background: 'var(--bg-base)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Expense Type:</span>
            
            <div style={{ display: 'inline-flex', background: 'var(--bg-surface)', padding: 3, borderRadius: 8, border: '1px solid var(--border-medium)', gap: 4 }}>
              <button
                type="button"
                onClick={() => setForm({ ...form, recurring: false })}
                style={{
                  padding: '5px 14px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  background: !form.recurring ? '#0284c7' : 'transparent',
                  color: !form.recurring ? '#ffffff' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>⚡</span>
                <span>One-time</span>
              </button>

              <button
                type="button"
                onClick={() => setForm({ ...form, recurring: true })}
                style={{
                  padding: '5px 14px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  background: form.recurring ? '#7c3aed' : 'transparent',
                  color: form.recurring ? '#ffffff' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>🔄</span>
                <span>Regular (Recurring)</span>
              </button>
            </div>

            {/* If regular/recurring, show cadence selector */}
            {form.recurring && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, animation: 'fadeIn 0.2s ease-in-out' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Frequency:</span>
                <select
                  className="input-field"
                  style={{ width: 'auto', padding: '4px 10px', height: 32, fontSize: 12 }}
                  value={form.recurrence}
                  onChange={(e) => setForm({ ...form, recurrence: e.target.value as 'monthly' | 'yearly' })}
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
                <span style={{ fontSize: 11, color: '#7c3aed', background: '#f5f3ff', padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}>
                  Active regular cost
                </span>
              </div>
            )}
          </div>

          {/* Row 2: Form Inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Date</label>
              <input
                className="input-field"
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Amount (TND)</label>
              <input
                className="input-field"
                type="number"
                step="0.001"
                min="0.001"
                required
                placeholder="e.g. 150.000"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Category</label>
              <select
                className="input-field"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}
                style={{ width: '100%' }}
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Client (Optional)</label>
              <select
                className="input-field"
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                style={{ width: '100%' }}
              >
                <option value="">No Client (Agency)</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Partner / Creator (Optional)</label>
              <select
                className="input-field"
                value={form.partnerId}
                onChange={(e) => setForm({ ...form, partnerId: e.target.value })}
                style={{ width: '100%' }}
              >
                <option value="">No Partner</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: Description & Submit button */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Description / Note</label>
              <input
                className="input-field"
                placeholder="e.g. Adobe Suite subscription, Domain renewal, Studio lighting..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary"
              style={{ minWidth: 130, height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              {isSubmitting ? (
                <span>Adding...</span>
              ) : (
                <>
                  <span>+</span> Add Expense
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card" style={{ padding: '14px 16px', borderRadius: 12, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Type Filter Tabs */}
        <div style={{ display: 'inline-flex', background: 'var(--bg-base)', padding: 3, borderRadius: 8, border: '1px solid var(--border-medium)', gap: 4 }}>
          <button
            type="button"
            onClick={() => setActiveTypeTab('all')}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: activeTypeTab === 'all' ? 'var(--bg-surface)' : 'transparent',
              color: activeTypeTab === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: activeTypeTab === 'all' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            All ({expenses.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTypeTab('one_time')}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: activeTypeTab === 'one_time' ? '#e0f2fe' : 'transparent',
              color: activeTypeTab === 'one_time' ? '#0369a1' : 'var(--text-secondary)',
              boxShadow: activeTypeTab === 'one_time' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            ⚡ One-time ({stats.oneTimeCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTypeTab('regular')}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: activeTypeTab === 'regular' ? '#f3e8ff' : 'transparent',
              color: activeTypeTab === 'regular' ? '#7c3aed' : 'var(--text-secondary)',
              boxShadow: activeTypeTab === 'regular' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            🔄 Regular ({stats.regularCount})
          </button>
        </div>

        {/* Filters and search */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            className="input-field"
            placeholder="Search expenses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 180, height: 32, fontSize: 12 }}
          />

          <select
            className="input-field"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ width: 140, height: 32, fontSize: 12 }}
          >
            <option value="all">All Categories</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace('_', ' ')}
              </option>
            ))}
          </select>

          <select
            className="input-field"
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            style={{ width: 140, height: 32, fontSize: 12 }}
          >
            <option value="all">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Expenses List Table */}
      <div className="glass-card" style={{ overflow: 'hidden', borderRadius: 12 }}>
        <div className="table-responsive-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ minWidth: 100 }}>Date</th>
                <th style={{ minWidth: 130 }}>Type</th>
                <th style={{ minWidth: 120 }}>Category</th>
                <th style={{ minWidth: 180 }}>Description</th>
                <th style={{ minWidth: 110 }}>Amount</th>
                <th style={{ minWidth: 120 }}>Client</th>
                <th style={{ minWidth: 120 }}>Partner</th>
                <th style={{ width: 70, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '32px 16px', color: '#9ca3af' }}>
                    No expenses found matching the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((e) => (
                  <tr key={e.id}>
                    <td style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>{e.date}</td>
                    <td>
                      {e.recurring ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 9px',
                            borderRadius: 9999,
                            fontSize: 11,
                            fontWeight: 600,
                            background: '#f3e8ff',
                            color: '#6d28d9',
                            border: '1px solid #ddd6fe',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <span>🔄 Regular</span>
                          <span style={{ opacity: 0.75, fontSize: 10 }}>({e.recurrence || 'monthly'})</span>
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 9px',
                            borderRadius: 9999,
                            fontSize: 11,
                            fontWeight: 600,
                            background: '#e0f2fe',
                            color: '#0369a1',
                            border: '1px solid #bae6fd',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <span>⚡ One-time</span>
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        style={{
                          textTransform: 'capitalize',
                          fontSize: 12,
                          padding: '2px 8px',
                          background: 'rgba(0,0,0,0.04)',
                          borderRadius: 6,
                          fontWeight: 500,
                        }}
                      >
                        {e.category.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: e.description ? 'var(--text-primary)' : '#9ca3af', maxWidth: 260 }}>
                      {e.description || '—'}
                    </td>
                    <td style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      {formatMoney(e.amount)}
                    </td>
                    <td style={{ fontSize: 12, color: e.clientName ? 'var(--text-primary)' : '#9ca3af' }}>
                      {e.clientName || '—'}
                    </td>
                    <td style={{ fontSize: 12, color: e.partnerName ? 'var(--text-primary)' : '#9ca3af' }}>
                      {e.partnerName || '—'}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => remove(e.id)}
                        style={{ color: '#ef4444', padding: '4px 8px', fontSize: 11 }}
                        title="Delete expense"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


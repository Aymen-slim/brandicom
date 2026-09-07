'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { InvoiceData } from '@/types';
import { formatMoney } from '@/lib/format';
import { Plus, Trash2, Printer } from 'lucide-react';

export function InvoiceManager({
  initialInvoices,
  clients,
}: {
  initialInvoices: InvoiceData[];
  clients: Array<{ id: string; name: string }>;
}) {
  const [invoices, setInvoices] = useState(initialInvoices);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ clientId: '', subtotal: '', periodLabel: '', dueDate: '' });

  const handleDelete = async (id: string, number: string) => {
    if (!confirm(`Voulez-vous vraiment supprimer définitivement la facture ${number} ?`)) return;
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setInvoices((prev) => prev.filter((i) => i.id !== id));
      } else {
        alert('Erreur lors de la suppression.');
      }
    } catch (err) {
      console.error('Failed to delete invoice:', err);
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: form.clientId,
          subtotal: Number(form.subtotal),
          periodLabel: form.periodLabel || null,
          dueDate: form.dueDate || null,
          status: 'sent',
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setInvoices((prev) => [created, ...prev]);
        setOpen(false);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(!open)}>
          <Plus size={13} /> New invoice
        </button>
      </div>
      {open && (
        <form onSubmit={create} className="glass-card" style={{ padding: 16, marginBottom: 16, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 10 }}>
          <select className="input-field" required value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
            <option value="">Client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input className="input-field" type="number" step="0.001" placeholder="Subtotal TND" required value={form.subtotal} onChange={(e) => setForm({ ...form, subtotal: e.target.value })} />
          <input className="input-field" placeholder="Period e.g. 2026-09" value={form.periodLabel} onChange={(e) => setForm({ ...form, periodLabel: e.target.value })} />
          <input className="input-field" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          <button className="btn btn-primary" disabled={saving}>
            {saving ? '…' : 'Create'}
          </button>
        </form>
      )}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Client</th>
              <th>Total TTC</th>
              <th>Paid</th>
              <th>Status</th>
              <th style={{ textAlign: 'right', paddingRight: 16 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td>
                  <Link href={`/finance/invoices/${inv.id}`} style={{ fontWeight: 600, color: '#4338ca' }}>
                    {inv.number}
                  </Link>
                </td>
                <td style={{ fontWeight: 600 }}>{inv.clientName}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatMoney(inv.total)}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums', color: (inv.paidAmount || 0) > 0 ? '#059669' : undefined }}>
                  {formatMoney(inv.paidAmount || 0)}
                </td>
                <td>
                  <span className={`status-badge-pill ${inv.status === 'paid' ? 'paid' : inv.status === 'partially_paid' ? 'partially-paid' : 'pending'}`} style={{ fontSize: 10.5 }}>
                    {inv.status.replace('_', ' ')}
                  </span>
                </td>
                <td style={{ textAlign: 'right', paddingRight: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
                    <Link
                      href={`/finance/invoices/${inv.id}/print`}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '3px 8px', fontSize: 11 }}
                      title="Imprimer / Télécharger la Facture"
                    >
                      <Printer size={12} /> Facture
                    </Link>
                    <Link
                      href={`/finance/invoices/${inv.id}`}
                      className="btn btn-primary btn-sm"
                      style={{ padding: '3px 8px', fontSize: 11 }}
                    >
                      Détails
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(inv.id, inv.number)}
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '4px 6px', color: '#e11d48' }}
                      title="Supprimer la facture"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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
  const [form, setForm] = useState({
    clientId: '',
    subtotal: '',
    vatRate: 0.19,
    isCustomVat: false,
    customVat: '',
    periodLabel: '',
    dueDate: '',
  });

  const activeVat = form.isCustomVat ? (Number(form.customVat) || 0) / 100 : form.vatRate;
  const subtotalNum = Number(form.subtotal) || 0;
  const vatAmt = Math.round(subtotalNum * activeVat * 1000) / 1000;
  const totalTTC = Math.round((subtotalNum + vatAmt) * 1000) / 1000;

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
          vatRate: activeVat,
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
          <Plus size={13} /> {open ? 'Fermer' : 'Nouvelle Facture'}
        </button>
      </div>
      {open && (
        <form
          onSubmit={create}
          className="glass-card"
          style={{ padding: 18, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: 4 }}>
                Client *
              </label>
              <select className="input-field" required value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
                <option value="">Sélectionner un client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: 4 }}>
                Montant HT (TND) *
              </label>
              <input
                className="input-field"
                type="number"
                step="0.001"
                placeholder="ex: 3500"
                required
                value={form.subtotal}
                onChange={(e) => setForm({ ...form, subtotal: e.target.value })}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: 4 }}>
                Option TVA
              </label>
              <select
                className="input-field"
                value={form.isCustomVat ? 'custom' : String(form.vatRate)}
                onChange={(e) => {
                  if (e.target.value === 'custom') {
                    setForm({ ...form, isCustomVat: true });
                  } else {
                    setForm({ ...form, isCustomVat: false, vatRate: Number(e.target.value) });
                  }
                }}
              >
                <option value="0.19">19% (Standard)</option>
                <option value="0.07">7% (Réduit)</option>
                <option value="0">0% (Sans TVA)</option>
                <option value="custom">Autre %</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: 4 }}>
                Période (Mois)
              </label>
              <input
                className="input-field"
                placeholder="ex: 2026-09"
                value={form.periodLabel}
                onChange={(e) => setForm({ ...form, periodLabel: e.target.value })}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: 4 }}>
                Échéance
              </label>
              <input
                className="input-field"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>
          </div>

          {form.isCustomVat && (
            <div style={{ maxWidth: 180 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: 4 }}>
                Pourcentage TVA (%)
              </label>
              <input
                className="input-field"
                type="number"
                step="0.1"
                placeholder="ex: 13"
                value={form.customVat}
                onChange={(e) => setForm({ ...form, customVat: e.target.value })}
              />
            </div>
          )}

          {/* Live Totals Bar */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
              <div>
                <span style={{ color: '#64748b' }}>Montant HT: </span>
                <strong style={{ color: '#1e293b' }}>{formatMoney(subtotalNum)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>TVA ({Math.round(activeVat * 100)}%): </span>
                <strong style={{ color: '#4f46e5' }}>+{formatMoney(vatAmt)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Total TTC: </span>
                <strong style={{ color: '#059669', fontSize: 13 }}>{formatMoney(totalTTC)}</strong>
              </div>
            </div>

            <button className="btn btn-primary btn-sm" disabled={saving || !form.clientId || subtotalNum <= 0}>
              {saving ? 'Création…' : 'Émettre Facture'}
            </button>
          </div>
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
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                  <div style={{ fontWeight: 600 }}>{formatMoney(inv.total)}</div>
                  <div style={{ fontSize: 10, color: '#64748b', fontWeight: 500 }}>
                    {(inv.vatRate ?? 0.19) === 0 ? 'Sans TVA (0%)' : `TVA ${Math.round((inv.vatRate ?? 0.19) * 100)}%`}
                  </div>
                </td>
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
                      title={inv.status === 'paid' ? 'Consulter le détail' : 'Encaisser un paiement ou acompte'}
                    >
                      {inv.status === 'paid' ? 'Détails' : 'Encaisser / Acompte'}
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

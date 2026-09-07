'use client';

import React, { useState } from 'react';
import { InvoiceData, PaymentData } from '@/types';
import { formatMoney, VAT_RATE } from '@/lib/format';

export function InvoiceDetail({ invoice, payments: initial }: { invoice: InvoiceData; payments: PaymentData[] }) {
  const [payments, setPayments] = useState(initial);
  const [amount, setAmount] = useState('');
  const remaining = invoice.total - (invoice.paidAmount || 0);

  const record = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/invoices/${invoice.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(amount) }),
    });
    if (res.ok) {
      const p = await res.json();
      setPayments((prev) => [...prev, p]);
      setAmount('');
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
      <div className="glass-card" style={{ padding: 24 }}>
        <div style={{ fontSize: 12, color: '#6b7280' }}>{invoice.periodLabel || invoice.issueDate}</div>
        <h2 style={{ fontSize: 22, fontWeight: 800 }}>{invoice.clientName}</h2>
        <table className="data-table" style={{ marginTop: 16 }}>
          <tbody>
            <tr>
              <td>Subtotal HT</td>
              <td>{formatMoney(invoice.subtotal)}</td>
            </tr>
            <tr>
              <td>TVA {Math.round((invoice.vatRate || VAT_RATE) * 100)}%</td>
              <td>{formatMoney(invoice.total - invoice.subtotal)}</td>
            </tr>
            <tr>
              <td>
                <strong>Total TTC</strong>
              </td>
              <td>
                <strong>{formatMoney(invoice.total)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: '#6b7280', marginTop: 12 }}>{invoice.notes}</p>
      </div>
      <div className="glass-card" style={{ padding: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Payments</div>
        {payments.map((p) => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0' }}>
            <span>{p.paidAt}</span>
            <span>{formatMoney(p.amount)}</span>
          </div>
        ))}
        {remaining > 0 && (
          <form onSubmit={record} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input
              className="input-field"
              type="number"
              step="0.001"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <button className="btn btn-primary btn-sm">Record</button>
          </form>
        )}
      </div>
    </div>
  );
}

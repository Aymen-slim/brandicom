import React from 'react';
import { redirect, notFound } from 'next/navigation';
import { getSessionUser, isAdmin } from '@/lib/permissions';
import { fetchInvoice } from '@/lib/finance';
import { formatMoney, VAT_RATE } from '@/lib/format';

export default async function PrintInvoice({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) redirect('/dashboard');
  const detail = await fetchInvoice(params.id);
  if (!detail) notFound();
  const inv = detail.invoice;

  return (
    <div style={{ maxWidth: 720, margin: '40px auto', background: '#fff', padding: 40, color: '#111' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <img src="/logo.png" alt="Brandicom" style={{ width: 38, height: 38, objectFit: 'contain' }} />
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Brandicom</h1>
      </div>
      <p style={{ fontSize: 13, color: '#6b7280' }}>Invoice {inv.number}</p>
      <h2 style={{ marginTop: 24 }}>{inv.clientName}</h2>
      <p style={{ fontSize: 13 }}>Issue date {inv.issueDate} · Due {inv.dueDate || '—'}</p>
      <table style={{ width: '100%', marginTop: 24, borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ padding: 8 }}>Subtotal HT</td>
            <td style={{ textAlign: 'right' }}>{formatMoney(inv.subtotal)}</td>
          </tr>
          <tr>
            <td style={{ padding: 8 }}>TVA {Math.round((inv.vatRate || VAT_RATE) * 100)}%</td>
            <td style={{ textAlign: 'right' }}>{formatMoney(inv.total - inv.subtotal)}</td>
          </tr>
          <tr>
            <td style={{ padding: 8, fontWeight: 800 }}>Total TTC</td>
            <td style={{ textAlign: 'right', fontWeight: 800 }}>{formatMoney(inv.total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

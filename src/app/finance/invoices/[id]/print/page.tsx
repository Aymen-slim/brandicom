import React from 'react';
import { redirect, notFound } from 'next/navigation';
import { getSessionUser, isAdmin } from '@/lib/permissions';
import { fetchInvoice } from '@/lib/finance';
import { FactureDocument } from '@/components/FactureDocument';

export default async function PrintInvoice({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) redirect('/dashboard');
  const detail = await fetchInvoice(params.id);
  if (!detail) notFound();

  return (
    <div style={{ padding: '32px 16px', minHeight: '100vh', background: '#f8f9fa' }}>
      <FactureDocument
        invoice={detail.invoice}
        payments={detail.payments}
        isStandalonePage
      />
    </div>
  );
}

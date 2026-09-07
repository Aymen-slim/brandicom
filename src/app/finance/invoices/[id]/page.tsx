import React from 'react';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser, isAdmin } from '@/lib/permissions';
import { fetchInvoice } from '@/lib/finance';
import { AppShell } from '@/components/AppShell';
import { InvoiceDetail } from '@/components/InvoiceDetail';

export default async function InvoicePage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) redirect('/dashboard');
  const detail = await fetchInvoice(params.id);
  if (!detail) notFound();

  return (
    <AppShell
      user={user}
      title={detail.invoice.number}
      subtitle={detail.invoice.clientName || 'Invoice'}
      actions={
        <Link href={`/finance/invoices/${params.id}/print`} className="btn btn-secondary btn-sm">
          Print
        </Link>
      }
    >
      <InvoiceDetail invoice={detail.invoice} payments={detail.payments} />
    </AppShell>
  );
}

import React from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser, isAdmin } from '@/lib/permissions';
import { fetchInvoices } from '@/lib/finance';
import { fetchClients } from '@/lib/data';
import { AppShell } from '@/components/AppShell';
import { InvoiceManager } from '@/components/InvoiceManager';
import { formatMoney } from '@/lib/format';

export default async function InvoicesPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) redirect('/dashboard');

  const [invoices, clients] = await Promise.all([
    fetchInvoices(),
    fetchClients({ userRole: 'admin', userId: user.id }),
  ]);

  return (
    <AppShell
      user={user}
      title="Invoices"
      subtitle={`${invoices.length} invoices · ${formatMoney(invoices.reduce((s, i) => s + i.total, 0))} billed`}
      actions={
        <Link href="/finance" className="btn btn-secondary btn-sm">
          P&L
        </Link>
      }
    >
      <InvoiceManager initialInvoices={invoices} clients={clients.map((c) => ({ id: c.id, name: c.name }))} />
    </AppShell>
  );
}

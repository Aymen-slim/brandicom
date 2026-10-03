import React from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser, isAdmin } from '@/lib/permissions';
import { fetchInvoicePage } from '@/lib/finance';
import { fetchClientOptions } from '@/lib/data';
import { parsePagination } from '@/lib/pagination';
import { invoiceFiltersSchema } from '@/lib/listValidation';
import { PageChrome } from '@/components/PageChrome';
import { InvoiceManager } from '@/components/InvoiceManager';
import { formatMoney } from '@/lib/format';

export default async function InvoicesPage({ searchParams = {} }: { searchParams?: Record<string, string | undefined> }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) redirect('/dashboard');
  const filters = invoiceFiltersSchema.parse({ status: searchParams.status, clientId: searchParams.clientId });
  const [result, clients] = await Promise.all([
    fetchInvoicePage({ ...filters, ...parsePagination({ page: searchParams.page }) }),
    fetchClientOptions({ userRole: user.role, includeFee: false }),
  ]);

  return (
    <PageChrome pathname="/finance/invoices" user={user} title="Invoices"
      subtitle={`${result.summary.totalCount} invoices · ${formatMoney(result.summary.totalBilled)} billed`}
      actions={<Link href="/finance" className="btn btn-secondary btn-sm">P&L</Link>}>
      <InvoiceManager initialInvoices={result.items} pagination={result} clients={clients.map((c) => ({ id: c.id, name: c.name }))} />
    </PageChrome>
  );
}

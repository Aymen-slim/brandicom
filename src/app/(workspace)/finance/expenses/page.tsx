import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser, isAdmin } from '@/lib/permissions';
import { fetchExpensePage } from '@/lib/finance';
import { fetchClientOptions, fetchCreatorOptions } from '@/lib/data';
import { parsePagination } from '@/lib/pagination';
import { expenseFiltersSchema } from '@/lib/listValidation';
import { PageChrome } from '@/components/PageChrome';
import { ExpenseManager } from '@/components/ExpenseManager';

export default async function ExpensesPage({ searchParams = {} }: { searchParams?: Record<string, string | undefined> }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) redirect('/dashboard');
  const filters = expenseFiltersSchema.parse({ category: searchParams.category, clientId: searchParams.clientId,
    type: searchParams.type, search: searchParams.search, from: searchParams.from, to: searchParams.to });
  const [result, clients, partners] = await Promise.all([
    fetchExpensePage({ ...filters, ...parsePagination({ page: searchParams.page }) }),
    fetchClientOptions({ userRole: user.role, includeFee: false }), fetchCreatorOptions(),
  ]);

  return (
    <PageChrome pathname="/finance/expenses" user={user} title="Expenses" subtitle="Agency costs by category">
      <ExpenseManager initialExpenses={result.items} pagination={result} summary={result.summary} initialFilters={filters}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))} partners={partners.map((p) => ({ id: p.id, name: p.name }))} />
    </PageChrome>
  );
}

import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser, isAdmin } from '@/lib/permissions';
import { fetchExpenses } from '@/lib/finance';
import { fetchClients, fetchCreators } from '@/lib/data';
import { AppShell } from '@/components/AppShell';
import { ExpenseManager } from '@/components/ExpenseManager';

export default async function ExpensesPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) redirect('/dashboard');

  const [expenses, clients, partners] = await Promise.all([
    fetchExpenses(),
    fetchClients({ userRole: 'admin', userId: user.id }),
    fetchCreators({ isAdmin: true }),
  ]);

  return (
    <AppShell user={user} title="Expenses" subtitle="Agency costs by category">
      <ExpenseManager
        initialExpenses={expenses}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        partners={partners.map((p) => ({ id: p.id, name: p.name }))}
      />
    </AppShell>
  );
}

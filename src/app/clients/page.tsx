import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/permissions';
import { fetchClients, attachClientCounts, fetchUsers } from '@/lib/data';
import { AppShell } from '@/components/AppShell';
import { ClientTable } from '@/components/ClientTable';

export default async function ClientsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const isAdmin = user.role === 'admin';
  const [rawClients, availableUsers] = await Promise.all([
    fetchClients({ userRole: user.role, userId: user.id }),
    fetchUsers(),
  ]);
  const clients = await attachClientCounts(rawClients);

  return (
    <AppShell
      user={user}
      title={isAdmin ? 'Agency Client Accounts' : 'Your Assigned Client Accounts'}
      subtitle={isAdmin ? 'Full roster' : 'Accounts assigned to you'}
      topClients={clients.slice(0, 4).map((c) => ({
        id: c.id,
        name: c.name,
        monthlyFee: isAdmin ? c.contract?.monthlyFee ?? null : null,
      }))}
    >
      <ClientTable initialClients={clients} availableUsers={availableUsers} user={user} />
    </AppShell>
  );
}

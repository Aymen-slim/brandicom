import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/permissions';
import { fetchClientPage, fetchUsers } from '@/lib/data';
import { parsePagination } from '@/lib/pagination';
import { clientFiltersSchema } from '@/lib/listValidation';
import { PageChrome } from '@/components/PageChrome';
import { ClientTable } from '@/components/ClientTable';

export default async function ClientsPage({ searchParams = {} }: { searchParams?: Record<string, string | undefined> }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const filters = clientFiltersSchema.parse({ status: searchParams.status, assignedTo: searchParams.assigned_to, search: searchParams.search });
  if (user.role !== 'admin') filters.assignedTo = undefined;
  const pagination = parsePagination({ page: searchParams.page });
  const [result, availableUsers] = await Promise.all([
    fetchClientPage({ userRole: user.role, userId: user.id, ...filters, ...pagination }), fetchUsers(),
  ]);
  const isAdmin = user.role === 'admin';

  return (
    <PageChrome pathname="/clients" user={user} title={isAdmin ? 'Agency Client Accounts' : 'Your Assigned Client Accounts'}
      subtitle={isAdmin ? 'Full roster' : 'Accounts assigned to you'}>
      <ClientTable initialClients={result.items} initialPage={result} initialFilters={filters} availableUsers={availableUsers} user={user} />
    </PageChrome>
  );
}

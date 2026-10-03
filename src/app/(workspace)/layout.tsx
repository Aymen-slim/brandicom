import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/permissions';
import { fetchClientOptions } from '@/lib/data';
import { AppShell } from '@/components/AppShell';

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const topClients = await fetchClientOptions({ userRole: user.role, limit: 5 }).catch(() => []);

  return <AppShell key={user.id} user={user} topClients={topClients}>{children}</AppShell>;
}

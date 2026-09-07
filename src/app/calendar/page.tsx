import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser, isAdmin } from '@/lib/permissions';
import { fetchClients, fetchCalendarDeliverables, fetchCreators } from '@/lib/data';
import { AppShell } from '@/components/AppShell';
import { ContentCalendar } from '@/components/ContentCalendar';

export default async function CalendarPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const [clients, deliverables, creators] = await Promise.all([
    fetchClients({ userRole: user.role, userId: user.id }),
    fetchCalendarDeliverables(),
    fetchCreators({ isAdmin: isAdmin(user) }),
  ]);

  const topClients = clients.slice(0, 5).map((c) => ({
    id: c.id,
    name: c.name,
    monthlyFee: c.contract?.monthlyFee ?? null,
  }));

  return (
    <AppShell
      user={user}
      title="Content Calendar"
      subtitle="Manage filming shoots and posting schedules across all clients"
      topClients={topClients}
    >
      <ContentCalendar
        initialDeliverables={deliverables}
        clients={clients}
        creators={creators}
        userRole={user.role}
      />
    </AppShell>
  );
}

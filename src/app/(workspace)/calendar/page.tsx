import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/permissions';
import { fetchClientOptions, fetchCalendarDeliverables, fetchCreatorOptions } from '@/lib/data';
import { PageChrome } from '@/components/PageChrome';
import { ContentCalendar } from '@/components/ContentCalendar';
import { getCalendarRange, localDateKey } from '@/lib/calendarRange';

export default async function CalendarPage({ searchParams }: { searchParams?: { client?: string } }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const requestedClient = searchParams?.client || '';
  const initialClientId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedClient)
    ? requestedClient
    : undefined;

  const initialDate = localDateKey(new Date());
  const range = getCalendarRange(new Date(`${initialDate}T12:00:00`));
  const [clients, deliverables, creators] = await Promise.all([
    fetchClientOptions({ userRole: user.role, includeLogo: true, includeFee: false }),
    fetchCalendarDeliverables({ lightweight: true, ...range }),
    fetchCreatorOptions(),
  ]);

  return (
    <PageChrome
      pathname="/calendar"
      user={user}
      title="Content Calendar"
      subtitle="Manage filming shoots and posting schedules across all clients"
    >
      <ContentCalendar
        initialDeliverables={deliverables}
        initialDate={initialDate}
        initialRange={range}
        clients={clients}
        creators={creators}
        userRole={user.role}
        initialClientId={initialClientId}
      />
    </PageChrome>
  );
}

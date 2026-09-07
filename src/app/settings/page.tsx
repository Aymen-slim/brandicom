import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/permissions';
import { fetchUsersWithCounts, fetchGoals } from '@/lib/data';
import { AppShell } from '@/components/AppShell';
import { SettingsManager } from '@/components/SettingsManager';

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }

  const users = await fetchUsersWithCounts();
  const goals = await fetchGoals();

  return (
    <AppShell
      user={user}
      title="Agency Settings & Governance"
      subtitle="Team access and performance goal targets"
    >
      <SettingsManager initialUsers={users} initialGoals={goals} user={user} />
    </AppShell>
  );
}

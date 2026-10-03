import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/permissions';
import { fetchUsersWithCounts, fetchGoals } from '@/lib/data';
import { PageChrome } from '@/components/PageChrome';
import { SettingsManager } from '@/components/SettingsManager';

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }

  const [users, goals] = await Promise.all([
    fetchUsersWithCounts(),
    fetchGoals(),
  ]);

  return (
    <PageChrome pathname="/settings"
      user={user}
      title="Agency Settings & Governance"
      subtitle="Team access and performance goal targets"
    >
      <SettingsManager initialUsers={users} initialGoals={goals} user={user} />
    </PageChrome>
  );
}

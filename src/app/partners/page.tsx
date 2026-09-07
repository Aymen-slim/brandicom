import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser, isAdmin } from '@/lib/permissions';
import { fetchCreators } from '@/lib/data';
import { AppShell } from '@/components/AppShell';
import { CreatorGrid } from '@/components/CreatorGrid';

export default async function PartnersPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const isUserAdmin = isAdmin(user);
  const creators = await fetchCreators({ isAdmin: isUserAdmin });

  return (
    <AppShell
      user={user}
      title="Partners"
      subtitle="Photographers, influencers, agencies, editors, and talent"
    >
      <CreatorGrid initialCreators={creators} isAdmin={isUserAdmin} />
    </AppShell>
  );
}

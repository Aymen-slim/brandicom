import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser, isAdmin } from '@/lib/permissions';
import { fetchContactSubmissions } from '@/lib/submissions';
import { AppShell } from '@/components/AppShell';
import { SubmissionInbox } from '@/components/SubmissionInbox';

export default async function LeadsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) redirect('/dashboard');

  let submissions: Awaited<ReturnType<typeof fetchContactSubmissions>> = [];
  let loadError = '';
  try {
    submissions = await fetchContactSubmissions();
  } catch (err) {
    console.error('[leads] failed to load contact submissions', err);
    loadError = 'Could not load form submissions. Check that the contact table exists and the service role key is set.';
  }

  return (
    <AppShell
      user={user}
      title="Website leads"
      subtitle="Every contact form submitted on the site"
    >
      {loadError ? (
        <div className="glass-card" style={{ padding: 18, color: 'var(--text-muted)' }}>
          {loadError}
        </div>
      ) : (
        <SubmissionInbox submissions={submissions} />
      )}
    </AppShell>
  );
}

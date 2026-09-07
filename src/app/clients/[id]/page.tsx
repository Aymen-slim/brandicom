import React from 'react';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser, canAccessClient } from '@/lib/permissions';
import { fetchClientDetail, fetchUsers, fetchAvailableCreators } from '@/lib/data';
import { AppShell } from '@/components/AppShell';
import { ClientWorkspace } from '@/components/ClientWorkspace';
import { ArrowLeft } from 'lucide-react';

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const hasAccess = await canAccessClient(user.id, user.role, params.id);
  if (!hasAccess) {
    return (
      <AppShell user={user} title="Access Restricted">
        <div className="glass-card" style={{ padding: 48, textAlign: 'center', maxWidth: 540, margin: '40px auto' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Unauthorized Client Access</h2>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>
            You only have access to clients you are assigned to.
          </p>
          <Link href="/clients" className="btn btn-primary">
            Back to roster
          </Link>
        </div>
      </AppShell>
    );
  }

  const [detail, users, creators] = await Promise.all([
    fetchClientDetail(params.id, user),
    fetchUsers(),
    fetchAvailableCreators(),
  ]);
  if (!detail) notFound();

  return (
    <AppShell
      user={user}
      title={detail.client.name}
      subtitle={`${detail.client.location || 'Remote'} · ${detail.client.industry || 'Client'}`}
      actions={
        <Link href="/clients" className="btn btn-secondary btn-sm">
          <ArrowLeft size={14} /> Roster
        </Link>
      }
    >
      <ClientWorkspace
        user={user}
        client={{ ...detail.client, creatorAssignments: detail.creatorAssignments }}
        deliverables={detail.deliverables}
        messages={detail.messages}
        availableUsers={users}
        availableCreators={creators}
      />
    </AppShell>
  );
}

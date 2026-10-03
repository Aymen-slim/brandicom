import React from 'react';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser, canAccessClient } from '@/lib/permissions';
import { fetchClientDetail, fetchUsers, fetchAvailableCreators } from '@/lib/data';
import { PageChrome } from '@/components/PageChrome';
import { ClientWorkspace } from '@/components/ClientWorkspace';
import { ArrowLeft } from 'lucide-react';

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const hasAccess = await canAccessClient(user.id, user.role, params.id);
  if (!hasAccess) {
    return (
      <PageChrome pathname={`/clients/${params.id}`} user={user} title="Access Restricted">
        <div className="glass-card" style={{ padding: 48, textAlign: 'center', maxWidth: 540, margin: '40px auto' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Unauthorized Client Access</h2>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>
            You only have access to clients you are assigned to.
          </p>
          <Link href="/clients" className="btn btn-primary">
            Back to roster
          </Link>
        </div>
      </PageChrome>
    );
  }

  const [detail, users, creators] = await Promise.all([
    fetchClientDetail(params.id, user, { overview: true }),
    fetchUsers(),
    fetchAvailableCreators(),
  ]);
  if (!detail) notFound();

  return (
    <PageChrome pathname={`/clients/${params.id}`}
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
        key={params.id}
        user={user}
        client={{ ...detail.client, creatorAssignments: detail.creatorAssignments }}
        deliverables={detail.deliverables}
        messages={detail.messages}
        availableUsers={users}
        availableCreators={creators}
      />
    </PageChrome>
  );
}

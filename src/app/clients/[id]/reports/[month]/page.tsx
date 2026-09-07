import React from 'react';
import { redirect, notFound } from 'next/navigation';
import { getSessionUser, canAccessClient } from '@/lib/permissions';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import Markdown from 'react-markdown';

export default async function ClientReportPage({ params }: { params: { id: string; month: string } }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const ok = await canAccessClient(user.id, user.role, params.id);
  if (!ok) redirect('/clients');

  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from('client_reports')
    .select('content_md, month, clients(name)')
    .eq('client_id', params.id)
    .eq('month', params.month)
    .maybeSingle();
  if (!data) notFound();

  return (
    <div style={{ maxWidth: 720, margin: '40px auto', background: '#fff', padding: 40 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800 }}>{(data as any).clients?.name}</h1>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>Monthly report · {data.month}</p>
      <div style={{ fontSize: 14, lineHeight: 1.6 }}>
        <Markdown>{data.content_md}</Markdown>
      </div>
    </div>
  );
}

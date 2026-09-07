import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { enforceAuth, isAdmin } from '@/lib/permissions';
import { sanitizeSearchTerm } from '@/lib/data';

export async function GET(request: NextRequest) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  const q = sanitizeSearchTerm(request.nextUrl.searchParams.get('q') || '');
  if (q.length < 2) return NextResponse.json({ clients: [], partners: [], deliverables: [], invoices: [] });

  const supabase = createServerSupabaseClient();
  const like = `%${q}%`;

  const [clients, partners, deliverables] = await Promise.all([
    supabase.from('clients').select('id, name, status, location').or(`name.ilike.${like},location.ilike.${like}`).limit(8),
    supabase.from('creators').select('id, name, role').or(`name.ilike.${like},instagram_handle.ilike.${like}`).limit(8),
    supabase.from('deliverables').select('id, idea, client_id, status, clients(name)').ilike('idea', like).limit(8),
  ]);

  let invoices: any[] = [];
  if (isAdmin(user)) {
    const { data } = await supabase.from('invoices').select('id, number, total, status, clients(name)').ilike('number', like).limit(8);
    invoices = data || [];
  }

  return NextResponse.json({
    clients: clients.data || [],
    partners: partners.data || [],
    deliverables: deliverables.data || [],
    invoices,
  });
}

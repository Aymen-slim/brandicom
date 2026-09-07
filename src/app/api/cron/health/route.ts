import { NextRequest, NextResponse } from 'next/server';
import { recomputeHealth } from '@/lib/ai/health';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  const cronOk = secret && auth === `Bearer ${secret}`;

  if (!cronOk) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const cookieStore = cookies();
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const results = await recomputeHealth({ admin: true, useServiceRole: true });
    return NextResponse.json({ ok: true, count: results.length });
  } catch (err: any) {
    console.error('Health cron failed:', err);
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 });
  }
}

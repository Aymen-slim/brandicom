import { NextRequest, NextResponse } from 'next/server';
import { enforceAuth, canAccessClient } from '@/lib/permissions';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { updateClient } from '@/lib/data';
import {
  extractClientInspirations,
  packClientInspirations,
  detectVideoPlatform,
  detectVideoFormat,
  cleanVideoUrl,
} from '@/lib/clientInspirations';
import { InspirationIdea } from '@/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  const clientId = params.id;
  const hasAccess = await canAccessClient(user.id, user.role, clientId);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  try {
    const supabase = createServerSupabaseClient();
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, tags')
      .eq('id', clientId)
      .maybeSingle();

    if (clientError) throw clientError;
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const inspirations = extractClientInspirations(client.tags || []);
    return NextResponse.json(inspirations);
  } catch (err: any) {
    console.error('Error fetching inspirations:', err);
    return NextResponse.json({ error: 'Failed to fetch inspirations' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  const clientId = params.id;
  const hasAccess = await canAccessClient(user.id, user.role, clientId);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { title, url, platform, format, notes } = body;

    if (!url || typeof url !== 'string' || !url.trim()) {
      return NextResponse.json({ error: 'A valid reel or video URL is required' }, { status: 400 });
    }

    const cleanUrl = cleanVideoUrl(url);
    const resolvedPlatform = platform || detectVideoPlatform(cleanUrl);
    const resolvedFormat = format || detectVideoFormat(cleanUrl);
    const resolvedTitle = typeof title === 'string' && title.trim()
      ? title.trim()
      : `${resolvedPlatform === 'instagram' ? 'Instagram Reel' : resolvedPlatform === 'tiktok' ? 'TikTok Video' : 'Video'} Idea`;

    const supabase = createServerSupabaseClient();
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, tags')
      .eq('id', clientId)
      .maybeSingle();

    if (clientError) throw clientError;
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const existingInspirations = extractClientInspirations(client.tags || []);

    const newIdea: InspirationIdea = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `inspo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      clientId,
      title: resolvedTitle,
      url: cleanUrl,
      platform: resolvedPlatform,
      format: resolvedFormat,
      notes: typeof notes === 'string' && notes.trim() ? notes.trim() : undefined,
      createdAt: new Date().toISOString(),
      createdBy: user.name || user.email || 'Team Member',
    };

    const updatedInspirations = [newIdea, ...existingInspirations];
    const newTags = packClientInspirations(client.tags || [], updatedInspirations);

    await updateClient(clientId, { tags: newTags });

    return NextResponse.json({
      idea: newIdea,
      inspirations: updatedInspirations,
      tags: newTags,
    }, { status: 201 });
  } catch (err: any) {
    console.error('Error adding inspiration idea:', err);
    return NextResponse.json({ error: err.message || 'Failed to add inspiration idea' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  const clientId = params.id;
  const hasAccess = await canAccessClient(user.id, user.role, clientId);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    let ideaId = searchParams.get('id');

    if (!ideaId) {
      try {
        const body = await request.json();
        ideaId = body.id;
      } catch {
        // query param was primary
      }
    }

    if (!ideaId) {
      return NextResponse.json({ error: 'Inspiration idea ID is required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, tags')
      .eq('id', clientId)
      .maybeSingle();

    if (clientError) throw clientError;
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const existingInspirations = extractClientInspirations(client.tags || []);
    const updatedInspirations = existingInspirations.filter((item) => item.id !== ideaId);
    const newTags = packClientInspirations(client.tags || [], updatedInspirations);

    await updateClient(clientId, { tags: newTags });

    return NextResponse.json({
      success: true,
      inspirations: updatedInspirations,
      tags: newTags,
    });
  } catch (err: any) {
    console.error('Error deleting inspiration idea:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete inspiration idea' }, { status: 500 });
  }
}

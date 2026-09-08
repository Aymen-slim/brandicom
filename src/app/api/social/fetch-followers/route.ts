import { NextRequest, NextResponse } from 'next/server';
import { enforceAuth } from '@/lib/permissions';
import { fetchProfileFollowers } from '@/lib/apify';

export async function POST(request: NextRequest) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  try {
    const body = await request.json();
    const { urlOrHandle, platform } = body;

    if (!urlOrHandle || typeof urlOrHandle !== 'string') {
      return NextResponse.json(
        { error: 'urlOrHandle is required' },
        { status: 400 }
      );
    }

    if (platform !== 'instagram' && platform !== 'tiktok') {
      return NextResponse.json(
        { error: 'Platform must be instagram or tiktok' },
        { status: 400 }
      );
    }

    const data = await fetchProfileFollowers(urlOrHandle, platform);
    return NextResponse.json({ success: true, ...data });
  } catch (err: any) {
    console.error('Error fetching profile followers:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch followers' },
      { status: 500 }
    );
  }
}

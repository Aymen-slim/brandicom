import { NextRequest, NextResponse } from 'next/server';
import { enforceAdmin } from '@/lib/permissions';
import { createSitePost, fetchSitePosts, SitePostInput } from '@/lib/sitePosts';

function readInput(body: any): SitePostInput {
  return {
    title: String(body?.title || ''),
    excerpt: String(body?.excerpt || ''),
    body: String(body?.body || ''),
    coverImageUrl: String(body?.coverImageUrl || ''),
    secondImageUrl: String(body?.secondImageUrl || ''),
    published: body?.published !== false,
  };
}

export async function GET() {
  const { user, error } = await enforceAdmin();
  if (error || !user) return error;
  try {
    const posts = await fetchSitePosts();
    return NextResponse.json(posts);
  } catch (err) {
    console.error('[blog] list failed', err);
    return NextResponse.json({ error: 'Failed to load posts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await enforceAdmin();
  if (error || !user) return error;
  try {
    const post = await createSitePost(readInput(await request.json()));
    return NextResponse.json(post, { status: 201 });
  } catch (err: any) {
    const message = err?.message || 'Failed to create post';
    const status = /must|Write the post|uploaded image/.test(message) ? 400 : 500;
    console.error('[blog] create failed', err);
    return NextResponse.json({ error: message }, { status });
  }
}

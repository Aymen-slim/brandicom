import { NextRequest, NextResponse } from 'next/server';
import { enforceAdmin } from '@/lib/permissions';
import { deleteSitePost, SitePostInput, updateSitePost } from '@/lib/sitePosts';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await enforceAdmin();
  if (error || !user) return error;
  try {
    const body = await request.json();
    const input: SitePostInput = {
      title: String(body?.title || ''),
      excerpt: String(body?.excerpt || ''),
      body: String(body?.body || ''),
      coverImageUrl: String(body?.coverImageUrl || ''),
      secondImageUrl: String(body?.secondImageUrl || ''),
      published: body?.published !== false,
    };
    const post = await updateSitePost(params.id, input);
    return NextResponse.json(post);
  } catch (err: any) {
    const message = err?.message || 'Failed to update post';
    const status = message === 'Post not found.' ? 404 : /must|Write the post|uploaded image/.test(message) ? 400 : 500;
    console.error('[blog] update failed', err);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await enforceAdmin();
  if (error || !user) return error;
  try {
    await deleteSitePost(params.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[blog] delete failed', err);
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
  }
}

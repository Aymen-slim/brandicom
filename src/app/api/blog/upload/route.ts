import { NextRequest, NextResponse } from 'next/server';
import { enforceAdmin } from '@/lib/permissions';
import { uploadSitePostImage } from '@/lib/sitePosts';

export async function POST(request: NextRequest) {
  const { user, error } = await enforceAdmin();
  if (error || !user) return error;
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Choose an image file.' }, { status: 400 });
    }
    const url = await uploadSitePostImage(file);
    return NextResponse.json({ url });
  } catch (err: any) {
    const message = err?.message || 'Failed to upload image';
    const status = /JPG|5 MB|Choose an image|store the image/.test(message) ? 400 : 500;
    console.error('[blog] upload failed', err);
    return NextResponse.json({ error: message }, { status });
  }
}

import { createAdminSupabaseClient } from './supabase/admin';

export interface SitePost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverImageUrl: string;
  secondImageUrl: string;
  readMinutes: number;
  published: boolean;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SitePostInput {
  title: string;
  excerpt?: string;
  body: string;
  coverImageUrl: string;
  secondImageUrl?: string;
  published?: boolean;
}

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function slugify(title: string): string {
  const base = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || 'post';
}

function readMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function excerptFrom(body: string, excerpt?: string): string {
  const given = (excerpt || '').replace(/\s+/g, ' ').trim();
  if (given) return given.slice(0, 220);
  return body.replace(/\s+/g, ' ').trim().slice(0, 160);
}

function mapRow(row: Record<string, any>): SitePost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt || '',
    body: row.body || '',
    coverImageUrl: row.cover_image_url || '',
    secondImageUrl: row.second_image_url || '',
    readMinutes: Number(row.read_minutes) || 1,
    published: Boolean(row.published),
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertHttpUrl(value: string, label: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be an uploaded image.`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`${label} must be an uploaded image.`);
  }
}

export function storagePathFromPublicUrl(url: string): string | null {
  const marker = '/storage/v1/object/public/site-posts/';
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length).split('?')[0]);
}

export async function fetchSitePosts(): Promise<SitePost[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from('site_posts')
    .select('*')
    .order('published_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapRow);
}

async function uniqueSlug(title: string, ignoreId?: string): Promise<string> {
  const supabase = createAdminSupabaseClient();
  const base = slugify(title);
  for (let i = 0; i < 20; i += 1) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const query = supabase.from('site_posts').select('id').eq('slug', slug).maybeSingle();
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.id === ignoreId) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function createSitePost(input: SitePostInput): Promise<SitePost> {
  const title = input.title.replace(/\s+/g, ' ').trim();
  const body = input.body.trim();
  if (title.length < 3) throw new Error('Title must be at least 3 characters.');
  if (!body) throw new Error('Write the post text.');
  assertHttpUrl(input.coverImageUrl, 'Post image');

  const supabase = createAdminSupabaseClient();
  const now = new Date().toISOString();
  const published = input.published !== false;
  const { data, error } = await supabase
    .from('site_posts')
    .insert({
      slug: await uniqueSlug(title),
      title: title.slice(0, 160),
      excerpt: excerptFrom(body, input.excerpt),
      body: body.slice(0, 20000),
      cover_image_url: input.coverImageUrl,
      second_image_url: (input.secondImageUrl || '').trim(),
      read_minutes: readMinutes(body),
      published,
      published_at: now,
      updated_at: now,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapRow(data);
}

export async function updateSitePost(id: string, input: SitePostInput): Promise<SitePost> {
  const title = input.title.replace(/\s+/g, ' ').trim();
  const body = input.body.trim();
  if (title.length < 3) throw new Error('Title must be at least 3 characters.');
  if (!body) throw new Error('Write the post text.');
  assertHttpUrl(input.coverImageUrl, 'Post image');

  const supabase = createAdminSupabaseClient();
  const existing = await supabase.from('site_posts').select('*').eq('id', id).maybeSingle();
  if (existing.error) throw existing.error;
  if (!existing.data) throw new Error('Post not found.');

  const published = input.published !== false;
  const wasPublished = Boolean(existing.data.published);
  const { data, error } = await supabase
    .from('site_posts')
    .update({
      title: title.slice(0, 160),
      excerpt: excerptFrom(body, input.excerpt),
      body: body.slice(0, 20000),
      cover_image_url: input.coverImageUrl,
      second_image_url: (input.secondImageUrl || '').trim(),
      read_minutes: readMinutes(body),
      published,
      published_at: published && !wasPublished ? new Date().toISOString() : existing.data.published_at,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;

  const next = mapRow(data);
  const previous = mapRow(existing.data);
  if (previous.coverImageUrl !== next.coverImageUrl) await deleteStoredImage(previous.coverImageUrl);
  if (previous.secondImageUrl !== next.secondImageUrl) await deleteStoredImage(previous.secondImageUrl);
  return next;
}

export async function deleteSitePost(id: string): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const existing = await supabase
    .from('site_posts')
    .select('cover_image_url, second_image_url')
    .eq('id', id)
    .maybeSingle();
  if (existing.error) throw existing.error;

  const { error } = await supabase.from('site_posts').delete().eq('id', id);
  if (error) throw error;

  if (existing.data) {
    await deleteStoredImage(existing.data.cover_image_url || '');
    await deleteStoredImage(existing.data.second_image_url || '');
  }
}

export async function uploadSitePostImage(file: File): Promise<string> {
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new Error('Use a JPG, PNG, WEBP, or GIF image.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Each image must be 5 MB or smaller.');

  const bytes = Buffer.from(await file.arrayBuffer());
  const path = `posts/${crypto.randomUUID()}.${ext}`;
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.storage.from('site-posts').upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (error) {
    throw new Error(
      'Could not store the image. Run supabase/site_posts.sql in the Supabase SQL editor, then try again.'
    );
  }
  const { data } = supabase.storage.from('site-posts').getPublicUrl(path);
  return data.publicUrl;
}

async function deleteStoredImage(url: string) {
  const path = storagePathFromPublicUrl(url);
  if (!path) return;
  try {
    const supabase = createAdminSupabaseClient();
    await supabase.storage.from('site-posts').remove([path]);
  } catch (err) {
    console.error('[site-posts] failed to delete image', err);
  }
}

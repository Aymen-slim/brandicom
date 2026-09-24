import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser, isAdmin } from '@/lib/permissions';
import { fetchSitePosts } from '@/lib/sitePosts';
import { AppShell } from '@/components/AppShell';
import { BlogManager } from '@/components/BlogManager';

export default async function BlogAdminPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) redirect('/dashboard');

  let posts: Awaited<ReturnType<typeof fetchSitePosts>> = [];
  let loadError = '';
  try {
    posts = await fetchSitePosts();
  } catch (err) {
    console.error('[blog] failed to load posts', err);
    loadError = 'Could not load posts. Run supabase/site_posts.sql in the Supabase SQL editor, then refresh.';
  }

  return (
    <AppShell
      user={user}
      title="Blog"
      subtitle="Write a post with text and two images. Published posts appear on the website blog and post page."
    >
      <style>{`@media (max-width: 900px) { .blog-admin-grid { grid-template-columns: 1fr !important; } }`}</style>
      {loadError ? (
        <div className="glass-card" style={{ padding: 18, color: 'var(--text-muted)' }}>{loadError}</div>
      ) : (
        <BlogManager initialPosts={posts} />
      )}
    </AppShell>
  );
}

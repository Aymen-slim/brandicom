'use client';

import React, { useState } from 'react';
import { SitePost } from '@/lib/sitePosts';

interface BlogManagerProps {
  initialPosts: SitePost[];
}

const emptyForm = {
  title: '',
  excerpt: '',
  body: '',
  published: true,
};

async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/blog/upload', { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Image upload failed');
  return data.url as string;
}

export function BlogManager({ initialPosts }: BlogManagerProps) {
  const [posts, setPosts] = useState<SitePost[]>(initialPosts);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState('');
  const [coverPreview, setCoverPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setForm(emptyForm);
    setEditingId(null);
    setCoverFile(null);
    setCoverUrl('');
    setCoverPreview('');
    setError('');
  };

  const onCoverFile = (file: File | null) => {
    setCoverFile(file);
    setCoverPreview(file ? URL.createObjectURL(file) : coverUrl);
  };

  const edit = (post: SitePost) => {
    setEditingId(post.id);
    setForm({
      title: post.title,
      excerpt: post.excerpt,
      body: post.body,
      published: post.published,
    });
    setCoverFile(null);
    setCoverUrl(post.coverImageUrl);
    setCoverPreview(post.coverImageUrl);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const nextCover = coverFile ? await uploadImage(coverFile) : coverUrl;
      if (!nextCover) {
        throw new Error('Add an image before publishing.');
      }
      const payload = {
        title: form.title,
        excerpt: form.excerpt,
        body: form.body,
        coverImageUrl: nextCover,
        secondImageUrl: '',
        published: form.published,
      };
      const res = await fetch(editingId ? `/api/blog/${editingId}` : '/api/blog', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save the post');
      setPosts((current) => {
        const without = current.filter((post) => post.id !== data.id);
        return [data as SitePost, ...without];
      });
      reset();
    } catch (err: any) {
      setError(err.message || 'Could not save the post');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (post: SitePost) => {
    if (!confirm(`Delete “${post.title}”?`)) return;
    const res = await fetch(`/api/blog/${post.id}`, { method: 'DELETE' });
    if (!res.ok) {
      alert('Could not delete this post.');
      return;
    }
    setPosts((current) => current.filter((item) => item.id !== post.id));
    if (editingId === post.id) reset();
  };

  return (
    <div className="blog-admin-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(280px, 0.9fr)', gap: 16 }}>
      <form className="glass-card" onSubmit={save} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontWeight: 700 }}>{editingId ? 'Edit post' : 'New blog post'}</div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Title</span>
          <input className="input-field" value={form.title} maxLength={160} required onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Short summary</span>
          <input className="input-field" value={form.excerpt} maxLength={220} placeholder="Shown on the blog card" onChange={(e) => setForm({ ...form, excerpt: e.target.value })} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Post text</span>
          <textarea className="input-field" rows={12} required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Write the article. A blank line starts a new paragraph." />
        </label>
        <ImageField label="Post image" preview={coverPreview} onChange={onCoverFile} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
          Show on the website
        </label>
        {error ? <div style={{ color: '#e11d48', fontSize: 13 }}>{error}</div> : null}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Update post' : 'Publish post'}</button>
          {editingId ? <button className="btn btn-secondary" type="button" onClick={reset}>Cancel</button> : null}
        </div>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {posts.length === 0 ? (
          <div className="glass-card" style={{ padding: 18, color: 'var(--text-muted)' }}>No posts yet.</div>
        ) : posts.map((post) => (
          <article key={post.id} className="glass-card" style={{ padding: 14, display: 'grid', gridTemplateColumns: '72px 1fr', gap: 12 }}>
            {post.coverImageUrl ? <img src={post.coverImageUrl} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }} /> : <div />}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <strong>{post.title}</strong>
                <span className="badge" style={{ background: post.published ? '#ecfdf5' : '#f3f4f6', color: post.published ? '#059669' : '#6b7280' }}>
                  {post.published ? 'Live' : 'Hidden'}
                </span>
              </div>
              <p style={{ color: 'var(--text-muted)', margin: '6px 0 10px' }}>{post.excerpt}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => edit(post)}>Edit</button>
                <button className="btn btn-danger btn-sm" type="button" onClick={() => remove(post)}>Delete</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ImageField({
  label,
  preview,
  onChange,
}: {
  label: string;
  preview: string;
  onChange: (file: File | null) => void;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span>{label}</span>
      <input className="input-field" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => onChange(e.target.files?.[0] || null)} />
      {preview ? <img src={preview} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8 }} /> : null}
    </label>
  );
}

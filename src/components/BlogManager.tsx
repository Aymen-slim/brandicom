'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SitePost } from '@/lib/sitePosts';
import {
  Clock,
  Eye,
  EyeOff,
  ImageIcon,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';

interface BlogManagerProps {
  initialPosts: SitePost[];
}

const emptyForm = {
  title: '',
  excerpt: '',
  body: '',
  published: true,
};

function estimateReadMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function formatPostDate(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

function bodyParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

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
  const [editingSlug, setEditingSlug] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState('');
  const [coverPreview, setCoverPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [listQuery, setListQuery] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setPosts(initialPosts);
  }, [initialPosts]);

  const readMinutes = useMemo(() => estimateReadMinutes(form.body), [form.body]);
  const wordCount = useMemo(
    () => form.body.trim().split(/\s+/).filter(Boolean).length,
    [form.body]
  );

  const filteredPosts = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.excerpt.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q)
    );
  }, [posts, listQuery]);

  const reset = () => {
    setForm(emptyForm);
    setEditingId(null);
    setEditingSlug('');
    setCoverFile(null);
    setCoverUrl('');
    setCoverPreview('');
    setError('');
  };

  const applyCoverFile = (file: File | null) => {
    setCoverFile(file);
    if (file) {
      setCoverPreview(URL.createObjectURL(file));
    } else {
      setCoverPreview(coverUrl);
    }
  };

  const clearCover = () => {
    setCoverFile(null);
    setCoverUrl('');
    setCoverPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const edit = (post: SitePost) => {
    setEditingId(post.id);
    setEditingSlug(post.slug);
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
    composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const nextCover = coverFile ? await uploadImage(coverFile) : coverUrl;
      if (!nextCover) {
        throw new Error('Add a cover image before saving.');
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not save the post';
      setError(message);
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

  const previewExcerpt =
    form.excerpt.trim() ||
    form.body.replace(/\s+/g, ' ').trim().slice(0, 160) ||
    'Add a short summary for blog cards…';

  return (
    <div className="blog-admin">
      <div className="blog-admin-toolbar glass-card">
        <div>
          <div className="blog-admin-toolbar-title">Website blog</div>
          <div className="blog-admin-toolbar-meta">
            {posts.length} post{posts.length === 1 ? '' : 's'} · {posts.filter((p) => p.published).length} live
          </div>
        </div>
        <button type="button" className="btn btn-secondary" onClick={reset}>
          <Plus size={14} />
          New post
        </button>
      </div>

      <div className="blog-admin-grid">
        <form ref={composerRef} className="blog-composer glass-card" onSubmit={save}>
          <div className="blog-composer-header">
            <div>
              <h2 className="blog-composer-heading">{editingId ? 'Edit post' : 'Write a post'}</h2>
              {editingSlug ? (
                <p className="blog-composer-slug">/{editingSlug}</p>
              ) : (
                <p className="blog-composer-slug blog-composer-slug-muted">Slug is generated from the title when you save</p>
              )}
            </div>
            <div className="blog-status-toggle" role="group" aria-label="Publication status">
              <button
                type="button"
                className={`blog-status-btn ${!form.published ? 'active' : ''}`}
                onClick={() => setForm({ ...form, published: false })}
              >
                <EyeOff size={13} />
                Draft
              </button>
              <button
                type="button"
                className={`blog-status-btn ${form.published ? 'active' : ''}`}
                onClick={() => setForm({ ...form, published: true })}
              >
                <Eye size={13} />
                Live
              </button>
            </div>
          </div>

          <label className="blog-field">
            <span className="blog-field-label">Title</span>
            <input
              className="input-field blog-title-input"
              value={form.title}
              maxLength={160}
              required
              placeholder="Catchy headline for the article"
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <span className="blog-field-hint">{form.title.length}/160</span>
          </label>

          <label className="blog-field">
            <span className="blog-field-label">Card summary</span>
            <input
              className="input-field"
              value={form.excerpt}
              maxLength={220}
              placeholder="One line shown on the blog listing (optional — we can use the opening text)"
              onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
            />
            <span className="blog-field-hint">{form.excerpt.length}/220</span>
          </label>

          <label className="blog-field">
            <span className="blog-field-label">Article</span>
            <textarea
              className="input-field blog-body-input"
              rows={14}
              required
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Write your story here. Press Enter twice to start a new paragraph on the website."
            />
            <span className="blog-field-hint">
              {wordCount} words · ~{readMinutes} min read
            </span>
          </label>

          <div className="blog-field">
            <span className="blog-field-label">Cover image</span>
            <div
              className={`blog-cover-drop ${dragOver ? 'blog-cover-drop-active' : ''} ${coverPreview ? 'blog-cover-drop-has-image' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file && file.type.startsWith('image/')) applyCoverFile(file);
              }}
              onClick={() => !coverPreview && fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              role="button"
              tabIndex={0}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="blog-cover-file-input"
                onChange={(e) => applyCoverFile(e.target.files?.[0] || null)}
              />
              {coverPreview ? (
                <>
                  <img src={coverPreview} alt="" className="blog-cover-preview" />
                  <div className="blog-cover-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      <Upload size={12} />
                      Replace
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearCover();
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </>
              ) : (
                <div className="blog-cover-placeholder">
                  <ImageIcon size={28} strokeWidth={1.5} color="#9ca3af" />
                  <p>Drop an image here or click to upload</p>
                  <span>JPEG, PNG, WebP or GIF · max 5 MB</span>
                </div>
              )}
            </div>
          </div>

          {error ? <div className="blog-error">{error}</div> : null}

          <div className="blog-composer-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : form.published ? 'Publish post' : 'Save draft'}
            </button>
            {editingId ? (
              <button className="btn btn-secondary" type="button" onClick={reset}>
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>

        <aside className="blog-admin-side">
          <div className="glass-card blog-preview-card">
            <div className="blog-preview-label">Live preview</div>
            <article className="blog-preview-article">
              {coverPreview ? (
                <img src={coverPreview} alt="" className="blog-preview-cover" />
              ) : (
                <div className="blog-preview-cover blog-preview-cover-empty">Cover image</div>
              )}
              <div className="blog-preview-meta">
                <Clock size={12} />
                {readMinutes} min read
                {!form.published && (
                  <span className="blog-preview-draft-pill">Draft</span>
                )}
              </div>
              <h3 className="blog-preview-title">{form.title.trim() || 'Post title'}</h3>
              <p className="blog-preview-excerpt">{previewExcerpt}</p>
              <div className="blog-preview-body">
                {bodyParagraphs(form.body).length > 0
                  ? bodyParagraphs(form.body).map((para, i) => <p key={i}>{para}</p>)
                  : <p className="blog-preview-placeholder">Your paragraphs will appear here as you write.</p>}
              </div>
            </article>
          </div>

          <div className="glass-card blog-list-card">
            <div className="blog-list-header">
              <span className="blog-list-title">All posts</span>
              <div className="blog-list-search">
                <Search size={14} color="var(--text-muted)" />
                <input
                  type="search"
                  placeholder="Search…"
                  value={listQuery}
                  onChange={(e) => setListQuery(e.target.value)}
                  aria-label="Search posts"
                />
              </div>
            </div>

            <div className="blog-list-scroll">
              {filteredPosts.length === 0 ? (
                <p className="blog-list-empty">
                  {posts.length === 0 ? 'No posts yet — write your first one on the left.' : 'No posts match your search.'}
                </p>
              ) : (
                filteredPosts.map((post) => (
                  <article
                    key={post.id}
                    className={`blog-list-item ${editingId === post.id ? 'blog-list-item-active' : ''}`}
                  >
                    {post.coverImageUrl ? (
                      <img src={post.coverImageUrl} alt="" className="blog-list-thumb" />
                    ) : (
                      <div className="blog-list-thumb blog-list-thumb-empty" />
                    )}
                    <div className="blog-list-body">
                      <div className="blog-list-row">
                        <strong className="blog-list-item-title">{post.title}</strong>
                        <span
                          className={`blog-list-status ${post.published ? 'blog-list-status-live' : 'blog-list-status-draft'}`}
                        >
                          {post.published ? 'Live' : 'Draft'}
                        </span>
                      </div>
                      <p className="blog-list-excerpt">{post.excerpt || '—'}</p>
                      <div className="blog-list-meta">
                        {formatPostDate(post.publishedAt)} · {post.readMinutes} min
                      </div>
                      <div className="blog-list-actions">
                        <button className="btn btn-secondary btn-sm" type="button" onClick={() => edit(post)}>
                          <Pencil size={12} />
                          Edit
                        </button>
                        <button className="btn btn-danger btn-sm" type="button" onClick={() => remove(post)}>
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

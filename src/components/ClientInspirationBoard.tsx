'use client';

import React, { useState } from 'react';
import { ClientData, InspirationIdea, InspirationPlatform, InspirationFormat, UserSummary } from '@/types';
import {
  Sparkles,
  Plus,
  ExternalLink,
  Trash2,
  Copy,
  Check,
  Share2,
  Film,
  Video,
  ChevronDown,
  ChevronUp,
  FileText,
  Lightbulb,
  CheckCircle2,
  X,
} from 'lucide-react';
import { InstagramIcon, TikTokIcon } from './SocialIcons';
import { detectVideoPlatform, detectVideoFormat, cleanVideoUrl } from '@/lib/clientInspirations';

interface ClientInspirationBoardProps {
  client: ClientData;
  user?: UserSummary | null;
  onClientUpdated?: (updated: ClientData) => void;
  onDeliverableAdded?: () => void;
  onShareToChat?: (text: string) => void;
}

export function ClientInspirationBoard({
  client,
  user,
  onClientUpdated,
  onDeliverableAdded,
  onShareToChat,
}: ClientInspirationBoardProps) {
  const [inspirations, setInspirations] = useState<InspirationIdea[]>(client.inspirations || []);
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [convertedIds, setConvertedIds] = useState<Set<string>>(new Set());
  const [notesExpanded, setNotesExpanded] = useState(false);

  // Add form fields
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState<InspirationPlatform>('instagram');
  const [format, setFormat] = useState<InspirationFormat>('reel');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // When URL changes, auto-detect platform & format
  const handleUrlChange = (val: string) => {
    setUrl(val);
    setFormError(null);
    if (val.trim()) {
      const detectedPlat = detectVideoPlatform(val);
      const detectedFmt = detectVideoFormat(val);
      setPlatform(detectedPlat);
      setFormat(detectedFmt);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setFormError('Please enter a valid reel or video link.');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/clients/${client.id}/inspirations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          title: title.trim() || undefined,
          platform,
          format,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save inspiration idea');
      }

      const updatedList: InspirationIdea[] = data.inspirations || [data.idea, ...inspirations];
      setInspirations(updatedList);
      if (onClientUpdated) {
        onClientUpdated({
          ...client,
          tags: data.tags || client.tags,
          inspirations: updatedList,
        });
      }

      // Reset form
      setUrl('');
      setTitle('');
      setNotes('');
      setIsAdding(false);
    } catch (err: any) {
      setFormError(err.message || 'Error saving inspiration idea');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ideaId: string) => {
    if (!confirm('Remove this inspiration reel/video from the board?')) return;

    try {
      const res = await fetch(`/api/clients/${client.id}/inspirations?id=${ideaId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete inspiration');
      }

      const updatedList = inspirations.filter((item) => item.id !== ideaId);
      setInspirations(updatedList);
      if (onClientUpdated) {
        onClientUpdated({
          ...client,
          tags: data.tags || client.tags,
          inspirations: updatedList,
        });
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting inspiration idea');
    }
  };

  const handleCopyLink = (item: InspirationIdea) => {
    navigator.clipboard.writeText(item.url);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Convert inspiration idea into an official deliverable in the tracker
  const handleConvertToDeliverable = async (item: InspirationIdea) => {
    setConvertingId(item.id);
    try {
      const res = await fetch(`/api/clients/${client.id}/deliverables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea: item.title,
          format: item.format || 'reel',
          platform:
            item.platform === 'tiktok'
              ? 'tiktok'
              : item.platform === 'youtube'
                ? 'youtube'
                : item.platform === 'facebook'
                  ? 'facebook'
                  : 'instagram',
          link: item.url,
          instagramLink: item.platform === 'instagram' ? item.url : null,
          tiktokLink: item.platform === 'tiktok' ? item.url : null,
          caption: item.notes ? `Inspiration reference notes: ${item.notes}` : null,
          status: 'idea',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to convert to deliverable');
      }

      setConvertedIds((prev) => new Set([...Array.from(prev), item.id]));
      if (onDeliverableAdded) {
        onDeliverableAdded();
      }
    } catch (err: any) {
      alert(err.message || 'Error converting inspiration to deliverable');
    } finally {
      setConvertingId(null);
    }
  };

  // Share inspiration into Client Team Chat
  const handleShareToChat = async (item: InspirationIdea) => {
    const chatText = `💡 Inspiration ${item.format === 'reel' ? 'Reel' : 'Video'}: "${item.title}"\n${item.url}${item.notes ? `\nNotes: ${item.notes}` : ''}`;
    if (onShareToChat) {
      onShareToChat(chatText);
    } else {
      // Send directly via messages API
      try {
        const res = await fetch(`/api/clients/${client.id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: chatText }),
        });
        if (res.ok) {
          alert('Inspiration idea shared into Client Team Chat!');
        }
      } catch (err) {
        console.error('Failed to share to chat:', err);
      }
    }
  };

  return (
    <div
      className="glass-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '480px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 2px 6px rgba(236, 72, 153, 0.25)',
              flexShrink: 0,
            }}
          >
            <Lightbulb size={16} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: '#111827', margin: 0 }}>
                Inspiration Ideas
              </h4>
              <span
                style={{
                  fontSize: '10.5px',
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: 10,
                  backgroundColor: inspirations.length > 0 ? '#fdf2f8' : '#f3f4f6',
                  color: inspirations.length > 0 ? '#db2777' : '#6b7280',
                  border: inspirations.length > 0 ? '1px solid #fbcfe8' : '1px solid #e5e7eb',
                }}
              >
                {inspirations.length} {inspirations.length === 1 ? 'idea' : 'ideas'}
              </span>
            </div>
            <p style={{ fontSize: '11px', color: '#6b7280', margin: '2px 0 0' }}>
              Reels, TikToks & video references
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-sm"
          style={{
            fontSize: '11.5px',
            padding: '5px 10px',
            gap: 5,
            display: 'inline-flex',
            alignItems: 'center',
          }}
          onClick={() => {
            setIsAdding(!isAdding);
            setFormError(null);
          }}
        >
          {isAdding ? <X size={13} /> : <Plus size={13} />}
          {isAdding ? 'Close' : 'Add Link'}
        </button>
      </div>

      {/* Inline Add Reel/Video Form */}
      {isAdding && (
        <form
          onSubmit={handleSave}
          style={{
            padding: '14px 18px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            flexShrink: 0,
            animation: 'fadeIn 0.2s ease-in-out',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {formError && (
              <div
                style={{
                  fontSize: '11.5px',
                  color: '#e11d48',
                  backgroundColor: '#ffe4e6',
                  padding: '6px 10px',
                  borderRadius: 6,
                }}
              >
                {formError}
              </div>
            )}

            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                Reel / Video Link *
              </label>
              <input
                type="url"
                required
                placeholder="https://www.instagram.com/reel/... or tiktok.com/..."
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                className="input-field"
                style={{ width: '100%', fontSize: '12px', padding: '6px 10px' }}
                autoFocus
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 0.8fr', gap: 8 }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Concept / Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Fast transition hook"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', fontSize: '12px', padding: '6px 10px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Platform
                </label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as InspirationPlatform)}
                  className="input-field"
                  style={{ width: '100%', fontSize: '11.5px', padding: '6px 8px' }}
                >
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                  <option value="youtube">YouTube</option>
                  <option value="facebook">Facebook</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Format
                </label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as InspirationFormat)}
                  className="input-field"
                  style={{ width: '100%', fontSize: '11.5px', padding: '6px 8px' }}
                >
                  <option value="reel">Reel / Short</option>
                  <option value="video">Full Video</option>
                  <option value="carousel">Carousel</option>
                  <option value="photo">Photo</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                Inspiration Notes / What to adapt (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Replicate the first 2 seconds visual hook with our client's product"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input-field"
                style={{ width: '100%', fontSize: '12px', padding: '6px 10px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 2 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setIsAdding(false)}
                style={{ fontSize: '11.5px', padding: '5px 10px' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !url.trim()}
                className="btn btn-primary btn-sm"
                style={{ fontSize: '11.5px', padding: '5px 14px' }}
              >
                {saving ? 'Saving…' : 'Save Inspiration'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Inspirations List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {inspirations.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--text-muted)',
              margin: 'auto',
              padding: '24px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                backgroundColor: '#fdf2f8',
                color: '#db2777',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 2,
              }}
            >
              <Film size={22} />
            </div>
            <strong style={{ fontSize: '13px', color: '#334155' }}>No inspiration links yet</strong>
            <p style={{ fontSize: '11.5px', color: '#64748b', maxWidth: '280px', lineHeight: 1.4, margin: 0 }}>
              Save reference Instagram Reels, TikToks, or YouTube links to inspire this client&apos;s upcoming content.
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsAdding(true)}
              style={{ marginTop: 6, fontSize: '11.5px', gap: 5 }}
            >
              <Plus size={12} /> Add First Reel or Video
            </button>
          </div>
        ) : (
          inspirations.map((item) => {
            const isInstagram = item.platform === 'instagram';
            const isTikTok = item.platform === 'tiktok';
            const isConverted = convertedIds.has(item.id);

            return (
              <div
                key={item.id}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '11px 13px',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {/* Item header: platform pill, format badge, date & delete */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: 5,
                        backgroundColor: isInstagram ? '#fdf2f8' : isTikTok ? '#f1f5f9' : '#fef2f2',
                        color: isInstagram ? '#be185d' : isTikTok ? '#0f172a' : '#dc2626',
                        border: isInstagram ? '1px solid #fbcfe8' : isTikTok ? '1px solid #cbd5e1' : '1px solid #fecaca',
                        textTransform: 'uppercase',
                        letterSpacing: '0.4px',
                      }}
                    >
                      {isInstagram ? (
                        <InstagramIcon size={11} color="#be185d" />
                      ) : isTikTok ? (
                        <TikTokIcon size={11} color="#0f172a" />
                      ) : (
                        <Video size={11} />
                      )}
                      {item.platform || 'video'}
                    </span>

                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        color: '#64748b',
                        backgroundColor: '#f8fafc',
                        padding: '2px 6px',
                        borderRadius: 4,
                        textTransform: 'capitalize',
                      }}
                    >
                      {item.format || 'reel'}
                    </span>

                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                      {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <button
                      type="button"
                      onClick={() => handleCopyLink(item)}
                      title="Copy URL"
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '3px 5px', color: copiedId === item.id ? '#059669' : '#94a3b8' }}
                    >
                      {copiedId === item.id ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      title="Delete Inspiration"
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '3px 5px', color: '#f43f5e' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Title and notes */}
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#1e293b', lineHeight: 1.35 }}>
                    {item.title}
                  </div>
                  {item.notes && (
                    <div
                      style={{
                        fontSize: '11px',
                        color: '#475569',
                        backgroundColor: '#f8fafc',
                        borderLeft: '3px solid #8b5cf6',
                        padding: '4px 8px',
                        borderRadius: '0 4px 4px 0',
                        marginTop: '4px',
                        lineHeight: 1.35,
                      }}
                    >
                      {item.notes}
                    </div>
                  )}
                </div>

                {/* Link preview and action buttons */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    paddingTop: '4px',
                    borderTop: '1px solid #f1f5f9',
                    flexWrap: 'wrap',
                  }}
                >
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#4338ca',
                      textDecoration: 'none',
                      maxWidth: '180px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={item.url}
                  >
                    <ExternalLink size={12} />
                    <span>Watch {item.format === 'reel' ? 'Reel' : 'Video'}</span>
                  </a>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => handleShareToChat(item)}
                      title="Share this inspiration reel link into Client Team Chat"
                      className="btn btn-ghost btn-sm"
                      style={{
                        fontSize: '10.5px',
                        padding: '2px 7px',
                        gap: 4,
                        color: '#475569',
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                    >
                      <Share2 size={11} /> Chat
                    </button>

                    <button
                      type="button"
                      onClick={() => handleConvertToDeliverable(item)}
                      disabled={convertingId === item.id || isConverted}
                      title="Convert this idea into a task in the Deliverable Tracker"
                      className={`btn btn-sm ${isConverted ? 'btn-ghost' : 'btn-secondary'}`}
                      style={{
                        fontSize: '10.5px',
                        padding: '2px 8px',
                        gap: 4,
                        display: 'inline-flex',
                        alignItems: 'center',
                        color: isConverted ? '#059669' : undefined,
                        fontWeight: 600,
                      }}
                    >
                      {isConverted ? (
                        <>
                          <CheckCircle2 size={11} color="#059669" /> In Tracker
                        </>
                      ) : convertingId === item.id ? (
                        'Adding…'
                      ) : (
                        <>
                          <Sparkles size={11} /> To Tracker
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Integrated Client Notes (collapsible footer) */}
      <div
        style={{
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: '#fafbfc',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={() => setNotesExpanded(!notesExpanded)}
          style={{
            width: '100%',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '11.5px',
            color: '#64748b',
            fontWeight: 600,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileText size={13} />
            <span>Client Notes</span>
            {client.notes && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: '#3b82f6',
                }}
              />
            )}
          </span>
          {notesExpanded ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        </button>

        {notesExpanded && (
          <div
            style={{
              padding: '0 16px 12px',
              fontSize: '12px',
              color: '#334155',
              maxHeight: '110px',
              overflowY: 'auto',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}
          >
            {client.notes || 'No account notes yet. Configure notes in Edit Account.'}
          </div>
        )}
      </div>
    </div>
  );
}

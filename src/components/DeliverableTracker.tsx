'use client';

import React, { useState, useMemo } from 'react';
import { DeliverableData, DeliverableFormat, DeliverableStatus, Platform } from '@/types';
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  Plus,
  Trash2,
  Calendar,
  BarChart2,
  Film,
  Send,
  Clock,
  AlertCircle,
  Video,
  Layers,
  Sparkles,
  RefreshCw,
  Link2,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import { InstagramIcon, TikTokIcon } from '@/components/SocialIcons';

interface DeliverableTrackerProps {
  clientId: string;
  initialDeliverables: DeliverableData[];
  availableCreators?: Array<{ id: string; name: string; role: string }>;
  onUpdate?: () => void;
}

type ViewMode = 'all' | 'filming' | 'posting';

export function DeliverableTracker({
  clientId,
  initialDeliverables,
  availableCreators = [],
  onUpdate,
}: DeliverableTrackerProps) {
  const [deliverables, setDeliverables] = useState<DeliverableData[]>(initialDeliverables);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Sync state & inline link editing state
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editingLinkVal, setEditingLinkVal] = useState<string>('');
  const [syncNotification, setSyncNotification] = useState<{ id: string; msg: string; isError?: boolean } | null>(null);

  // Form state for new deliverable
  const [idea, setIdea] = useState('');
  const [format, setFormat] = useState<DeliverableFormat>('reel');
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [filmingDate, setFilmingDate] = useState('');
  const [publishDate, setPublishDate] = useState('');
  const [publishTime, setPublishTime] = useState('');
  const [link, setLink] = useState('');
  const [creatorId, setCreatorId] = useState('');
  const [filmed, setFilmed] = useState(false);
  const [status, setStatus] = useState<DeliverableStatus>('idea');

  // Sync engagement metrics from Apify
  const handleSyncMetrics = async (id: string) => {
    setSyncingId(id);
    setSyncNotification(null);
    try {
      const res = await fetch(`/api/deliverables/${id}/sync-metrics`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync stats via Apify');
      }

      if (data.deliverable) {
        setDeliverables((prev) =>
          prev.map((item) => (item.id === id ? data.deliverable : item))
        );
      }

      const views = data.scraped?.views?.toLocaleString() ?? '0';
      const likes = data.scraped?.likes?.toLocaleString() ?? '0';
      const comments = data.scraped?.comments?.toLocaleString() ?? '0';
      const platformName = data.scraped?.platform === 'instagram' ? 'Instagram' : data.scraped?.platform === 'tiktok' ? 'TikTok' : 'Apify';

      setSyncNotification({
        id,
        msg: `Synced from ${platformName}: ${views} views · ${likes} likes · ${comments} comments`,
      });
      setTimeout(() => setSyncNotification(null), 6000);

      if (onUpdate) onUpdate();
    } catch (err: any) {
      console.error('Failed to sync metrics:', err);
      setSyncNotification({
        id,
        msg: err.message || 'Sync failed. Please check the URL and your Apify API token.',
        isError: true,
      });
      setTimeout(() => setSyncNotification(null), 8000);
    } finally {
      setSyncingId(null);
    }
  };

  // Direct save/update deliverable link
  const handleSaveLink = async (id: string, newLink: string) => {
    const trimmed = newLink.trim();
    setDeliverables((prev) =>
      prev.map((item) => (item.id === id ? { ...item, link: trimmed || null } : item))
    );
    setEditingLinkId(null);

    try {
      const res = await fetch(`/api/deliverables/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link: trimmed || null }),
      });
      if (res.ok) {
        const updated = await res.json();
        setDeliverables((prev) =>
          prev.map((item) => (item.id === id ? { ...item, ...updated } : item))
        );
        if (onUpdate) onUpdate();
        // If a valid link was attached, automatically trigger metric sync!
        if (trimmed) {
          handleSyncMetrics(id);
        }
      }
    } catch (err) {
      console.error('Failed to update deliverable link:', err);
    }
  };

  // Toggle filmed or published status
  const handleToggle = async (id: string, field: 'filmed' | 'published', currentValue: boolean) => {
    const nextValue = !currentValue;
    const today = new Date().toISOString().slice(0, 10);

    // Optimistic UI update
    setDeliverables((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: nextValue };
        if (field === 'filmed') {
          if (nextValue && !item.filmingDate) {
            updated.filmingDate = today;
          }
          updated.status = nextValue ? 'filmed' : (item.status === 'filmed' ? 'idea' : item.status);
        }
        if (field === 'published') {
          if (nextValue && !item.publishDate) {
            updated.publishDate = today;
          }
          updated.status = nextValue ? 'published' : (item.status === 'published' ? 'filmed' : item.status);
        }
        return updated;
      })
    );

    try {
      const payload: Record<string, unknown> = { [field]: nextValue };
      const currentItem = deliverables.find((d) => d.id === id);
      if (field === 'filmed') {
        if (nextValue && !currentItem?.filmingDate) {
          payload.filmingDate = today;
        }
        payload.status = nextValue ? 'filmed' : (currentItem?.status === 'filmed' ? 'idea' : currentItem?.status || 'idea');
      }
      if (field === 'published') {
        if (nextValue && !currentItem?.publishDate) {
          payload.publishDate = today;
        }
        payload.status = nextValue ? 'published' : (currentItem?.status === 'published' ? 'filmed' : currentItem?.status || 'idea');
      }

      const res = await fetch(`/api/deliverables/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // Revert on failure
        setDeliverables((prev) =>
          prev.map((item) => (item.id === id ? { ...item, [field]: currentValue } : item))
        );
      } else {
        const updated = await res.json();
        setDeliverables((prev) =>
          prev.map((item) => (item.id === id ? { ...item, ...updated } : item))
        );
        if (onUpdate) onUpdate();
      }
    } catch (err) {
      console.error('Error updating deliverable:', err);
      setDeliverables((prev) =>
        prev.map((item) => (item.id === id ? { ...item, [field]: currentValue } : item))
      );
    }
  };

  // Direct status change
  const handleStatusChange = async (id: string, newStatus: DeliverableStatus) => {
    const isFilmed = newStatus === 'filmed' || newStatus === 'editing' || newStatus === 'scheduled' || newStatus === 'published';
    const isPublished = newStatus === 'published';
    const today = new Date().toISOString().slice(0, 10);

    setDeliverables((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, status: newStatus };
        if (newStatus === 'filmed' && !item.filmingDate) updated.filmingDate = today;
        if (isFilmed) updated.filmed = true;
        if (isPublished) updated.published = true;
        return updated;
      })
    );

    try {
      const payload: Record<string, unknown> = { status: newStatus };
      if (isFilmed) payload.filmed = true;
      if (isPublished) payload.published = true;

      const res = await fetch(`/api/deliverables/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        setDeliverables((prev) =>
          prev.map((item) => (item.id === id ? { ...item, ...updated } : item))
        );
        if (onUpdate) onUpdate();
      }
    } catch (err) {
      console.error('Error updating deliverable status:', err);
    }
  };

  // Direct date change (for filmingDate or publishDate)
  const handleDateChange = async (
    id: string,
    field: 'filmingDate' | 'publishDate',
    newDate: string
  ) => {
    const dateVal = newDate || null;
    setDeliverables((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: dateVal } : item))
    );

    try {
      const res = await fetch(`/api/deliverables/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: dateVal }),
      });

      if (!res.ok) {
        console.error('Failed to update date');
      } else {
        if (onUpdate) onUpdate();
      }
    } catch (err) {
      console.error('Error updating deliverable date:', err);
    }
  };

  // Direct time change (for publishTime)
  const handleTimeChange = async (id: string, newTime: string) => {
    const timeVal = newTime || null;
    setDeliverables((prev) =>
      prev.map((item) => (item.id === id ? { ...item, publishTime: timeVal } : item))
    );

    try {
      const res = await fetch(`/api/deliverables/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publishTime: timeVal }),
      });
      if (res.ok) {
        if (onUpdate) onUpdate();
      }
    } catch (err) {
      console.error('Error updating deliverable time:', err);
    }
  };

  // Add new deliverable
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idea.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/deliverables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea: idea.trim(),
          format,
          platform,
          filmingDate: filmingDate || (filmed ? new Date().toISOString().slice(0, 10) : null),
          publishDate: publishDate || null,
          publishTime: publishTime || null,
          link: link.trim() || null,
          creatorId: creatorId || null,
          filmed,
          published: status === 'published',
          status,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setDeliverables((prev) => [created, ...prev]);
        setIdea('');
        setLink('');
        setFilmingDate('');
        setPublishDate('');
        setPublishTime('');
        setCreatorId('');
        setFilmed(false);
        setStatus('idea');
        setIsAdding(false);
        if (onUpdate) onUpdate();
        if (created.link) {
          handleSyncMetrics(created.id);
        }
      }
    } catch (err) {
      console.error('Failed to create deliverable:', err);
    } finally {
      setSaving(false);
    }
  };

  // Delete deliverable
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this deliverable?')) return;

    try {
      const res = await fetch(`/api/deliverables/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDeliverables((prev) => prev.filter((d) => d.id !== id));
        if (onUpdate) onUpdate();
      }
    } catch (err) {
      console.error('Failed to delete deliverable:', err);
    }
  };

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Stats computation
  const { totalCount, filmedCount, toFilmCount, publishedCount, toPublishCount, nextShoot, nextPost } = useMemo(() => {
    const total = deliverables.length;
    let filmed = 0;
    let published = 0;
    let shoot: string | undefined;
    let post: string | undefined;

    for (const d of deliverables) {
      if (d.filmed) filmed++;
      if (d.published) published++;
      if (!d.filmed && d.filmingDate && d.filmingDate >= todayStr) {
        if (!shoot || d.filmingDate < shoot) shoot = d.filmingDate;
      }
      if (!d.published && d.publishDate && d.publishDate >= todayStr) {
        if (!post || d.publishDate < post) post = d.publishDate;
      }
    }

    return {
      totalCount: total,
      filmedCount: filmed,
      toFilmCount: total - filmed,
      publishedCount: published,
      toPublishCount: total - published,
      nextShoot: shoot,
      nextPost: post,
    };
  }, [deliverables]);

  // Filtered deliverables
  const filteredDeliverables = useMemo(() => {
    return deliverables.filter((d) => {
      if (viewMode === 'filming') {
        if (filterStatus === 'unfilmed') return !d.filmed;
        if (filterStatus === 'filmed') return d.filmed;
      } else if (viewMode === 'posting') {
        if (filterStatus === 'unposted') return !d.published;
        if (filterStatus === 'posted') return d.published;
      }
      return true;
    });
  }, [deliverables, viewMode, filterStatus]);

  const platformPills: Record<string, { bg: string; text: string }> = {
    instagram: { bg: '#fdf2f8', text: '#db2777' },
    tiktok: { bg: '#ecfeff', text: '#0891b2' },
    youtube: { bg: '#fef2f2', text: '#dc2626' },
    facebook: { bg: '#eff6ff', text: '#2563eb' },
  };

  const formatDateDisplay = (dateStr: string | null) => {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const isOverdue = (dateStr: string | null, isDone: boolean) => {
    if (!dateStr || isDone) return false;
    return dateStr < todayStr;
  };

  const isToday = (dateStr: string | null) => {
    return dateStr === todayStr;
  };

  return (
    <div className="glass-card" style={{ overflow: 'hidden' }}>
      {/* Top Header Bar */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 7 }}>
            <Layers size={16} color="#4f46e5" /> Content Pipeline & Production
          </h3>
          <p style={{ fontSize: '12px', color: '#6b7280', marginTop: 2 }}>
            Manage independent dates and statuses for <strong>Filming (Shoots)</strong> and <strong>Posting (Publishing)</strong>
          </p>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="btn btn-primary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
        >
          <Plus size={13} />
          {isAdding ? 'Cancel' : 'Add Content'}
        </button>
      </div>

      {/* Production Milestone Summary Cards */}
      <div
        className="grid-responsive-2"
        style={{
          padding: '14px 16px',
          backgroundColor: '#f9fafb',
          borderBottom: '1px solid var(--border-subtle)',
          gap: 12,
        }}
      >
        {/* Filming Milestone Card */}
        <div
          style={{
            background: '#ffffff',
            padding: '12px 16px',
            borderRadius: '10px',
            border: viewMode === 'filming' ? '2px solid #8b5cf6' : '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onClick={() => {
            setViewMode(viewMode === 'filming' ? 'all' : 'filming');
            setFilterStatus('all');
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ display: 'inline-flex', padding: 5, borderRadius: 6, background: '#f5f3ff', color: '#7c3aed' }}>
                <Film size={14} />
              </span>
              <strong style={{ fontSize: '13px', color: '#111827' }}>Filming (Shoots)</strong>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '12px',
                background: filmedCount === totalCount && totalCount > 0 ? '#ecfdf5' : '#f3f4f6',
                color: filmedCount === totalCount && totalCount > 0 ? '#059669' : '#4b5563',
              }}
            >
              {filmedCount} / {totalCount} Filmed
            </span>
          </div>

          <div style={{ width: '100%', height: 4, background: '#e5e7eb', borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
            <div
              style={{
                width: `${totalCount ? (filmedCount / totalCount) * 100 : 0}%`,
                height: '100%',
                background: '#8b5cf6',
                borderRadius: 999,
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#6b7280' }}>
            <span>{toFilmCount > 0 ? `${toFilmCount} remaining to shoot` : 'All scheduled content filmed!'}</span>
            <span>{nextShoot ? `Next shoot: ${formatDateDisplay(nextShoot)}` : 'No upcoming shoot set'}</span>
          </div>
        </div>

        {/* Posting Milestone Card */}
        <div
          style={{
            background: '#ffffff',
            padding: '12px 16px',
            borderRadius: '10px',
            border: viewMode === 'posting' ? '2px solid #2563eb' : '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onClick={() => {
            setViewMode(viewMode === 'posting' ? 'all' : 'posting');
            setFilterStatus('all');
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ display: 'inline-flex', padding: 5, borderRadius: 6, background: '#eff6ff', color: '#2563eb' }}>
                <Send size={14} />
              </span>
              <strong style={{ fontSize: '13px', color: '#111827' }}>Posting (Distribution)</strong>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '12px',
                background: publishedCount === totalCount && totalCount > 0 ? '#ecfdf5' : '#f3f4f6',
                color: publishedCount === totalCount && totalCount > 0 ? '#059669' : '#4b5563',
              }}
            >
              {publishedCount} / {totalCount} Published
            </span>
          </div>

          <div style={{ width: '100%', height: 4, background: '#e5e7eb', borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
            <div
              style={{
                width: `${totalCount ? (publishedCount / totalCount) * 100 : 0}%`,
                height: '100%',
                background: '#2563eb',
                borderRadius: 999,
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#6b7280' }}>
            <span>{toPublishCount > 0 ? `${toPublishCount} remaining to post` : 'All scheduled content published!'}</span>
            <span>{nextPost ? `Next post: ${formatDateDisplay(nextPost)}` : 'No upcoming post set'}</span>
          </div>
        </div>
      </div>

      {/* View Mode Toolbar */}
      <div
        style={{
          padding: '12px 18px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === 'all' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '12px' }}
            onClick={() => {
              setViewMode('all');
              setFilterStatus('all');
            }}
          >
            All Content ({totalCount})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === 'filming' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '12px', backgroundColor: viewMode === 'filming' ? '#7c3aed' : undefined, color: viewMode === 'filming' ? '#fff' : undefined }}
            onClick={() => {
              setViewMode('filming');
              setFilterStatus('all');
            }}
          >
            <Film size={12} /> Filming Pipeline ({toFilmCount} pending)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === 'posting' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '12px', backgroundColor: viewMode === 'posting' ? '#2563eb' : undefined, color: viewMode === 'posting' ? '#fff' : undefined }}
            onClick={() => {
              setViewMode('posting');
              setFilterStatus('all');
            }}
          >
            <Send size={12} /> Posting Pipeline ({toPublishCount} pending)
          </button>
        </div>

        {/* View-specific sub-filter pills */}
        {viewMode === 'filming' && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#6b7280', marginRight: 4 }}>Filter:</span>
            <button
              type="button"
              className={`btn btn-xs ${filterStatus === 'all' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '11px', padding: '2px 8px' }}
              onClick={() => setFilterStatus('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`btn btn-xs ${filterStatus === 'unfilmed' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '11px', padding: '2px 8px' }}
              onClick={() => setFilterStatus('unfilmed')}
            >
              Needs Filming ({toFilmCount})
            </button>
            <button
              type="button"
              className={`btn btn-xs ${filterStatus === 'filmed' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '11px', padding: '2px 8px' }}
              onClick={() => setFilterStatus('filmed')}
            >
              Filmed ({filmedCount})
            </button>
          </div>
        )}

        {viewMode === 'posting' && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#6b7280', marginRight: 4 }}>Filter:</span>
            <button
              type="button"
              className={`btn btn-xs ${filterStatus === 'all' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '11px', padding: '2px 8px' }}
              onClick={() => setFilterStatus('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`btn btn-xs ${filterStatus === 'unposted' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '11px', padding: '2px 8px' }}
              onClick={() => setFilterStatus('unposted')}
            >
              To Post ({toPublishCount})
            </button>
            <button
              type="button"
              className={`btn btn-xs ${filterStatus === 'posted' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '11px', padding: '2px 8px' }}
              onClick={() => setFilterStatus('posted')}
            >
              Posted ({publishedCount})
            </button>
          </div>
        )}
      </div>

      {/* Add deliverable inline form */}
      {isAdding && (
        <form
          onSubmit={handleCreate}
          style={{
            padding: '18px 20px',
            backgroundColor: '#faf5ff',
            borderBottom: '1px solid #e9d5ff',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Sparkles size={14} color="#7c3aed" />
            <strong style={{ fontSize: '13px', color: '#581c87' }}>New Content Deliverable</strong>
          </div>

          <div className="grid-responsive-3" style={{ gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginBottom: '3px', fontWeight: 600 }}>
                Content Concept / Hook *
              </label>
              <input
                type="text"
                placeholder="e.g. 3-Step Night Routine Macro UGC"
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                required
                className="input-field"
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginBottom: '3px', fontWeight: 600 }}>
                Format
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as DeliverableFormat)}
                className="input-field"
              >
                <option value="reel">Reel / Short</option>
                <option value="photo">Photo Still</option>
                <option value="story">Story</option>
                <option value="carousel">Carousel</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginBottom: '3px', fontWeight: 600 }}>
                Platform
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as Platform)}
                className="input-field"
              >
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube</option>
                <option value="facebook">Facebook</option>
              </select>
            </div>
          </div>

          {/* DEDICATED FILMING AND POSTING DATES */}
          <div
            className="grid-responsive-3"
            style={{
              gap: '10px',
              padding: '12px',
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e9d5ff',
            }}
          >
            <div>
              <label style={{ fontSize: '11.5px', color: '#7c3aed', display: 'flex', alignItems: 'center', gap: 4, marginBottom: '3px', fontWeight: 700 }}>
                <Film size={12} /> Filming Date (Shoot)
              </label>
              <input
                type="date"
                value={filmingDate}
                onChange={(e) => setFilmingDate(e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <label style={{ fontSize: '11.5px', color: '#2563eb', display: 'flex', alignItems: 'center', gap: 4, marginBottom: '3px', fontWeight: 700 }}>
                <Send size={12} /> Posting Date (Publish)
              </label>
              <input
                type="date"
                value={publishDate}
                onChange={(e) => setPublishDate(e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <label style={{ fontSize: '11.5px', color: '#2563eb', display: 'flex', alignItems: 'center', gap: 4, marginBottom: '3px', fontWeight: 700 }}>
                <Clock size={12} /> Posting Time
              </label>
              <input
                type="time"
                value={publishTime}
                onChange={(e) => setPublishTime(e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginBottom: '3px', fontWeight: 600 }}>
                Talent / Assigned Creator
              </label>
              <select
                value={creatorId}
                onChange={(e) => setCreatorId(e.target.value)}
                className="input-field"
              >
                <option value="">-- Internal Agency Team --</option>
                {availableCreators.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginBottom: '3px', fontWeight: 600 }}>
                Live URL (Optional)
              </label>
              <input
                type="url"
                placeholder="https://..."
                value={link}
                onChange={(e) => setLink(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          {/* Workflow Stage & Filmed Checkbox */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ fontSize: '11.5px', color: '#334155', fontWeight: 600 }}>
                Workflow Stage:
              </label>
              <select
                value={status}
                onChange={(e) => {
                  const s = e.target.value as DeliverableStatus;
                  setStatus(s);
                  if (s === 'filmed' || s === 'editing' || s === 'scheduled' || s === 'published') {
                    setFilmed(true);
                    if (!filmingDate) setFilmingDate(new Date().toISOString().slice(0, 10));
                  }
                }}
                className="input-field"
                style={{ width: 'auto', padding: '4px 10px', fontSize: '12px' }}
              >
                <option value="idea">Idea Stage</option>
                <option value="scripted">Scripted / Pre-production</option>
                <option value="filmed">Filmed</option>
                <option value="editing">Editing / Post-production</option>
                <option value="scheduled">Scheduled for Publish</option>
                <option value="published">Published</option>
              </select>
            </div>

            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                color: filmed ? '#059669' : '#475569',
                backgroundColor: filmed ? '#ecfdf5' : '#ffffff',
                padding: '5px 12px',
                borderRadius: '6px',
                border: filmed ? '1px solid #a7f3d0' : '1px solid #cbd5e1',
                transition: 'all 0.15s ease',
              }}
            >
              <input
                type="checkbox"
                checked={filmed}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setFilmed(checked);
                  if (checked) {
                    if (status === 'idea' || status === 'scripted') setStatus('filmed');
                    if (!filmingDate) setFilmingDate(new Date().toISOString().slice(0, 10));
                  } else {
                    if (status === 'filmed') setStatus('idea');
                  }
                }}
                style={{ accentColor: '#059669', width: '15px', height: '15px' }}
              />
              <span>Shoot Completed / Filmed</span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="btn btn-ghost btn-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary btn-sm"
            >
              {saving ? 'Saving...' : 'Save Deliverable'}
            </button>
          </div>
        </form>
      )}

      {/* Deliverables Table */}
      <div className="table-responsive-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {/* Filming Column Header */}
              <th style={{ width: viewMode === 'filming' ? '180px' : '150px', minWidth: '140px', background: '#fbfaff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#6d28d9', fontWeight: 700 }}>
                  <Film size={12} /> Filming
                </div>
              </th>

              {/* Posting Column Header */}
              <th style={{ width: viewMode === 'posting' ? '180px' : '150px', minWidth: '140px', background: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#1d4ed8', fontWeight: 700 }}>
                  <Send size={12} /> Posting
                </div>
              </th>

              <th style={{ minWidth: '180px' }}>Idea / Concept</th>
              <th style={{ minWidth: '100px' }}>Stage</th>
              <th style={{ minWidth: '120px' }}>Platform & Format</th>
              <th style={{ minWidth: '120px' }}>Talent / Creator</th>

              {viewMode !== 'filming' && <th>Attributed Results</th>}
              <th style={{ textAlign: 'right', paddingRight: '16px', width: '50px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDeliverables.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  {deliverables.length === 0
                    ? 'No deliverables tracked for this client yet.'
                    : 'No content matching the selected filter.'}
                </td>
              </tr>
            ) : (
              filteredDeliverables.map((d) => {
                const filmingOverdue = isOverdue(d.filmingDate, d.filmed);
                const filmingToday = isToday(d.filmingDate);
                const postingOverdue = isOverdue(d.publishDate, d.published);
                const postingToday = isToday(d.publishDate);

                return (
                  <tr key={d.id}>
                    {/* FILMING COLUMN: Status Toggle + Date Picker */}
                    <td style={{ background: '#fbfaff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => handleToggle(d.id, 'filmed', d.filmed)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: d.filmed ? '#059669' : '#9ca3af',
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: 0,
                          }}
                          title={d.filmed ? 'Filmed (Click to mark unfilmed)' : 'Not filmed (Click to mark filmed)'}
                        >
                          {d.filmed ? <CheckCircle2 size={16} color="#059669" /> : <Circle size={16} />}
                        </button>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <input
                            type="date"
                            value={d.filmingDate || ''}
                            onChange={(e) => handleDateChange(d.id, 'filmingDate', e.target.value)}
                            style={{
                              fontSize: '11px',
                              padding: '2px 4px',
                              border: '1px solid #e5e7eb',
                              borderRadius: '4px',
                              background: '#fff',
                              color: d.filmed ? '#059669' : filmingOverdue ? '#dc2626' : '#374151',
                              fontWeight: d.filmingDate ? 600 : 400,
                              maxWidth: '120px',
                            }}
                            title="Shoot / Filming Date"
                          />
                          {filmingOverdue && (
                            <span style={{ fontSize: '10px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
                              <AlertCircle size={10} /> Overdue shoot
                            </span>
                          )}
                          {filmingToday && !d.filmed && (
                            <span style={{ fontSize: '10px', color: '#7c3aed', fontWeight: 700 }}>
                              Shoot today!
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* POSTING COLUMN: Status Toggle + Date Picker */}
                    <td style={{ background: '#f8fafc' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => handleToggle(d.id, 'published', d.published)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: d.published ? '#2563eb' : '#9ca3af',
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: 0,
                          }}
                          title={d.published ? 'Posted (Click to mark unposted)' : 'Not posted (Click to mark posted)'}
                        >
                          {d.published ? <CheckCircle2 size={16} color="#2563eb" /> : <Circle size={16} />}
                        </button>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input
                              type="date"
                              value={d.publishDate || ''}
                              onChange={(e) => handleDateChange(d.id, 'publishDate', e.target.value)}
                              style={{
                                fontSize: '11px',
                                padding: '2px 4px',
                                border: '1px solid #e5e7eb',
                                borderRadius: '4px',
                                background: '#fff',
                                color: d.published ? '#2563eb' : postingOverdue ? '#dc2626' : '#374151',
                                fontWeight: d.publishDate ? 600 : 400,
                                maxWidth: '105px',
                              }}
                              title="Posting / Publish Date"
                            />
                            <input
                              type="time"
                              value={d.publishTime || ''}
                              onChange={(e) => handleTimeChange(d.id, e.target.value)}
                              style={{
                                fontSize: '11px',
                                padding: '2px 4px',
                                border: '1px solid #e5e7eb',
                                borderRadius: '4px',
                                background: '#fff',
                                color: '#374151',
                                maxWidth: '72px',
                              }}
                              title="Posting Time (e.g. 18:00)"
                            />
                          </div>
                          {postingOverdue && (
                            <span style={{ fontSize: '10px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
                              <AlertCircle size={10} /> Overdue post
                            </span>
                          )}
                          {postingToday && !d.published && (
                            <span style={{ fontSize: '10px', color: '#2563eb', fontWeight: 700 }}>
                              Post today{d.publishTime ? ` @ ${d.publishTime}` : ''}!
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Idea / Concept */}
                    <td>
                      <div style={{ fontWeight: 600, color: '#111827', fontSize: '13px' }}>{d.idea}</div>

                      {/* Inline Link Editor or Display */}
                      {editingLinkId === d.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <input
                            type="url"
                            placeholder="Paste Instagram or TikTok link..."
                            value={editingLinkVal}
                            onChange={(e) => setEditingLinkVal(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveLink(d.id, editingLinkVal);
                              if (e.key === 'Escape') setEditingLinkId(null);
                            }}
                            autoFocus
                            style={{
                              fontSize: '11px',
                              padding: '2px 6px',
                              border: '1px solid #2563eb',
                              borderRadius: '4px',
                              width: '210px',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveLink(d.id, editingLinkVal)}
                            style={{
                              border: 'none',
                              background: '#2563eb',
                              color: '#fff',
                              borderRadius: '4px',
                              padding: '2px 5px',
                              cursor: 'pointer',
                            }}
                            title="Save & Sync"
                          >
                            <Check size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingLinkId(null)}
                            style={{
                              border: 'none',
                              background: '#f3f4f6',
                              color: '#6b7280',
                              borderRadius: '4px',
                              padding: '2px 5px',
                              cursor: 'pointer',
                            }}
                            title="Cancel"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ) : d.link ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: '3px', flexWrap: 'wrap' }}>
                          <a
                            href={d.link}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              fontSize: '11px',
                              color: '#4f46e5',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              textDecoration: 'none',
                              fontWeight: 500,
                            }}
                          >
                            <ExternalLink size={10} />
                            View Post
                          </a>

                          <button
                            type="button"
                            onClick={() => handleSyncMetrics(d.id)}
                            disabled={syncingId === d.id}
                            style={{
                              fontSize: '10.5px',
                              fontWeight: 600,
                              color: '#1d4ed8',
                              background: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              borderRadius: '4px',
                              padding: '1.5px 6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              cursor: syncingId === d.id ? 'not-allowed' : 'pointer',
                            }}
                            title="Sync views, likes & comments via Apify"
                          >
                            <RefreshCw size={10} className={syncingId === d.id ? 'animate-spin' : ''} />
                            {syncingId === d.id ? 'Syncing…' : 'Sync stats'}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingLinkId(d.id);
                              setEditingLinkVal(d.link || '');
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              color: '#9ca3af',
                              cursor: 'pointer',
                              display: 'inline-flex',
                            }}
                            title="Edit URL"
                          >
                            <Edit2 size={10} />
                          </button>
                        </div>
                      ) : (
                        <div style={{ marginTop: '3px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingLinkId(d.id);
                              setEditingLinkVal('');
                            }}
                            style={{
                              fontSize: '10.5px',
                              color: '#6b7280',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              padding: 0,
                            }}
                          >
                            <Link2 size={10} />
                            <span>+ Attach live link</span>
                          </button>
                        </div>
                      )}

                      {/* Sync Notification Banner */}
                      {syncNotification && syncNotification.id === d.id && (
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: '10.5px',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: syncNotification.isError ? '#fef2f2' : '#ecfdf5',
                            color: syncNotification.isError ? '#dc2626' : '#059669',
                            border: `1px solid ${syncNotification.isError ? '#fecaca' : '#a7f3d0'}`,
                            maxWidth: '280px',
                          }}
                        >
                          {syncNotification.msg}
                        </div>
                      )}
                    </td>

                    {/* Stage / Status Column */}
                    <td>
                      <select
                        value={d.status || (d.published ? 'published' : d.filmed ? 'filmed' : 'idea')}
                        onChange={(e) => handleStatusChange(d.id, e.target.value as DeliverableStatus)}
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          backgroundColor:
                            d.status === 'published' || d.published
                              ? '#ecfdf5'
                              : d.status === 'filmed' || d.filmed
                              ? '#eff6ff'
                              : d.status === 'editing'
                              ? '#faf5ff'
                              : d.status === 'scheduled'
                              ? '#f0fdf4'
                              : '#f8fafc',
                          color:
                            d.status === 'published' || d.published
                              ? '#047857'
                              : d.status === 'filmed' || d.filmed
                              ? '#1d4ed8'
                              : d.status === 'editing'
                              ? '#7c3aed'
                              : d.status === 'scheduled'
                              ? '#15803d'
                              : '#475569',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="idea">Idea</option>
                        <option value="scripted">Scripted</option>
                        <option value="filmed">Filmed</option>
                        <option value="editing">Editing</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="published">Published</option>
                      </select>
                    </td>

                    {/* Platform & Format */}
                    <td>
                      <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {d.platform && (
                          <span
                            style={{
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              textTransform: 'capitalize',
                              backgroundColor: platformPills[d.platform]?.bg || '#f3f4f6',
                              color: platformPills[d.platform]?.text || '#374151',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            {d.platform === 'instagram' && <InstagramIcon size={12} color="#db2777" />}
                            {d.platform === 'tiktok' && <TikTokIcon size={12} color="#0891b2" />}
                            <span>{d.platform}</span>
                          </span>
                        )}
                        {d.format && (
                          <span
                            style={{
                              padding: '1.5px 7px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              backgroundColor: '#f3f4f6',
                              color: '#6b7280',
                              textTransform: 'capitalize',
                            }}
                          >
                            {d.format}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Talent / Creator */}
                    <td>
                      {d.creatorAssignments && d.creatorAssignments.length > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor: '#f3f4f6',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: '#111827',
                            }}
                          >
                            {d.creatorAssignments[0].creator.name}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '11px' }}>Internal Team</span>
                      )}
                    </td>

                    {/* Results / Metrics */}
                    {viewMode !== 'filming' && (
                      <td>
                        {d.results ? (
                          <div
                            style={{
                              fontSize: '11.5px',
                              color: '#059669',
                              fontWeight: 500,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <BarChart2 size={11} />
                            <span>{d.results}</span>
                          </div>
                        ) : d.latestMetrics ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <div style={{ fontSize: '11px', color: '#1f2937' }}>
                              <span style={{ fontWeight: 600 }}>{d.latestMetrics.views.toLocaleString()}</span> views ·{' '}
                              <span style={{ fontWeight: 600 }}>{d.latestMetrics.likes.toLocaleString()}</span> likes
                              {d.latestMetrics.comments > 0 && (
                                <> · <span>{d.latestMetrics.comments.toLocaleString()}</span> comments</>
                              )}
                            </div>
                            {d.latestMetrics.source === 'api' && (
                              <span
                                style={{
                                  fontSize: '9px',
                                  fontWeight: 700,
                                  color: '#2563eb',
                                  backgroundColor: '#eff6ff',
                                  border: '1px solid #bfdbfe',
                                  borderRadius: '3px',
                                  padding: '1px 4px',
                                }}
                                title="Auto-synced from Apify"
                              >
                                API
                              </span>
                            )}
                            {d.link && (
                              <button
                                type="button"
                                onClick={() => handleSyncMetrics(d.id)}
                                disabled={syncingId === d.id}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  color: '#6b7280',
                                  cursor: syncingId === d.id ? 'not-allowed' : 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                }}
                                title="Refresh latest stats"
                              >
                                <RefreshCw size={10} className={syncingId === d.id ? 'animate-spin' : ''} />
                              </button>
                            )}
                          </div>
                        ) : d.link ? (
                          <button
                            type="button"
                            onClick={() => handleSyncMetrics(d.id)}
                            disabled={syncingId === d.id}
                            style={{
                              fontSize: '10.5px',
                              color: '#2563eb',
                              background: '#eff6ff',
                              border: '1px dashed #93c5fd',
                              borderRadius: '4px',
                              padding: '2px 8px',
                              cursor: syncingId === d.id ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <RefreshCw size={10} className={syncingId === d.id ? 'animate-spin' : ''} />
                            <span>{syncingId === d.id ? 'Fetching…' : 'Fetch Stats'}</span>
                          </button>
                        ) : (
                          <span style={{ color: '#9ca3af', fontSize: '11px' }}>—</span>
                        )}
                      </td>
                    )}

                    {/* Actions */}
                    <td style={{ textAlign: 'right', paddingRight: '16px' }}>
                      <button
                        onClick={() => handleDelete(d.id)}
                        className="btn btn-ghost btn-sm"
                        style={{ color: '#9ca3af', padding: '3px' }}
                        title="Delete deliverable"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { DeliverableData, ClientData, CreatorData, Platform, DeliverableFormat, DeliverableStatus } from '@/types';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Video,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  Filter,
  Search,
  ExternalLink,
  X,
  User,
  Film,
  Sparkles,
  Layers,
  ArrowRight,
  Check,
} from 'lucide-react';
import { InstagramIcon, TikTokIcon } from '@/components/SocialIcons';

interface ContentCalendarProps {
  initialDeliverables: DeliverableData[];
  clients: ClientData[];
  creators: CreatorData[];
  userRole: string;
}

type EventTypeFilter = 'all' | 'filming' | 'posting';
type CalendarView = 'month' | 'week' | 'agenda';

interface CalendarEvent {
  type: 'filming' | 'posting';
  date: string; // YYYY-MM-DD
  deliverable: DeliverableData;
  isCompleted: boolean;
  isOverdue: boolean;
  clientName: string;
}

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function ContentCalendar({
  initialDeliverables,
  clients,
  creators,
  userRole,
}: ContentCalendarProps) {
  const [deliverables, setDeliverables] = useState<DeliverableData[]>(initialDeliverables);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<CalendarView>('month');
  const [eventTypeFilter, setEventTypeFilter] = useState<EventTypeFilter>('all');
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'overdue'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected event for quick edit drawer/modal
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [editFormData, setEditFormData] = useState<{
    filmingDate: string;
    publishDate: string;
    publishTime: string;
    filmed: boolean;
    published: boolean;
    status: DeliverableStatus;
    idea: string;
    platform: Platform;
    format: DeliverableFormat;
    link: string;
    instagramLink: string;
    tiktokLink: string;
  }>({
    filmingDate: '',
    publishDate: '',
    publishTime: '',
    filmed: false,
    published: false,
    status: 'idea',
    idea: '',
    platform: 'instagram',
    format: 'reel',
    link: '',
    instagramLink: '',
    tiktokLink: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // New Deliverable modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    clientId: clients[0]?.id || '',
    idea: '',
    platform: 'both' as Platform,
    format: 'reel' as DeliverableFormat,
    filmingDate: formatDateKey(new Date()),
    publishDate: '',
    publishTime: '',
    creatorId: '',
    filmed: false,
    status: 'idea' as DeliverableStatus,
    link: '',
    instagramLink: '',
    tiktokLink: '',
  });
  const [creating, setCreating] = useState(false);

  const todayStr = useMemo(() => formatDateKey(new Date()), []);

  const clientMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clients) {
      map.set(c.id, c.name);
    }
    return map;
  }, [clients]);

  // Compute all calendar events (both filming and posting)
  const allEvents = useMemo<CalendarEvent[]>(() => {
    const list: CalendarEvent[] = [];

    deliverables.forEach((del) => {
      // Find client name in O(1)
      const clientName = del.clientName || clientMap.get(del.clientId) || 'Client';

      // 1. Filming Event (Shoot)
      if (del.filmingDate) {
        const isCompleted = Boolean(del.filmed);
        const isOverdue = !isCompleted && del.filmingDate < todayStr;
        list.push({
          type: 'filming',
          date: del.filmingDate,
          deliverable: del,
          isCompleted,
          isOverdue,
          clientName,
        });
      }

      // 2. Posting Event (Publish)
      if (del.publishDate) {
        const isCompleted = Boolean(del.published);
        const isOverdue = !isCompleted && del.publishDate < todayStr;
        list.push({
          type: 'posting',
          date: del.publishDate,
          deliverable: del,
          isCompleted,
          isOverdue,
          clientName,
        });
      }
    });

    return list;
  }, [deliverables, clientMap, todayStr]);

  // Filter events according to UI controls
  const filteredEvents = useMemo(() => {
    return allEvents.filter((evt) => {
      // Type filter
      if (eventTypeFilter !== 'all' && evt.type !== eventTypeFilter) return false;

      // Client filter
      if (selectedClientId !== 'all' && evt.deliverable.clientId !== selectedClientId) return false;

      // Status filter
      if (statusFilter === 'pending' && evt.isCompleted) return false;
      if (statusFilter === 'completed' && !evt.isCompleted) return false;
      if (statusFilter === 'overdue' && !evt.isOverdue) return false;

      // Text search
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchTitle = (evt.deliverable.idea || '').toLowerCase().includes(q);
        const matchClient = evt.clientName.toLowerCase().includes(q);
        const matchPlatform =
          (evt.deliverable.platform || '').toLowerCase().includes(q) ||
          (evt.deliverable.platform === 'both' && ('instagram'.includes(q) || 'tiktok'.includes(q)));
        const matchCreator = evt.deliverable.creatorAssignments?.some((ca) =>
          ca.creator.name.toLowerCase().includes(q)
        );
        if (!matchTitle && !matchClient && !matchPlatform && !matchCreator) return false;
      }

      return true;
    });
  }, [allEvents, eventTypeFilter, selectedClientId, statusFilter, searchQuery]);

  // Map events by date key 'YYYY-MM-DD'
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const evt of filteredEvents) {
      const arr = map.get(evt.date) || [];
      arr.push(evt);
      map.set(evt.date, arr);
    }
    return map;
  }, [filteredEvents]);

  // Calendar month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Month grid dates calculation
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Monday-based index: 0 = Mon, ..., 6 = Sun
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const days: Array<{ date: Date; dateStr: string; isCurrentMonth: boolean; isToday: boolean }> = [];

    // Leading days from previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      const str = formatDateKey(d);
      days.push({
        date: d,
        dateStr: str,
        isCurrentMonth: false,
        isToday: str === todayStr,
      });
    }

    // Days of current month
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      const d = new Date(year, month, i);
      const str = formatDateKey(d);
      days.push({
        date: d,
        dateStr: str,
        isCurrentMonth: true,
        isToday: str === todayStr,
      });
    }

    // Trailing days from next month to complete the 7-column grid
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const str = formatDateKey(d);
      days.push({
        date: d,
        dateStr: str,
        isCurrentMonth: false,
        isToday: str === todayStr,
      });
    }

    return days;
  }, [currentDate, todayStr]);

  // Current Week calculation for Week View
  const currentWeekDays = useMemo(() => {
    const d = new Date(currentDate);
    let dayIdx = d.getDay() - 1;
    if (dayIdx === -1) dayIdx = 6;
    const monday = new Date(d);
    monday.setDate(d.getDate() - dayIdx);

    const week: Array<{ date: Date; dateStr: string; isToday: boolean }> = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      const str = formatDateKey(day);
      week.push({
        date: day,
        dateStr: str,
        isToday: str === todayStr,
      });
    }
    return week;
  }, [currentDate, todayStr]);

  // Summary KPIs for current month
  const monthlyStats = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    let filmingCount = 0;
    let filmedCompleted = 0;
    let postingCount = 0;
    let postedCompleted = 0;
    let overdueCount = 0;

    deliverables.forEach((d) => {
      if (d.filmingDate) {
        const fDate = new Date(d.filmingDate);
        if (fDate.getFullYear() === year && fDate.getMonth() === month) {
          filmingCount++;
          if (d.filmed) filmedCompleted++;
          else if (d.filmingDate < todayStr) overdueCount++;
        }
      }
      if (d.publishDate) {
        const pDate = new Date(d.publishDate);
        if (pDate.getFullYear() === year && pDate.getMonth() === month) {
          postingCount++;
          if (d.published) postedCompleted++;
          else if (d.publishDate < todayStr) overdueCount++;
        }
      }
    });

    return {
      filmingCount,
      filmedCompleted,
      filmingPending: filmingCount - filmedCompleted,
      postingCount,
      postedCompleted,
      postingPending: postingCount - postedCompleted,
      overdueCount,
    };
  }, [deliverables, currentDate, todayStr]);

  // Open event editor
  const handleEventClick = (evt: CalendarEvent) => {
    setSelectedEvent(evt);
    const d = evt.deliverable;
    setEditFormData({
      filmingDate: d.filmingDate || '',
      publishDate: d.publishDate || '',
      publishTime: d.publishTime || '',
      filmed: Boolean(d.filmed),
      published: Boolean(d.published),
      status: d.status,
      idea: d.idea || '',
      platform: d.platform || 'instagram',
      format: d.format || 'reel',
      link: d.link || '',
      instagramLink: d.instagramLink || '',
      tiktokLink: d.tiktokLink || '',
    });
  };

  // Open new deliverable modal for a clicked date
  const handleDateClick = (dateStr: string) => {
    setCreateFormData((prev) => ({
      ...prev,
      filmingDate: dateStr,
      publishDate: '',
      publishTime: '',
    }));
    setShowCreateModal(true);
  };

  // Toggle event completion directly from calendar card
  const handleToggleEventCompleted = async (evt: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextCompleted = !evt.isCompleted;
    const field = evt.type === 'filming' ? 'filmed' : 'published';

    // Optimistically update
    setDeliverables((prev) =>
      prev.map((d) => {
        if (d.id !== evt.deliverable.id) return d;
        const updated = { ...d, [field]: nextCompleted };
        if (field === 'filmed') {
          updated.status = nextCompleted ? 'filmed' : (d.status === 'filmed' ? 'idea' : d.status);
        }
        if (field === 'published') {
          updated.status = nextCompleted ? 'published' : (d.status === 'published' ? 'filmed' : d.status);
        }
        return updated;
      })
    );

    try {
      const payload: Record<string, unknown> = { [field]: nextCompleted };
      if (field === 'filmed') {
        payload.status = nextCompleted ? 'filmed' : 'idea';
      }
      if (field === 'published') {
        payload.status = nextCompleted ? 'published' : 'filmed';
      }

      const res = await fetch(`/api/deliverables/${evt.deliverable.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        setDeliverables((prev) =>
          prev.map((d) => (d.id === updated.id ? { ...d, ...updated, clientName: evt.clientName } : d))
        );
      }
    } catch (err) {
      console.error('Failed to toggle completion:', err);
    }
  };

  // Save changes from Edit Modal
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;

    setSavingEdit(true);
    try {
      const isFilmed = editFormData.filmed || editFormData.status === 'filmed';
      const isPublished = editFormData.published || editFormData.status === 'published';

      const payload: Record<string, unknown> = {
        filmingDate: editFormData.filmingDate || (isFilmed ? formatDateKey(new Date()) : null),
        publishDate: editFormData.publishDate || null,
        publishTime: editFormData.publishTime || null,
        filmed: isFilmed,
        published: isPublished,
        status: editFormData.status,
        idea: editFormData.idea.trim(),
        platform: editFormData.platform,
        format: editFormData.format,
        link: editFormData.platform !== 'both' ? editFormData.link : undefined,
        instagramLink: editFormData.instagramLink,
        tiktokLink: editFormData.tiktokLink,
      };

      const res = await fetch(`/api/deliverables/${selectedEvent.deliverable.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update deliverable');
      }

      const updated = await res.json();
      setDeliverables((prev) =>
        prev.map((d) => (d.id === updated.id ? { ...d, ...updated, clientName: selectedEvent.clientName } : d))
      );
      setSelectedEvent(null);
    } catch (err: any) {
      alert(err.message || 'Error updating deliverable');
    } finally {
      setSavingEdit(false);
    }
  };

  // Create new deliverable from Calendar
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFormData.idea.trim() || !createFormData.clientId) return;

    setCreating(true);
    try {
      const isFilmed = createFormData.filmed || createFormData.status === 'filmed';
      const isPublished = createFormData.status === 'published';
      let resolvedStatus = createFormData.status;
      if (isFilmed && (resolvedStatus === 'idea' || resolvedStatus === 'scripted')) {
        resolvedStatus = 'filmed';
      }

      const payload = {
        idea: createFormData.idea.trim(),
        platform: createFormData.platform,
        format: createFormData.format,
        filmingDate: createFormData.filmingDate || (isFilmed ? formatDateKey(new Date()) : null),
        publishDate: createFormData.publishDate || null,
        publishTime: createFormData.publishTime || null,
        creatorId: createFormData.creatorId || undefined,
        filmed: isFilmed,
        published: isPublished,
        status: resolvedStatus,
        link: createFormData.platform !== 'both' ? createFormData.link : undefined,
        instagramLink: createFormData.instagramLink,
        tiktokLink: createFormData.tiktokLink,
      };

      const res = await fetch(`/api/clients/${createFormData.clientId}/deliverables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to schedule content');
      }

      const created = await res.json();
      const client = clients.find((c) => c.id === createFormData.clientId);
      setDeliverables((prev) => [{ ...created, clientName: client?.name || 'Client' }, ...prev]);
      setShowCreateModal(false);
      setCreateFormData({
        clientId: clients[0]?.id || '',
        idea: '',
        platform: 'both',
        format: 'reel',
        filmingDate: formatDateKey(new Date()),
        publishDate: '',
        publishTime: '',
        creatorId: '',
        filmed: false,
        status: 'idea',
        link: '',
        instagramLink: '',
        tiktokLink: '',
      });
    } catch (err: any) {
      alert(err.message || 'Failed to create deliverable');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Header KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px',
        }}
      >
        {/* Filming Shoots KPI */}
        <div
          className="glass-card"
          onClick={() => setEventTypeFilter(eventTypeFilter === 'filming' ? 'all' : 'filming')}
          style={{
            padding: '16px 18px',
            cursor: 'pointer',
            border: eventTypeFilter === 'filming' ? '1.5px solid #6366f1' : '1px solid var(--border-subtle)',
            backgroundColor: eventTypeFilter === 'filming' ? '#f5f3ff' : '#ffffff',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#4338ca', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Video size={13} />
              Filming Shoots (This Month)
            </span>
            <span
              style={{
                fontSize: '11px',
                padding: '2px 7px',
                borderRadius: '10px',
                backgroundColor: '#e0e7ff',
                color: '#3730a3',
                fontWeight: 700,
              }}
            >
              {monthlyStats.filmingCount} total
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>
              {monthlyStats.filmedCompleted}
            </span>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>
              completed • <strong>{monthlyStats.filmingPending}</strong> scheduled
            </span>
          </div>
          {/* Progress bar */}
          <div style={{ width: '100%', height: '5px', backgroundColor: '#e5e7eb', borderRadius: '3px', marginTop: '10px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${monthlyStats.filmingCount > 0 ? (monthlyStats.filmedCompleted / monthlyStats.filmingCount) * 100 : 0}%`,
                backgroundColor: '#6366f1',
                borderRadius: '3px',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        {/* Posting Publications KPI */}
        <div
          className="glass-card"
          onClick={() => setEventTypeFilter(eventTypeFilter === 'posting' ? 'all' : 'posting')}
          style={{
            padding: '16px 18px',
            cursor: 'pointer',
            border: eventTypeFilter === 'posting' ? '1.5px solid #10b981' : '1px solid var(--border-subtle)',
            backgroundColor: eventTypeFilter === 'posting' ? '#ecfdf5' : '#ffffff',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#047857', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Send size={13} />
              Posting Schedule (This Month)
            </span>
            <span
              style={{
                fontSize: '11px',
                padding: '2px 7px',
                borderRadius: '10px',
                backgroundColor: '#d1fae5',
                color: '#065f46',
                fontWeight: 700,
              }}
            >
              {monthlyStats.postingCount} total
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>
              {monthlyStats.postedCompleted}
            </span>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>
              published • <strong>{monthlyStats.postingPending}</strong> to post
            </span>
          </div>
          {/* Progress bar */}
          <div style={{ width: '100%', height: '5px', backgroundColor: '#e5e7eb', borderRadius: '3px', marginTop: '10px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${monthlyStats.postingCount > 0 ? (monthlyStats.postedCompleted / monthlyStats.postingCount) * 100 : 0}%`,
                backgroundColor: '#10b981',
                borderRadius: '3px',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        {/* Attention / Overdue KPI */}
        <div
          className="glass-card"
          onClick={() => setStatusFilter(statusFilter === 'overdue' ? 'all' : 'overdue')}
          style={{
            padding: '16px 18px',
            cursor: 'pointer',
            border: statusFilter === 'overdue' ? '1.5px solid #f43f5e' : '1px solid var(--border-subtle)',
            backgroundColor: statusFilter === 'overdue' ? '#fff1f2' : '#ffffff',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#be123c', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <AlertCircle size={13} />
              Needs Attention
            </span>
            {monthlyStats.overdueCount > 0 && (
              <span style={{ fontSize: '10.5px', padding: '2px 7px', borderRadius: '10px', backgroundColor: '#ffe4e6', color: '#be123c', fontWeight: 700 }}>
                Action needed
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '22px', fontWeight: 800, color: monthlyStats.overdueCount > 0 ? '#e11d48' : '#111827' }}>
              {monthlyStats.overdueCount}
            </span>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>
              overdue shoot or publish dates
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '10px' }}>
            {monthlyStats.overdueCount === 0 ? '✓ Everything is on schedule' : 'Click to filter overdue content'}
          </div>
        </div>
      </div>

      {/* 2. Control Toolbar */}
      <div
        className="glass-card"
        style={{
          padding: '14px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        {/* Left: Month Navigator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 'var(--radius-md)', padding: '2px' }}>
            <button
              onClick={prevMonth}
              className="btn btn-ghost btn-sm"
              style={{ padding: '6px 8px', borderRadius: 'var(--radius-sm)' }}
              title="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={goToToday}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '12px', fontWeight: 600, padding: '4px 10px' }}
            >
              Today
            </button>
            <button
              onClick={nextMonth}
              className="btn btn-ghost btn-sm"
              style={{ padding: '6px 8px', borderRadius: 'var(--radius-sm)' }}
              title="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>
            {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
        </div>

        {/* Center: Event Type Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setEventTypeFilter('all')}
            className={`btn btn-sm ${eventTypeFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '12px' }}
          >
            All Milestones
          </button>
          <button
            type="button"
            onClick={() => setEventTypeFilter('filming')}
            className={`btn btn-sm ${eventTypeFilter === 'filming' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              fontSize: '12px',
              backgroundColor: eventTypeFilter === 'filming' ? '#4f46e5' : undefined,
              borderColor: eventTypeFilter === 'filming' ? '#4f46e5' : undefined,
            }}
          >
            <Video size={13} />
            Shoots Only
          </button>
          <button
            type="button"
            onClick={() => setEventTypeFilter('posting')}
            className={`btn btn-sm ${eventTypeFilter === 'posting' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              fontSize: '12px',
              backgroundColor: eventTypeFilter === 'posting' ? '#059669' : undefined,
              borderColor: eventTypeFilter === 'posting' ? '#059669' : undefined,
            }}
          >
            <Send size={13} />
            Posts Only
          </button>
        </div>

        {/* Right: Client Selector, Search, View Mode & Add Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Client Filter */}
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="input-field"
            style={{ flex: '1 1 140px', minWidth: '130px', padding: '6px 10px', fontSize: '12px' }}
          >
            <option value="all">All Clients ({clients.length})</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* View mode switcher */}
          <div style={{ display: 'flex', backgroundColor: '#f3f4f6', borderRadius: 'var(--radius-md)', padding: '2px' }}>
            <button
              onClick={() => setViewMode('month')}
              className={`btn btn-sm ${viewMode === 'month' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '11.5px', padding: '5px 9px' }}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`btn btn-sm ${viewMode === 'week' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '11.5px', padding: '5px 9px' }}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('agenda')}
              className={`btn btn-sm ${viewMode === 'agenda' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '11.5px', padding: '5px 9px' }}
            >
              Agenda
            </button>
          </div>

          {/* "+ Schedule" Button */}
          <button
            onClick={() => {
              setCreateFormData((prev) => ({
                ...prev,
                filmingDate: todayStr,
                publishDate: '',
              }));
              setShowCreateModal(true);
            }}
            className="btn btn-primary btn-sm"
            style={{ fontSize: '12px' }}
          >
            <Plus size={14} />
            Schedule
          </button>
        </div>
      </div>

      {/* 3. CALENDAR VIEW BODY */}

      {/* A. MONTH VIEW */}
      {viewMode === 'month' && (
        <div
          className="glass-card table-responsive-wrapper"
          style={{
            padding: '14px',
          }}
        >
          {/* Day Headers (Mon - Sun) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(135px, 1fr))',
              gap: '6px',
              marginBottom: '6px',
            }}
          >
            {DAYS_OF_WEEK.map((dayName, idx) => (
              <div
                key={dayName}
                style={{
                  padding: '8px 6px',
                  textAlign: 'center',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  color: idx >= 5 ? '#9ca3af' : '#4b5563',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                {dayName}
              </div>
            ))}
          </div>

          {/* Month Days Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(135px, 1fr))',
              gap: '6px',
            }}
          >
            {calendarDays.map((dayObj) => {
              const dayEvents = eventsByDate.get(dayObj.dateStr) || [];
              const isToday = dayObj.isToday;

              return (
                <div
                  key={dayObj.dateStr}
                  style={{
                    minHeight: '115px',
                    borderRadius: 'var(--radius-md)',
                    border: isToday
                      ? '1.5px solid #6366f1'
                      : dayObj.isCurrentMonth
                      ? '1px solid #eaedf0'
                      : '1px dashed #f1f3f5',
                    backgroundColor: isToday
                      ? '#f8f9ff'
                      : dayObj.isCurrentMonth
                      ? '#ffffff'
                      : '#fafafa',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '5px',
                    opacity: dayObj.isCurrentMonth ? 1 : 0.45,
                    transition: 'border 0.15s ease, background-color 0.15s ease',
                    position: 'relative',
                  }}
                >
                  {/* Day Header: Number + Add Button */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '2px',
                    }}
                  >
                    <span
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: isToday ? 800 : 600,
                        backgroundColor: isToday ? '#6366f1' : 'transparent',
                        color: isToday ? '#ffffff' : '#111827',
                      }}
                    >
                      {dayObj.date.getDate()}
                    </span>

                    {/* Quick Add Button */}
                    <button
                      onClick={() => handleDateClick(dayObj.dateStr)}
                      className="btn btn-ghost btn-sm"
                      style={{
                        padding: '2px 4px',
                        height: '20px',
                        color: '#9ca3af',
                        opacity: 0.6,
                      }}
                      title={`Schedule on ${dayObj.dateStr}`}
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  {/* Day Events Stack */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                    {dayEvents.map((evt, idx) => {
                      const isFilming = evt.type === 'filming';
                      const badgeBg = isFilming
                        ? evt.isCompleted
                          ? '#eff6ff'
                          : evt.isOverdue
                          ? '#fff1f2'
                          : '#f5f3ff'
                        : evt.isCompleted
                        ? '#ecfdf5'
                        : evt.isOverdue
                        ? '#fff1f2'
                        : '#f0fdf4';

                      const badgeText = isFilming
                        ? evt.isCompleted
                          ? '#1d4ed8'
                          : evt.isOverdue
                          ? '#be123c'
                          : '#4338ca'
                        : evt.isCompleted
                        ? '#047857'
                        : evt.isOverdue
                        ? '#be123c'
                        : '#15803d';

                      const badgeBorder = isFilming
                        ? evt.isCompleted
                          ? '#bfdbfe'
                          : evt.isOverdue
                          ? '#fecdd3'
                          : '#ddd6fe'
                        : evt.isCompleted
                        ? '#a7f3d0'
                        : evt.isOverdue
                        ? '#fecdd3'
                        : '#bbf7d0';

                      return (
                        <div
                          key={`${evt.deliverable.id}-${evt.type}-${idx}`}
                          onClick={() => handleEventClick(evt)}
                          style={{
                            padding: '4px 6px',
                            borderRadius: '4px',
                            backgroundColor: badgeBg,
                            border: `1px solid ${badgeBorder}`,
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                            transition: 'transform 0.1s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
                          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                        >
                          {/* Event Type & Client Name */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '9.5px',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                color: badgeText,
                              }}
                            >
                              {isFilming ? <Video size={10} /> : <Send size={10} />}
                              {isFilming
                                ? 'Shoot'
                                : evt.deliverable.publishTime
                                ? `Post • ${evt.deliverable.publishTime}`
                                : 'Post'}
                            </span>

                            <button
                              type="button"
                              onClick={(e) => handleToggleEventCompleted(evt, e)}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                              }}
                              title={evt.isCompleted ? 'Completed (Click to uncomplete)' : 'Pending (Click to mark completed)'}
                            >
                              {evt.isCompleted ? (
                                <span title="Completed" style={{ color: isFilming ? '#2563eb' : '#059669' }}>
                                  <Check size={11} strokeWidth={3} />
                                </span>
                              ) : evt.isOverdue ? (
                                <span
                                  title="Overdue!"
                                  style={{
                                    fontSize: '8.5px',
                                    fontWeight: 800,
                                    color: '#e11d48',
                                    backgroundColor: '#ffe4e6',
                                    padding: '1px 3px',
                                    borderRadius: '3px',
                                  }}
                                >
                                  OVERDUE
                                </span>
                              ) : (
                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', border: '1px solid #cbd5e1', display: 'inline-block' }} />
                              )}
                            </button>
                          </div>

                          {/* Client Name & Platform Badges */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                            <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {evt.clientName}
                            </span>
                            {evt.deliverable.platform === 'both' || (evt.deliverable.instagramLink && evt.deliverable.tiktokLink) ? (
                              <div style={{ display: 'inline-flex', gap: '2px', flexShrink: 0 }}>
                                <span style={{ fontSize: '8px', fontWeight: 800, color: '#db2777', backgroundColor: '#fdf2f8', padding: '1px 3px', borderRadius: '2px', lineHeight: 1 }}>IG</span>
                                <span style={{ fontSize: '8px', fontWeight: 800, color: '#0891b2', backgroundColor: '#ecfeff', padding: '1px 3px', borderRadius: '2px', lineHeight: 1 }}>TT</span>
                              </div>
                            ) : evt.deliverable.platform ? (
                              <span style={{ fontSize: '8px', fontWeight: 700, color: evt.deliverable.platform === 'instagram' ? '#db2777' : evt.deliverable.platform === 'tiktok' ? '#0891b2' : '#6b7280', textTransform: 'uppercase', flexShrink: 0 }}>
                                {evt.deliverable.platform === 'instagram' ? 'IG' : evt.deliverable.platform === 'tiktok' ? 'TT' : evt.deliverable.platform.slice(0, 2)}
                              </span>
                            ) : null}
                          </div>

                          {/* Deliverable Idea */}
                          <div
                            style={{
                              fontSize: '10px',
                              color: '#4b5563',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {evt.deliverable.idea}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* B. WEEK VIEW */}
      {viewMode === 'week' && (
        <div
          className="glass-card table-responsive-wrapper"
          style={{
            padding: '14px',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(180px, 1fr))',
              gap: '12px',
            }}
          >
            {currentWeekDays.map((dayObj) => {
              const dayEvents = eventsByDate.get(dayObj.dateStr) || [];
              const isToday = dayObj.isToday;

              return (
                <div
                  key={dayObj.dateStr}
                  style={{
                    backgroundColor: isToday ? '#f9fafb' : '#ffffff',
                    border: isToday ? '2px solid #6366f1' : '1px solid #eaedf0',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px',
                    minHeight: '340px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  {/* Column Header */}
                  <div style={{ borderBottom: '1px solid #eaedf0', paddingBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>
                        {DAYS_OF_WEEK[dayObj.date.getDay() === 0 ? 6 : dayObj.date.getDay() - 1]}
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: isToday ? '#6366f1' : '#111827' }}>
                        {dayObj.date.getDate()} {MONTH_NAMES[dayObj.date.getMonth()].slice(0, 3)}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDateClick(dayObj.dateStr)}
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '4px' }}
                      title="Add content on this day"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  {/* Day Events Stack */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                    {dayEvents.length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '11.5px', marginTop: '30px' }}>
                        No events
                      </div>
                    ) : (
                      dayEvents.map((evt, idx) => (
                        <div
                          key={`${evt.deliverable.id}-${evt.type}-${idx}`}
                          onClick={() => handleEventClick(evt)}
                          style={{
                            padding: '10px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: evt.type === 'filming' ? '#f5f3ff' : '#f0fdf4',
                            border: `1px solid ${evt.type === 'filming' ? '#ddd6fe' : '#bbf7d0'}`,
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                color: evt.type === 'filming' ? '#4338ca' : '#15803d',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                            >
                              {evt.type === 'filming' ? <Video size={11} /> : <Send size={11} />}
                              {evt.type === 'filming'
                                ? 'Filming Shoot'
                                : evt.deliverable.publishTime
                                ? `Post • ${evt.deliverable.publishTime}`
                                : 'Content Post'}
                            </span>
                            {evt.isCompleted && (
                              <span style={{ fontSize: '10px', color: '#059669', fontWeight: 700 }}>Done ✓</span>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>
                              {evt.clientName}
                            </div>
                            {evt.deliverable.platform === 'both' || (evt.deliverable.instagramLink && evt.deliverable.tiktokLink) ? (
                              <div style={{ display: 'inline-flex', gap: '3px' }}>
                                <span style={{ fontSize: '9px', fontWeight: 800, color: '#db2777', backgroundColor: '#fdf2f8', padding: '1px 4px', borderRadius: '3px', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                  <InstagramIcon size={9} color="#db2777" /> IG
                                </span>
                                <span style={{ fontSize: '9px', fontWeight: 800, color: '#0891b2', backgroundColor: '#ecfeff', padding: '1px 4px', borderRadius: '3px', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                  <TikTokIcon size={9} color="#0891b2" /> TT
                                </span>
                              </div>
                            ) : evt.deliverable.platform ? (
                              <span style={{ fontSize: '9.5px', fontWeight: 700, color: evt.deliverable.platform === 'instagram' ? '#db2777' : evt.deliverable.platform === 'tiktok' ? '#0891b2' : '#6b7280', textTransform: 'capitalize' }}>
                                {evt.deliverable.platform}
                              </span>
                            ) : null}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#4b5563' }}>
                            {evt.deliverable.idea}
                          </div>

                          {evt.deliverable.creatorAssignments && evt.deliverable.creatorAssignments[0] && (
                            <div style={{ fontSize: '10.5px', color: '#6366f1', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                              <User size={10} />
                              {evt.deliverable.creatorAssignments[0].creator.name}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* C. AGENDA / SCHEDULE VIEW */}
      {viewMode === 'agenda' && (
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {filteredEvents.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af' }}>
                No events match the selected criteria.
              </div>
            ) : (
              [...filteredEvents]
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((evt, idx) => {
                  const isFilming = evt.type === 'filming';
                  const isPastDate = evt.date < todayStr;
                  const isTodayDate = evt.date === todayStr;

                  return (
                    <div
                      key={`${evt.deliverable.id}-${evt.type}-${idx}`}
                      onClick={() => handleEventClick(evt)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: isTodayDate ? '#fdf4ff' : '#ffffff',
                        border: isTodayDate
                          ? '1.5px solid #c084fc'
                          : '1px solid #eaedf0',
                        cursor: 'pointer',
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isTodayDate ? '#fdf4ff' : '#ffffff')}
                    >
                      {/* Left: Date + Event Type Badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: '220px' }}>
                        <div style={{ minWidth: '95px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: '#111827' }}>
                            {evt.date}
                          </div>
                          <div style={{ fontSize: '11px', color: isTodayDate ? '#9333ea' : '#9ca3af', fontWeight: 600 }}>
                            {isTodayDate ? 'Today!' : isPastDate ? 'Past' : 'Upcoming'}
                          </div>
                        </div>

                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 9px',
                            borderRadius: '5px',
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            backgroundColor: isFilming ? '#e0e7ff' : '#d1fae5',
                            color: isFilming ? '#3730a3' : '#065f46',
                          }}
                        >
                          {isFilming ? <Video size={11} /> : <Send size={11} />}
                          {isFilming
                            ? 'Filming Shoot'
                            : evt.deliverable.publishTime
                            ? `Post • ${evt.deliverable.publishTime}`
                            : 'Post Publish'}
                        </span>
                      </div>

                      {/* Middle: Client + Concept */}
                      <div style={{ flex: 1, padding: '0 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                            {evt.clientName}
                          </span>
                          {evt.deliverable.platform === 'both' || (evt.deliverable.instagramLink && evt.deliverable.tiktokLink) ? (
                            <div style={{ display: 'inline-flex', gap: '4px' }}>
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: '#fdf2f8',
                                  color: '#be185d',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                }}
                              >
                                <InstagramIcon size={10} color="#be185d" /> Instagram
                              </span>
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: '#f3f4f6',
                                  color: '#111827',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                }}
                              >
                                <TikTokIcon size={10} color="#111827" /> TikTok
                              </span>
                            </div>
                          ) : evt.deliverable.platform ? (
                            <span
                              style={{
                                fontSize: '10.5px',
                                textTransform: 'capitalize',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: evt.deliverable.platform === 'instagram' ? '#fdf2f8' : evt.deliverable.platform === 'tiktok' ? '#f3f4f6' : '#f3f4f6',
                                color: evt.deliverable.platform === 'instagram' ? '#be185d' : evt.deliverable.platform === 'tiktok' ? '#111827' : '#4b5563',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                fontWeight: 600,
                              }}
                            >
                              {evt.deliverable.platform === 'instagram' && <InstagramIcon size={10} color="#be185d" />}
                              {evt.deliverable.platform === 'tiktok' && <TikTokIcon size={10} color="#111827" />}
                              {evt.deliverable.platform}
                            </span>
                          ) : null}
                        </div>
                        <div style={{ fontSize: '12px', color: '#4b5563', marginTop: '2px' }}>
                          {evt.deliverable.idea}
                        </div>
                      </div>

                      {/* Right: Status / Overdue Badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button
                          type="button"
                          onClick={(e) => handleToggleEventCompleted(evt, e)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                          }}
                          title={evt.isCompleted ? 'Completed (Click to unmark)' : 'Pending (Click to mark complete)'}
                        >
                          {evt.isCompleted ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11.5px',
                                color: '#059669',
                                fontWeight: 700,
                                backgroundColor: '#ecfdf5',
                                padding: '3px 8px',
                                borderRadius: '4px',
                              }}
                            >
                              <CheckCircle2 size={13} />
                              Completed
                            </span>
                          ) : evt.isOverdue ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11.5px',
                                color: '#e11d48',
                                fontWeight: 700,
                                backgroundColor: '#ffe4e6',
                                padding: '3px 8px',
                                borderRadius: '4px',
                              }}
                            >
                              <AlertCircle size={13} />
                              Overdue
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11.5px',
                                color: '#4b5563',
                                fontWeight: 600,
                                backgroundColor: '#f3f4f6',
                                padding: '3px 8px',
                                borderRadius: '4px',
                              }}
                            >
                              <Clock size={13} />
                              Pending
                            </span>
                          )}
                        </button>

                        <span style={{ fontSize: '12px', color: '#9ca3af' }}>➔</span>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}

      {/* 4. EVENT DETAIL & RESCHEDULE MODAL */}
      {selectedEvent && (
        <div className="modal-overlay">
          <div className="modal-container" style={{ maxWidth: '520px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    backgroundColor: selectedEvent.type === 'filming' ? '#e0e7ff' : '#d1fae5',
                    color: selectedEvent.type === 'filming' ? '#3730a3' : '#065f46',
                  }}
                >
                  {selectedEvent.type === 'filming' ? <Video size={11} /> : <Send size={11} />}
                  {selectedEvent.type === 'filming' ? 'Filming Shoot' : 'Post Publication'}
                </span>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginTop: '6px' }}>
                  {selectedEvent.clientName}
                </h3>
              </div>

              <button onClick={() => setSelectedEvent(null)} className="btn btn-ghost btn-sm" style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Deliverable Idea */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '4px' }}>
                  Concept / Title
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.idea}
                  onChange={(e) => setEditFormData({ ...editFormData, idea: e.target.value })}
                  className="input-field"
                />
              </div>

              {/* Platform & Format */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '4px' }}>
                    Platform
                  </label>
                  <select
                    value={editFormData.platform}
                    onChange={(e) => setEditFormData({ ...editFormData, platform: e.target.value as Platform })}
                    className="input-field"
                  >
                    <option value="both">Instagram & TikTok (Both)</option>
                    <option value="instagram">Instagram</option>
                    <option value="tiktok">TikTok</option>
                    <option value="facebook">Facebook</option>
                    <option value="youtube">YouTube</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '4px' }}>
                    Format
                  </label>
                  <select
                    value={editFormData.format}
                    onChange={(e) => setEditFormData({ ...editFormData, format: e.target.value as DeliverableFormat })}
                    className="input-field"
                  >
                    <option value="reel">Reel / Short</option>
                    <option value="photo">Single Photo</option>
                    <option value="carousel">Carousel (10 slides)</option>
                    <option value="story">Story Sequence</option>
                  </select>
                </div>
              </div>

              {/* Live Post URL(s) based on Platform */}
              {editFormData.platform === 'both' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#db2777', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                      <InstagramIcon size={12} color="#db2777" /> Instagram URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://instagram.com/reel/..."
                      value={editFormData.instagramLink}
                      onChange={(e) => setEditFormData({ ...editFormData, instagramLink: e.target.value })}
                      className="input-field"
                      style={{ fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#0891b2', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                      <TikTokIcon size={12} color="#0891b2" /> TikTok URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://tiktok.com/@.../video/..."
                      value={editFormData.tiktokLink}
                      onChange={(e) => setEditFormData({ ...editFormData, tiktokLink: e.target.value })}
                      className="input-field"
                      style={{ fontSize: '12px' }}
                    />
                  </div>
                </div>
              ) : editFormData.platform === 'instagram' ? (
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#db2777', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                    <InstagramIcon size={12} color="#db2777" /> Instagram URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://instagram.com/reel/..."
                    value={editFormData.instagramLink || editFormData.link}
                    onChange={(e) => setEditFormData({ ...editFormData, instagramLink: e.target.value, link: e.target.value })}
                    className="input-field"
                  />
                </div>
              ) : editFormData.platform === 'tiktok' ? (
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#0891b2', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                    <TikTokIcon size={12} color="#0891b2" /> TikTok URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://tiktok.com/@.../video/..."
                    value={editFormData.tiktokLink || editFormData.link}
                    onChange={(e) => setEditFormData({ ...editFormData, tiktokLink: e.target.value, link: e.target.value })}
                    className="input-field"
                  />
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '4px' }}>
                    Live Post URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={editFormData.link}
                    onChange={(e) => setEditFormData({ ...editFormData, link: e.target.value })}
                    className="input-field"
                  />
                </div>
              )}

              {/* Two Date Inputs: Filming Date & Posting Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ backgroundColor: '#eff6ff', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid #bfdbfe' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
                    <Video size={12} />
                    Filming Date (Shoot)
                  </label>
                  <input
                    type="date"
                    value={editFormData.filmingDate}
                    onChange={(e) => setEditFormData({ ...editFormData, filmingDate: e.target.value })}
                    className="input-field"
                    style={{ backgroundColor: '#ffffff' }}
                  />

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                    <input
                      type="checkbox"
                      id="modal-filmed-check"
                      checked={editFormData.filmed}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setEditFormData({
                          ...editFormData,
                          filmed: checked,
                          status: checked && (editFormData.status === 'idea' || editFormData.status === 'scripted') ? 'filmed' : (!checked && editFormData.status === 'filmed' ? 'idea' : editFormData.status),
                          filmingDate: checked && !editFormData.filmingDate ? formatDateKey(new Date()) : editFormData.filmingDate,
                        });
                      }}
                      style={{ accentColor: '#2563eb' }}
                    />
                    <label htmlFor="modal-filmed-check" style={{ fontSize: '11.5px', color: '#1e3a8a', cursor: 'pointer', fontWeight: 600 }}>
                      Filmed / Production Complete
                    </label>
                  </div>
                </div>

                <div style={{ backgroundColor: '#ecfdf5', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid #a7f3d0' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#047857', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
                    <Send size={12} />
                    Posting Date & Time
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '6px' }}>
                    <input
                      type="date"
                      value={editFormData.publishDate}
                      onChange={(e) => setEditFormData({ ...editFormData, publishDate: e.target.value })}
                      className="input-field"
                      style={{ backgroundColor: '#ffffff' }}
                      title="Posting Date"
                    />
                    <input
                      type="time"
                      value={editFormData.publishTime}
                      onChange={(e) => setEditFormData({ ...editFormData, publishTime: e.target.value })}
                      className="input-field"
                      style={{ backgroundColor: '#ffffff' }}
                      title="Posting Time"
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                    <input
                      type="checkbox"
                      id="modal-published-check"
                      checked={editFormData.published}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setEditFormData({
                          ...editFormData,
                          published: checked,
                          status: checked ? 'published' : (editFormData.status === 'published' ? (editFormData.filmed ? 'filmed' : 'idea') : editFormData.status),
                          publishDate: checked && !editFormData.publishDate ? formatDateKey(new Date()) : editFormData.publishDate,
                        });
                      }}
                      style={{ accentColor: '#059669' }}
                    />
                    <label htmlFor="modal-published-check" style={{ fontSize: '11.5px', color: '#064e3b', cursor: 'pointer', fontWeight: 600 }}>
                      Published / Distributed
                    </label>
                  </div>
                </div>
              </div>

              {/* Status Selector */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '4px' }}>
                  Workflow Status
                </label>
                <select
                  value={editFormData.status}
                  onChange={(e) => {
                    const s = e.target.value as DeliverableStatus;
                    const isFilmed = s === 'filmed' || s === 'editing' || s === 'scheduled' || s === 'published' || editFormData.filmed;
                    const isPublished = s === 'published';
                    setEditFormData({
                      ...editFormData,
                      status: s,
                      filmed: isFilmed,
                      published: isPublished,
                      filmingDate: s === 'filmed' && !editFormData.filmingDate ? formatDateKey(new Date()) : editFormData.filmingDate,
                    });
                  }}
                  className="input-field"
                >
                  <option value="idea">Idea Stage</option>
                  <option value="scripted">Scripted / Pre-production</option>
                  <option value="filmed">Filmed</option>
                  <option value="editing">Editing / Post-production</option>
                  <option value="scheduled">Scheduled for Publish</option>
                  <option value="published">Published</option>
                </select>
              </div>

              {/* Creator Assignments Info if present */}
              {selectedEvent.deliverable.creatorAssignments && selectedEvent.deliverable.creatorAssignments.length > 0 && (
                <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', backgroundColor: '#f9fafb', fontSize: '12px', color: '#4b5563' }}>
                  Assigned Talent: <strong>{selectedEvent.deliverable.creatorAssignments.map((ca) => ca.creator.name).join(', ')}</strong>
                </div>
              )}

              {/* Modal Actions */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                <Link
                  href={`/clients/${selectedEvent.deliverable.clientId}`}
                  className="btn btn-ghost btn-sm"
                  style={{ color: '#6366f1', gap: '4px' }}
                >
                  Open Client Workspace <ExternalLink size={12} />
                </Link>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" onClick={() => setSelectedEvent(null)} className="btn btn-secondary btn-sm">
                    Cancel
                  </button>
                  <button type="submit" disabled={savingEdit} className="btn btn-primary btn-sm">
                    {savingEdit ? 'Saving...' : 'Save Schedule'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. SCHEDULE NEW CONTENT MODAL */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-container" style={{ maxWidth: '520px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>
                Schedule New Content
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="btn btn-ghost btn-sm" style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Client Selection */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '4px' }}>
                  Select Client *
                </label>
                <select
                  required
                  value={createFormData.clientId}
                  onChange={(e) => setCreateFormData({ ...createFormData, clientId: e.target.value })}
                  className="input-field"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Concept / Idea */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '4px' }}>
                  Content Concept / Title *
                </label>
                <input
                  type="text"
                  required
                  value={createFormData.idea}
                  onChange={(e) => setCreateFormData({ ...createFormData, idea: e.target.value })}
                  placeholder="e.g. Behind-the-scenes founder interview"
                  className="input-field"
                />
              </div>

              {/* Platform & Format */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '4px' }}>
                    Platform
                  </label>
                  <select
                    value={createFormData.platform}
                    onChange={(e) => setCreateFormData({ ...createFormData, platform: e.target.value as Platform })}
                    className="input-field"
                  >
                    <option value="both">Instagram & TikTok (Both)</option>
                    <option value="instagram">Instagram</option>
                    <option value="tiktok">TikTok</option>
                    <option value="facebook">Facebook</option>
                    <option value="youtube">YouTube</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '4px' }}>
                    Format
                  </label>
                  <select
                    value={createFormData.format}
                    onChange={(e) => setCreateFormData({ ...createFormData, format: e.target.value as DeliverableFormat })}
                    className="input-field"
                  >
                    <option value="reel">Reel / Short</option>
                    <option value="photo">Single Photo</option>
                    <option value="carousel">Carousel (10 slides)</option>
                    <option value="story">Story Sequence</option>
                  </select>
                </div>
              </div>

              {/* Live Post URL(s) based on Platform */}
              {createFormData.platform === 'both' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#db2777', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                      <InstagramIcon size={12} color="#db2777" /> Instagram URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://instagram.com/reel/..."
                      value={createFormData.instagramLink}
                      onChange={(e) => setCreateFormData({ ...createFormData, instagramLink: e.target.value })}
                      className="input-field"
                      style={{ fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#0891b2', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                      <TikTokIcon size={12} color="#0891b2" /> TikTok URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://tiktok.com/@.../video/..."
                      value={createFormData.tiktokLink}
                      onChange={(e) => setCreateFormData({ ...createFormData, tiktokLink: e.target.value })}
                      className="input-field"
                      style={{ fontSize: '12px' }}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#4b5563', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                    {createFormData.platform === 'instagram' && <InstagramIcon size={12} color="#db2777" />}
                    {createFormData.platform === 'tiktok' && <TikTokIcon size={12} color="#0891b2" />}
                    Live Post URL (Optional)
                  </label>
                  <input
                    type="url"
                    placeholder={
                      createFormData.platform === 'instagram'
                        ? 'https://instagram.com/reel/...'
                        : createFormData.platform === 'tiktok'
                        ? 'https://tiktok.com/@.../video/...'
                        : 'https://...'
                    }
                    value={createFormData.link || (createFormData.platform === 'instagram' ? createFormData.instagramLink : createFormData.tiktokLink)}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCreateFormData({
                        ...createFormData,
                        link: val,
                        instagramLink: createFormData.platform === 'instagram' ? val : createFormData.instagramLink,
                        tiktokLink: createFormData.platform === 'tiktok' ? val : createFormData.tiktokLink,
                      });
                    }}
                    className="input-field"
                  />
                </div>
              )}

              {/* Dates: Filming, Posting & Time */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.85fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                    <Video size={12} />
                    Filming Date
                  </label>
                  <input
                    type="date"
                    value={createFormData.filmingDate}
                    onChange={(e) => setCreateFormData({ ...createFormData, filmingDate: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#047857', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                    <Send size={12} />
                    Posting Date
                  </label>
                  <input
                    type="date"
                    value={createFormData.publishDate}
                    onChange={(e) => setCreateFormData({ ...createFormData, publishDate: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#047857', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                    <Clock size={12} />
                    Posting Time
                  </label>
                  <input
                    type="time"
                    value={createFormData.publishTime}
                    onChange={(e) => setCreateFormData({ ...createFormData, publishTime: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              {/* Assign Partner / Talent */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '4px' }}>
                  Assign Partner / Creator (Optional)
                </label>
                <select
                  value={createFormData.creatorId}
                  onChange={(e) => setCreateFormData({ ...createFormData, creatorId: e.target.value })}
                  className="input-field"
                >
                  <option value="">No creator assigned yet</option>
                  {creators.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Workflow Stage & Filmed Checkbox */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: '#f8fafc',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid #e2e8f0',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '4px' }}>
                    Workflow Stage
                  </label>
                  <select
                    value={createFormData.status}
                    onChange={(e) => {
                      const s = e.target.value as DeliverableStatus;
                      setCreateFormData({
                        ...createFormData,
                        status: s,
                        filmed: s === 'filmed' || s === 'editing' || s === 'scheduled' || s === 'published' ? true : createFormData.filmed,
                      });
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
                    color: createFormData.filmed ? '#1d4ed8' : '#475569',
                    backgroundColor: createFormData.filmed ? '#eff6ff' : '#ffffff',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: createFormData.filmed ? '1px solid #93c5fd' : '1px solid #cbd5e1',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={createFormData.filmed}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setCreateFormData({
                        ...createFormData,
                        filmed: checked,
                        status: checked && (createFormData.status === 'idea' || createFormData.status === 'scripted') ? 'filmed' : (!checked && createFormData.status === 'filmed' ? 'idea' : createFormData.status),
                      });
                    }}
                    style={{ accentColor: '#2563eb', width: '15px', height: '15px' }}
                  />
                  <span>Shoot Completed / Filmed</span>
                </label>
              </div>

              {/* Modal buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="btn btn-primary btn-sm">
                  {creating ? 'Scheduling...' : 'Schedule Deliverable'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

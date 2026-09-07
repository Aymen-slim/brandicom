'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { DeliverableData, UserSummary } from '@/types';
import {
  Bell,
  Clock,
  Send,
  AlertCircle,
  CheckCircle2,
  Calendar,
  X,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface AdminPostingNotifierProps {
  user?: UserSummary | null;
}

interface AlertData {
  todayPosts: DeliverableData[];
  overduePosts: DeliverableData[];
  todayShoots: DeliverableData[];
  upcomingPosts: DeliverableData[];
  unreadCount: number;
}

export function AdminPostingNotifier({ user }: AdminPostingNotifierProps) {
  const isAdmin = user?.role === 'admin';
  const [data, setData] = useState<AlertData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showBriefingModal, setShowBriefingModal] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchAlerts = async () => {
    if (!isAdmin) return;
    try {
      setLoading(true);
      const res = await fetch('/api/notifications/posting-alerts');
      if (res.ok) {
        const json: AlertData = await res.json();
        setData(json);

        // Check if briefing should be shown "first thing" when on site
        const todayStr = new Date().toISOString().split('T')[0];
        const sessionKey = `admin_briefing_seen_${todayStr}`;
        const hasSeenSession = sessionStorage.getItem(sessionKey);

        const totalUrgent = (json.todayPosts?.length || 0) + (json.overduePosts?.length || 0);

        if (!hasSeenSession && totalUrgent > 0) {
          setShowBriefingModal(true);
          sessionStorage.setItem(sessionKey, 'true');
        }
      }
    } catch (err) {
      console.error('Failed to fetch posting alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();

    // Close dropdown on outside click
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAdmin]);

  const handleMarkPublished = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPublishingId(id);
    try {
      const res = await fetch(`/api/deliverables/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: true, status: 'published' }),
      });
      if (res.ok) {
        // Optimistically remove from todayPosts and overduePosts
        setData((prev) => {
          if (!prev) return prev;
          const todayFiltered = prev.todayPosts.filter((d) => d.id !== id);
          const overdueFiltered = prev.overduePosts.filter((d) => d.id !== id);
          return {
            ...prev,
            todayPosts: todayFiltered,
            overduePosts: overdueFiltered,
            unreadCount: Math.max(0, prev.unreadCount - 1),
          };
        });
      }
    } catch (err) {
      console.error('Error marking published:', err);
    } finally {
      setPublishingId(null);
    }
  };

  if (!isAdmin || !data) return null;

  const totalUrgent = data.todayPosts.length + data.overduePosts.length;

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* 1. Header Notification Bell */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="btn btn-ghost btn-sm"
        style={{
          position: 'relative',
          padding: '6px 8px',
          borderRadius: 'var(--radius-md)',
          color: totalUrgent > 0 ? '#111827' : '#6b7280',
          backgroundColor: showDropdown ? '#f3f4f6' : 'transparent',
        }}
        title="Posting Alerts & Daily Briefing"
      >
        <Bell size={16} />
        {totalUrgent > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              backgroundColor: data.overduePosts.length > 0 ? '#e11d48' : '#6366f1',
              color: '#ffffff',
              fontSize: '10px',
              fontWeight: 800,
              borderRadius: '9999px',
              minWidth: '16px',
              height: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              border: '2px solid #ffffff',
              lineHeight: 1,
            }}
          >
            {totalUrgent}
          </span>
        )}
      </button>

      {/* 2. Notification Center Dropdown */}
      {showDropdown && (
        <div
          className="glass-card"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: 'min(360px, calc(100vw - 24px))',
            backgroundColor: '#ffffff',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-medium)',
            zIndex: 50,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Dropdown Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #eaedf0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#fbfbfb',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Bell size={14} color="#6366f1" />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                Posting Alerts
              </span>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: totalUrgent > 0 ? '#4338ca' : '#6b7280',
                backgroundColor: totalUrgent > 0 ? '#e0e7ff' : '#f3f4f6',
                padding: '2px 7px',
                borderRadius: '10px',
              }}
            >
              {totalUrgent} pending
            </span>
          </div>

          {/* List of Today's Posts & Overdue Items */}
          <div style={{ maxHeight: '340px', overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Overdue Section */}
            {data.overduePosts.length > 0 && (
              <div>
                <div style={{ fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', color: '#e11d48', padding: '4px 6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertCircle size={12} />
                  Overdue Posts ({data.overduePosts.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                  {data.overduePosts.map((post) => (
                    <div
                      key={post.id}
                      style={{
                        padding: '10px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: '#fff1f2',
                        border: '1px solid #fecdd3',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#9f1239' }}>
                          {post.clientName || 'Client'}
                        </span>
                        <span style={{ fontSize: '10px', color: '#e11d48', fontWeight: 600 }}>
                          {post.publishDate} {post.publishTime ? `• ${post.publishTime}` : ''}
                        </span>
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#4b5563' }}>
                        {post.idea}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: '2px' }}>
                        <button
                          onClick={(e) => handleMarkPublished(post.id, e)}
                          disabled={publishingId === post.id}
                          className="btn btn-sm"
                          style={{
                            fontSize: '11px',
                            backgroundColor: '#059669',
                            color: '#ffffff',
                            padding: '3px 8px',
                            height: '24px',
                          }}
                        >
                          {publishingId === post.id ? 'Publishing...' : 'Mark Published ✓'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Today's Posts Section */}
            <div>
              <div style={{ fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', color: '#4338ca', padding: '4px 6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} />
                Scheduled for Today ({data.todayPosts.length})
              </div>

              {data.todayPosts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px 10px', fontSize: '12px', color: '#9ca3af' }}>
                  No more posts scheduled for today!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                  {data.todayPosts.map((post) => (
                    <div
                      key={post.id}
                      style={{
                        padding: '10px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>
                          {post.clientName || 'Client'}
                        </span>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#1d4ed8',
                            backgroundColor: '#eff6ff',
                            padding: '1px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          <Clock size={10} />
                          {post.publishTime || 'Anytime'}
                        </span>
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#4b5563' }}>
                        {post.idea}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                        {post.platform && (
                          <span style={{ fontSize: '10.5px', textTransform: 'capitalize', color: '#6b7280' }}>
                            {post.platform} • {post.format || 'post'}
                          </span>
                        )}
                        <button
                          onClick={(e) => handleMarkPublished(post.id, e)}
                          disabled={publishingId === post.id}
                          className="btn btn-sm"
                          style={{
                            fontSize: '11px',
                            backgroundColor: '#059669',
                            color: '#ffffff',
                            padding: '3px 8px',
                            height: '24px',
                            marginLeft: 'auto',
                          }}
                        >
                          {publishingId === post.id ? 'Publishing...' : 'Mark Published ✓'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Dropdown Footer: Calendar Link */}
          <div
            style={{
              padding: '10px 14px',
              borderTop: '1px solid #eaedf0',
              backgroundColor: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Link
              href="/calendar"
              onClick={() => setShowDropdown(false)}
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#6366f1',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Calendar size={13} />
              Open Content Calendar
            </Link>
            <button
              onClick={() => setShowDropdown(false)}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '11px', color: '#6b7280' }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* 3. First-Thing Daily Briefing Modal / Toast for Admin */}
      {showBriefingModal && totalUrgent > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: '16px',
            right: '16px',
            width: 'min(400px, calc(100vw - 32px))',
            maxHeight: '85vh',
            backgroundColor: '#ffffff',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.08)',
            border: '2px solid #6366f1',
            zIndex: 9999,
            overflow: 'hidden',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {/* Briefing Top Bar */}
          <div
            style={{
              padding: '14px 16px',
              background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Bell size={13} color="#ffffff" />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800 }}>Admin Posting Briefing</div>
                <div style={{ fontSize: '11px', opacity: 0.9 }}>
                  {data.todayPosts.length} post{data.todayPosts.length === 1 ? '' : 's'} scheduled for today
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowBriefingModal(false)}
              className="btn btn-ghost btn-sm"
              style={{ padding: '2px', color: '#ffffff' }}
              title="Dismiss"
            >
              <X size={16} />
            </button>
          </div>

          {/* Briefing Items Body */}
          <div
            style={{
              padding: '14px 16px',
              maxHeight: '260px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              backgroundColor: '#fcfcfd',
            }}
          >
            {data.todayPosts.map((post) => (
              <div
                key={post.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        color: '#2563eb',
                        backgroundColor: '#eff6ff',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      <Clock size={10} />
                      {post.publishTime || 'Today'}
                    </span>
                    <strong style={{ fontSize: '12px', color: '#111827' }}>
                      {post.clientName || 'Client'}
                    </strong>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#4b5563' }}>
                    {post.idea}
                  </div>
                </div>

                <button
                  onClick={() => handleMarkPublished(post.id)}
                  disabled={publishingId === post.id}
                  className="btn btn-sm"
                  style={{
                    fontSize: '11px',
                    backgroundColor: '#059669',
                    color: '#ffffff',
                    padding: '4px 8px',
                    flexShrink: 0,
                  }}
                >
                  {publishingId === post.id ? '...' : 'Publish ✓'}
                </button>
              </div>
            ))}

            {data.overduePosts.length > 0 && (
              <div style={{ fontSize: '11.5px', color: '#e11d48', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertCircle size={12} />
                {data.overduePosts.length} older overdue post{data.overduePosts.length === 1 ? '' : 's'} also need publishing.
              </div>
            )}
          </div>

          {/* Briefing Footer */}
          <div
            style={{
              padding: '10px 16px',
              borderTop: '1px solid #eaedf0',
              backgroundColor: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Link
              href="/calendar"
              onClick={() => setShowBriefingModal(false)}
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#6366f1',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              View Calendar <ChevronRight size={13} />
            </Link>

            <button
              onClick={() => setShowBriefingModal(false)}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '11px' }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

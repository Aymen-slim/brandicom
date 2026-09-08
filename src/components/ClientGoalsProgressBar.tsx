'use client';

import React, { useState } from 'react';
import { ClientData, DeliverableData } from '@/types';
import { computeClientGoalsProgress } from '@/lib/clientGoals';
import {
  Film,
  Image as ImageIcon,
  Smartphone,
  Sparkles,
  AlertTriangle,
  Send,
  Edit3,
  CheckCircle2,
  X,
  Plus,
  Flame,
  Clock,
  Layers,
  ChevronRight,
} from 'lucide-react';

interface ClientGoalsProgressBarProps {
  client: ClientData;
  deliverables: DeliverableData[];
  onClientUpdated?: (updated: ClientData) => void;
  onNewDeliverable?: (formatHint?: string) => void;
  onAlertSent?: (message: any) => void;
}

export function ClientGoalsProgressBar({
  client,
  deliverables,
  onClientUpdated,
  onNewDeliverable,
  onAlertSent,
}: ClientGoalsProgressBarProps) {
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [savingGoals, setSavingGoals] = useState(false);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [alertSuccess, setAlertSuccess] = useState(false);

  const progress = computeClientGoalsProgress(client, deliverables);

  // Selected format toggles in modal
  const initialSelected = client.monthlyGoals?.selectedFormats || (
    [
      (client.monthlyGoals?.reels ?? 0) > 0 ? 'reels' : null,
      (client.monthlyGoals?.posts ?? 0) > 0 ? 'posts' : null,
      (client.monthlyGoals?.stories ?? 0) > 0 ? 'stories' : null,
      (client.monthlyGoals?.other ?? 0) > 0 ? 'other' : null,
    ].filter(Boolean) as string[]
  );

  const [selectedFormats, setSelectedFormats] = useState<string[]>(
    initialSelected.length > 0 ? initialSelected : ['reels', 'posts']
  );

  const [reelsInput, setReelsInput] = useState(
    client.monthlyGoals?.reels != null && client.monthlyGoals.reels > 0 ? String(client.monthlyGoals.reels) : '12'
  );
  const [postsInput, setPostsInput] = useState(
    client.monthlyGoals?.posts != null && client.monthlyGoals.posts > 0 ? String(client.monthlyGoals.posts) : '4'
  );
  const [storiesInput, setStoriesInput] = useState(
    client.monthlyGoals?.stories != null && client.monthlyGoals.stories > 0 ? String(client.monthlyGoals.stories) : '15'
  );
  const [otherInput, setOtherInput] = useState(
    client.monthlyGoals?.other != null && client.monthlyGoals.other > 0 ? String(client.monthlyGoals.other) : '8'
  );
  const [otherLabelInput, setOtherLabelInput] = useState(
    client.monthlyGoals?.otherLabel || 'TikToks / UGC'
  );

  const toggleFormat = (formatKey: string) => {
    setSelectedFormats((prev) =>
      prev.includes(formatKey) ? prev.filter((k) => k !== formatKey) : [...prev, formatKey]
    );
  };

  const openEditor = () => {
    const goals = client.monthlyGoals;
    const active = goals?.selectedFormats || (
      [
        (goals?.reels ?? 0) > 0 ? 'reels' : null,
        (goals?.posts ?? 0) > 0 ? 'posts' : null,
        (goals?.stories ?? 0) > 0 ? 'stories' : null,
        (goals?.other ?? 0) > 0 ? 'other' : null,
      ].filter(Boolean) as string[]
    );
    setSelectedFormats(active.length > 0 ? active : ['reels', 'posts']);
    setReelsInput(String(goals?.reels || '12'));
    setPostsInput(String(goals?.posts || '4'));
    setStoriesInput(String(goals?.stories || '15'));
    setOtherInput(String(goals?.other || '8'));
    setOtherLabelInput(goals?.otherLabel || 'TikToks / UGC');
    setShowGoalModal(true);
  };

  const handleSaveGoals = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGoals(true);
    try {
      const goals = {
        selectedFormats,
        reels: selectedFormats.includes('reels') ? Math.max(0, parseInt(reelsInput, 10) || 0) : 0,
        posts: selectedFormats.includes('posts') ? Math.max(0, parseInt(postsInput, 10) || 0) : 0,
        stories: selectedFormats.includes('stories') ? Math.max(0, parseInt(storiesInput, 10) || 0) : 0,
        other: selectedFormats.includes('other') ? Math.max(0, parseInt(otherInput, 10) || 0) : 0,
        otherLabel: otherLabelInput.trim() || 'Other Content',
      };

      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthlyGoals: goals }),
      });

      if (res.ok) {
        const updated = await res.json();
        if (onClientUpdated) onClientUpdated(updated);
        setShowGoalModal(false);
      } else {
        alert('Failed to save monthly goals.');
      }
    } catch (err) {
      console.error('Failed to save monthly goals:', err);
      alert('Network error.');
    } finally {
      setSavingGoals(false);
    }
  };

  const handleSendAlert = async () => {
    setSendingAlert(true);
    try {
      const res = await fetch(`/api/clients/${client.id}/alert-goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        const data = await res.json();
        setAlertSuccess(true);
        if (onAlertSent && data.message) onAlertSent(data.message);
        setTimeout(() => setAlertSuccess(false), 5000);
      } else {
        alert('Failed to dispatch alert.');
      }
    } catch (err) {
      console.error('Failed to dispatch alert:', err);
    } finally {
      setSendingAlert(false);
    }
  };

  const getFormatIcon = (key: string) => {
    switch (key) {
      case 'reels':
        return <Film size={15} color="#6366f1" />;
      case 'posts':
        return <ImageIcon size={15} color="#10b981" />;
      case 'stories':
        return <Smartphone size={15} color="#f59e0b" />;
      default:
        return <Sparkles size={15} color="#ec4899" />;
    }
  };

  const getThemeColors = (key: string) => {
    switch (key) {
      case 'reels':
        return {
          barBg: '#e0e7ff',
          barFill: 'linear-gradient(90deg, #6366f1, #818cf8)',
          text: '#4f46e5',
          border: '#e0e7ff',
          badgeBg: '#eef2ff',
        };
      case 'posts':
        return {
          barBg: '#d1fae5',
          barFill: 'linear-gradient(90deg, #10b981, #34d399)',
          text: '#059669',
          border: '#d1fae5',
          badgeBg: '#ecfdf5',
        };
      case 'stories':
        return {
          barBg: '#fef3c7',
          barFill: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
          text: '#d97706',
          border: '#fef3c7',
          badgeBg: '#fffbeb',
        };
      default:
        return {
          barBg: '#fce7f3',
          barFill: 'linear-gradient(90deg, #ec4899, #f472b6)',
          text: '#db2777',
          border: '#fce7f3',
          badgeBg: '#fdf2f8',
        };
    }
  };

  return (
    <div
      className="glass-card"
      style={{
        padding: '20px 22px',
        marginBottom: '18px',
        borderRadius: '14px',
        border: progress.alertNeeded ? '1px solid #fca5a5' : '1px solid rgba(226, 232, 240, 0.9)',
        background: progress.alertNeeded
          ? 'linear-gradient(135deg, rgba(254, 242, 242, 0.98), rgba(255, 255, 255, 0.98))'
          : 'linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.95))',
        boxShadow: progress.alertNeeded
          ? '0 6px 20px rgba(239, 68, 68, 0.1)'
          : '0 4px 16px rgba(15, 23, 42, 0.04)',
      }}
    >
      {/* 1. Header Bar: Title, Month Badge, Days Remaining & Action Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: progress.alertNeeded
                ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: progress.alertNeeded
                ? '0 4px 12px rgba(239, 68, 68, 0.3)'
                : '0 4px 12px rgba(79, 70, 229, 0.25)',
            }}
          >
            {progress.alertNeeded ? <AlertTriangle size={19} /> : <Flame size={19} />}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: '#0f172a', letterSpacing: '-0.01em' }}>
                Monthly Content Goals
              </h3>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #e2e8f0',
                }}
              >
                {progress.period}
              </span>
              {progress.allGoalsHit && progress.hasGoals && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: '#ecfdf5',
                    color: '#059669',
                    border: '1px solid #a7f3d0',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <CheckCircle2 size={12} /> Target Fulfilled
                </span>
              )}
            </div>

            <div style={{ fontSize: 12, color: '#64748b', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={12} color="#94a3b8" />
              <span>
                {progress.daysRemaining > 0
                  ? `${progress.daysRemaining} day${progress.daysRemaining > 1 ? 's' : ''} remaining this month`
                  : 'Last day of the month'}
              </span>
              <span>·</span>
              <span>
                Fulfillment: <strong>{progress.totalPublished}</strong> / {progress.totalTarget} items ({progress.totalPercent}%)
              </span>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {progress.hasGoals && progress.alertNeeded && (
            <button
              type="button"
              onClick={handleSendAlert}
              disabled={sendingAlert || alertSuccess}
              className="btn btn-sm"
              style={{
                background: alertSuccess ? '#059669' : '#dc2626',
                color: '#ffffff',
                border: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11.5,
                fontWeight: 700,
                padding: '6px 12px',
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)',
                cursor: 'pointer',
              }}
              title="Notify assigned team members about lagging deliverable targets"
            >
              {alertSuccess ? (
                <>
                  <CheckCircle2 size={14} /> Alert Dispatched ✓
                </>
              ) : (
                <>
                  <Send size={14} /> {sendingAlert ? 'Sending…' : 'Alert Team'}
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={openEditor}
            className="btn btn-secondary btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              fontWeight: 600,
              padding: '6px 12px',
              borderRadius: 8,
            }}
          >
            <Edit3 size={13} /> Edit Goals
          </button>
        </div>
      </div>

      {/* 2. End-of-Month Alert Callout Banner */}
      {progress.alertNeeded && (
        <div
          style={{
            background: 'linear-gradient(135deg, #fef2f2, #fee2e2)',
            border: '1px solid #fca5a5',
            borderRadius: 10,
            padding: '14px 16px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 260 }}>
            <AlertTriangle size={20} color="#dc2626" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#991b1b', marginBottom: 3 }}>
                ⚠️ End-of-Month Alert: Content Goals Not Yet Met!
              </div>
              <div style={{ fontSize: 12, color: '#b91c1c', lineHeight: 1.5 }}>
                Only <strong>{progress.daysRemaining} day{progress.daysRemaining > 1 ? 's' : ''}</strong> remain in {progress.period}.
                Still needed to fulfill the contract quota for {client.name}:{' '}
                <strong style={{ textDecoration: 'underline' }}>{progress.missingSummary}</strong>.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {onNewDeliverable && (
              <button
                type="button"
                onClick={() => onNewDeliverable()}
                className="btn btn-primary btn-sm"
                style={{
                  fontSize: 12,
                  padding: '6px 12px',
                  backgroundColor: '#b91c1c',
                  borderColor: '#991b1b',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  borderRadius: 6,
                }}
              >
                <Plus size={13} /> + New Deliverable
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. Selective Progress Cards: ONLY displays formats configured/selected by the user */}
      {progress.visibleGoals.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fit, minmax(${progress.visibleGoals.length === 1 ? '320px' : '220px'}, 1fr))`,
            gap: 12,
            marginBottom: 16,
          }}
        >
          {progress.visibleGoals.map((item) => {
            const theme = getThemeColors(item.key);
            return (
              <div
                key={item.key}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {getFormatIcon(item.key)} {item.label}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: 5,
                      backgroundColor: item.hit ? '#ecfdf5' : progress.alertNeeded ? '#fef2f2' : theme.badgeBg,
                      color: item.hit ? '#059669' : progress.alertNeeded ? '#dc2626' : theme.text,
                    }}
                  >
                    {item.hit ? 'Goal Met ✓' : item.target > 0 ? `-${item.remaining} remaining` : 'No Target'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                    {item.published}{' '}
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: '#64748b' }}>
                      / {item.target}
                    </span>
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: theme.text }}>
                    {item.percent}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div
                  style={{
                    width: '100%',
                    height: 8,
                    backgroundColor: '#f1f5f9',
                    borderRadius: 5,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${item.percent}%`,
                      height: '100%',
                      background: item.hit ? 'linear-gradient(90deg, #10b981, #059669)' : theme.barFill,
                      borderRadius: 5,
                      transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                </div>

                {item.inProgress > 0 && (
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                    +{item.inProgress} currently in production
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty Setup State: Prompt to configure deliverables */
        <div
          style={{
            padding: '20px',
            background: '#ffffff',
            borderRadius: 10,
            border: '1px dashed #cbd5e1',
            textAlign: 'center',
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
            No Monthly Content Goals Configured
          </div>
          <p style={{ fontSize: 12, color: '#64748b', margin: '0 auto 12px auto', maxWidth: 460, lineHeight: 1.5 }}>
            Select which content types apply to this client (Reels, Posts, Stories, or Custom formats) to track delivery progress and receive end-of-month alerts.
          </p>
          <button
            type="button"
            onClick={openEditor}
            className="btn btn-primary btn-sm"
            style={{ fontSize: 12, padding: '6px 14px' }}
          >
            <Plus size={14} /> Set Up Client Goals
          </button>
        </div>
      )}

      {/* 4. Overall Monthly Completion Bar */}
      {progress.hasGoals && (
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, color: '#64748b', marginBottom: 5 }}>
            <span style={{ fontWeight: 600 }}>Overall Monthly Delivery Pace</span>
            <span style={{ fontWeight: 700, color: progress.allGoalsHit ? '#059669' : '#0f172a' }}>
              {progress.totalPublished} / {progress.totalTarget} items published ({progress.totalPercent}%)
              {progress.allGoalsHit && ' — All targets achieved! 🎉'}
            </span>
          </div>

          <div
            style={{
              width: '100%',
              height: 10,
              backgroundColor: '#f1f5f9',
              borderRadius: 6,
              overflow: 'hidden',
              display: 'flex',
            }}
          >
            <div
              style={{
                width: `${progress.totalPercent}%`,
                height: '100%',
                background: progress.allGoalsHit
                  ? 'linear-gradient(90deg, #059669, #10b981)'
                  : progress.alertNeeded
                    ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                    : 'linear-gradient(90deg, #4f46e5, #06b6d4)',
                borderRadius: 6,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Interactive Goal Editor Modal */}
      {showGoalModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: 480,
              padding: 24,
              borderRadius: 16,
              background: '#ffffff',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  Monthly Content Deliverables
                </h3>
                <p style={{ fontSize: 12, color: '#64748b', margin: '3px 0 0 0' }}>
                  {client.name} · Choose deliverable types & set monthly targets
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGoalModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveGoals} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Format selection guidance */}
              <div style={{ fontSize: 11.5, color: '#64748b' }}>
                Toggle which deliverables apply to this client. <strong>Unselected types will be completely hidden</strong> from the dashboard:
              </div>

              {/* Format Toggle Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {[
                  { key: 'reels', label: 'Reels', icon: <Film size={14} color="#6366f1" /> },
                  { key: 'posts', label: 'Posts (Photos/Carousels)', icon: <ImageIcon size={14} color="#10b981" /> },
                  { key: 'stories', label: 'Stories', icon: <Smartphone size={14} color="#f59e0b" /> },
                  { key: 'other', label: 'Other / Custom Format', icon: <Sparkles size={14} color="#ec4899" /> },
                ].map((item) => {
                  const isChecked = selectedFormats.includes(item.key);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => toggleFormat(item.key)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: isChecked ? '1.5px solid #6366f1' : '1px solid #e2e8f0',
                        background: isChecked ? '#eef2ff' : '#f8fafc',
                        color: isChecked ? '#4338ca' : '#64748b',
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {item.icon} {item.label}
                      </span>
                      <span style={{ fontSize: 12 }}>{isChecked ? '✓' : '+'}</span>
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Target Inputs: ONLY display inputs for formats that are selected */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                {selectedFormats.includes('reels') && (
                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Film size={14} color="#6366f1" /> Monthly Reels Target *
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      className="input-field"
                      placeholder="e.g. 12"
                      value={reelsInput}
                      onChange={(e) => setReelsInput(e.target.value)}
                    />
                  </div>
                )}

                {selectedFormats.includes('posts') && (
                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <ImageIcon size={14} color="#10b981" /> Monthly Posts Target (Photos / Carousels) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      className="input-field"
                      placeholder="e.g. 4"
                      value={postsInput}
                      onChange={(e) => setPostsInput(e.target.value)}
                    />
                  </div>
                )}

                {selectedFormats.includes('stories') && (
                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Smartphone size={14} color="#f59e0b" /> Monthly Stories Target *
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      className="input-field"
                      placeholder="e.g. 20"
                      value={storiesInput}
                      onChange={(e) => setStoriesInput(e.target.value)}
                    />
                  </div>
                )}

                {selectedFormats.includes('other') && (
                  <div style={{ background: '#fdf2f8', padding: 12, borderRadius: 8, border: '1px solid #fbcfe8', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#be185d', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkles size={14} color="#ec4899" /> Other / Custom Deliverable Format
                    </div>
                    <div className="grid-responsive-2" style={{ gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 2 }}>
                          Format Name
                        </label>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="e.g. UGC Videos, TikToks"
                          value={otherLabelInput}
                          onChange={(e) => setOtherLabelInput(e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 2 }}>
                          Monthly Target
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          required
                          className="input-field"
                          placeholder="e.g. 8"
                          value={otherInput}
                          onChange={(e) => setOtherInput(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {selectedFormats.length === 0 && (
                  <div style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', padding: 10, borderRadius: 6, textAlign: 'center' }}>
                    Please select at least one content format above to track.
                  </div>
                )}
              </div>

              <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, fontSize: 11.5, color: '#64748b' }}>
                💡 <strong>Automated Alerts:</strong> An alert notification is automatically flagged during the last 7 days of the month whenever active targets are behind schedule.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setShowGoalModal(false)}
                  className="btn btn-secondary btn-sm"
                  disabled={savingGoals}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={savingGoals || selectedFormats.length === 0}
                >
                  {savingGoals ? 'Saving…' : 'Save Goals'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

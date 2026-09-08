'use client';

import React, { useState } from 'react';
import { X, RefreshCw, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { parseFollowerInput, formatNumber } from '@/lib/format';

export function MetricsEntryModal({
  deliverableId,
  idea,
  onClose,
  onSaved,
}: {
  deliverableId: string;
  idea: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState({
    views: '',
    likes: '',
    comments: '',
    shares: '',
    saves: '',
    reach: '',
    impressions: '',
    linkClicks: '',
    followersGained: '',
  });

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleAutoSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch(`/api/deliverables/${deliverableId}/sync-metrics`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync stats via Apify');
      }
      if (data.scraped) {
        setForm((p) => ({
          ...p,
          views: String(data.scraped.views ?? p.views),
          likes: String(data.scraped.likes ?? p.likes),
          comments: String(data.scraped.comments ?? p.comments),
          shares: String(data.scraped.shares ?? p.shares),
        }));
        setSyncMsg({
          type: 'success',
          text: `Fetched live metrics from ${data.scraped.platform}! (${data.scraped.views.toLocaleString()} views, ${data.scraped.likes.toLocaleString()} likes)`,
        });
        onSaved();
      }
    } catch (err: any) {
      setSyncMsg({ type: 'error', text: err.message || 'Failed to sync metrics' });
    } finally {
      setSyncing(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliverableId,
          views: parseFollowerInput(form.views) || 0,
          likes: parseFollowerInput(form.likes) || 0,
          comments: parseFollowerInput(form.comments) || 0,
          shares: parseFollowerInput(form.shares) || 0,
          saves: parseFollowerInput(form.saves) || 0,
          reach: parseFollowerInput(form.reach) || 0,
          impressions: parseFollowerInput(form.impressions) || 0,
          linkClicks: parseFollowerInput(form.linkClicks) || 0,
          followersGained: parseFollowerInput(form.followersGained) || 0,
        }),
      });
      if (res.ok) {
        onSaved();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  const fields: Array<[string, string]> = [
    ['views', 'Views'],
    ['likes', 'Likes'],
    ['comments', 'Comments'],
    ['shares', 'Shares'],
    ['saves', 'Saves'],
    ['reach', 'Reach'],
    ['impressions', 'Impressions'],
    ['linkClicks', 'Link clicks'],
    ['followersGained', 'Followers gained'],
  ];

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ padding: 24, maxWidth: 540 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Update Metrics</h3>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{idea}</div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Apify Auto-Sync Action Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            marginBottom: 16,
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={16} color="#16a34a" />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#15803d' }}>
                Auto-fetch from Instagram / TikTok
              </div>
              <div style={{ fontSize: 11, color: '#4b5563' }}>
                Fetch live views, likes & comments via Apify
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAutoSync}
            disabled={syncing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11.5,
              fontWeight: 600,
              padding: '6px 12px',
              borderRadius: '6px',
              backgroundColor: '#16a34a',
              color: '#ffffff',
              border: 'none',
              cursor: syncing ? 'not-allowed' : 'pointer',
              opacity: syncing ? 0.7 : 1,
            }}
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Fetching...' : 'Fetch Now'}
          </button>
        </div>

        {syncMsg && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: 12,
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: syncMsg.type === 'success' ? '#ecfdf5' : '#fef2f2',
              color: syncMsg.type === 'success' ? '#065f46' : '#991b1b',
              border: `1px solid ${syncMsg.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
            }}
          >
            {syncMsg.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            <span>{syncMsg.text}</span>
          </div>
        )}

        <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {fields.map(([k, label]) => {
            const rawVal = (form as any)[k];
            const parsedVal = rawVal ? parseFollowerInput(rawVal) : null;
            const hasShorthand = rawVal && (/[km,]/i.test(rawVal) || (parsedVal != null && String(parsedVal) !== rawVal));

            return (
              <div key={k}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <label style={{ fontSize: 11, fontWeight: 600 }}>{label}</label>
                  {hasShorthand && parsedVal != null && (
                    <span style={{ fontSize: 10, color: '#047857', fontWeight: 600 }}>
                      ={formatNumber(parsedVal)}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="0 or 10k"
                  className="input-field"
                  value={rawVal}
                  onChange={(e) => set(k, e.target.value)}
                  style={{ fontSize: 12 }}
                />
              </div>
            );
          })}
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save snapshot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliverableId,
          views: Number(form.views || 0),
          likes: Number(form.likes || 0),
          comments: Number(form.comments || 0),
          shares: Number(form.shares || 0),
          saves: Number(form.saves || 0),
          reach: Number(form.reach || 0),
          impressions: Number(form.impressions || 0),
          linkClicks: Number(form.linkClicks || 0),
          followersGained: Number(form.followersGained || 0),
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
      <div className="modal-container" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Update numbers · {idea}</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {fields.map(([k, label]) => (
            <div key={k}>
              <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>{label}</label>
              <input
                type="number"
                className="input-field"
                value={(form as any)[k]}
                onChange={(e) => set(k, e.target.value)}
              />
            </div>
          ))}
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

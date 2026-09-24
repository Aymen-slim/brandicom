'use client';

import React, { useMemo, useState } from 'react';
import { Search, Trash2 } from 'lucide-react';
import { ContactSubmission } from '@/lib/submissions';

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function isCallablePhone(value: string) {
  return value.replace(/\D/g, '').length >= 8;
}

function telHref(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith('+')) return `tel:${trimmed.replace(/\s/g, '')}`;
  const digits = trimmed.replace(/\D/g, '');
  return digits ? `tel:+${digits}` : 'tel:';
}

export function SubmissionInbox({ submissions: initialSubmissions }: { submissions: ContactSubmission[] }) {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [nameQuery, setNameQuery] = useState('');
  const [emailQuery, setEmailQuery] = useState('');
  const [phoneQuery, setPhoneQuery] = useState('');
  const [service, setService] = useState('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const services = useMemo(() => {
    const names = new Set<string>();
    submissions.forEach((row) => row.services.forEach((item) => names.add(item)));
    return Array.from(names).sort();
  }, [submissions]);

  const filtered = useMemo(() => {
    const name = nameQuery.trim().toLowerCase();
    const email = emailQuery.trim().toLowerCase();
    const phone = phoneQuery.replace(/\D/g, '');
    return submissions.filter((row) => {
      if (name && !row.name.toLowerCase().includes(name)) return false;
      if (email && !row.email.toLowerCase().includes(email)) return false;
      if (phone && !row.phone.replace(/\D/g, '').includes(phone)) return false;
      if (service !== 'all' && !row.services.includes(service)) return false;
      return true;
    });
  }, [submissions, nameQuery, emailQuery, phoneQuery, service]);

  const remove = async (row: ContactSubmission) => {
    if (!confirm(`Delete lead from ${row.name}? This cannot be undone.`)) return;
    setDeletingId(row.id);
    try {
      const res = await fetch(`/api/leads/${row.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Could not delete this lead.');
        return;
      }
      setSubmissions((current) => current.filter((item) => item.id !== row.id));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div
        className="glass-card"
        style={{
          padding: '14px 18px',
          marginBottom: 18,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 160 }}>
          <Search
            size={14}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Filter by name"
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
            className="input-field"
            style={{ paddingLeft: 32 }}
            aria-label="Filter by name"
          />
        </div>
        <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 160 }}>
          <Search
            size={14}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Filter by email"
            value={emailQuery}
            onChange={(e) => setEmailQuery(e.target.value)}
            className="input-field"
            style={{ paddingLeft: 32 }}
            aria-label="Filter by email"
          />
        </div>
        <div style={{ position: 'relative', flex: '1 1 160px', minWidth: 140 }}>
          <Search
            size={14}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Filter by phone"
            value={phoneQuery}
            onChange={(e) => setPhoneQuery(e.target.value)}
            className="input-field"
            style={{ paddingLeft: 32 }}
            aria-label="Filter by phone"
          />
        </div>
        <select
          value={service}
          onChange={(e) => setService(e.target.value)}
          className="input-field"
          style={{ flex: '1 1 160px', minWidth: 140 }}
          aria-label="Filter by service"
        >
          <option value="all">All services</option>
          {services.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {filtered.length} of {submissions.length}
        </span>
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div className="table-responsive-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ minWidth: 140 }}>Name</th>
                <th style={{ minWidth: 180 }}>Email</th>
                <th style={{ minWidth: 140 }}>Phone</th>
                <th>Budget</th>
                <th style={{ minWidth: 160 }}>Services</th>
                <th style={{ minWidth: 220 }}>Message</th>
                <th style={{ minWidth: 140 }}>Submitted</th>
                <th style={{ width: 72 }} aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ color: 'var(--text-muted)', padding: '28px 16px' }}>
                    {submissions.length === 0
                      ? 'No form submissions yet.'
                      : 'No submissions match these filters.'}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  return (
                    <tr key={row.id}>
                      <td style={{ fontWeight: 600 }}>{row.name}</td>
                      <td>
                        <a href={`mailto:${row.email}`}>{row.email}</a>
                      </td>
                      <td>
                        {isCallablePhone(row.phone) ? (
                          <a href={telHref(row.phone)}>{row.phone}</a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{row.budget}</td>
                      <td>{row.services.join(', ') || '—'}</td>
                      <td style={{ whiteSpace: 'pre-wrap', maxWidth: 360 }}>{row.message || '—'}</td>
                      <td suppressHydrationWarning>{formatWhen(row.createdAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="input-field"
                          onClick={() => remove(row)}
                          disabled={deletingId === row.id}
                          aria-label={`Delete lead ${row.name}`}
                          title="Delete lead"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '8px 10px',
                            color: '#b91c1c',
                            cursor: deletingId === row.id ? 'wait' : 'pointer',
                          }}
                        >
                          <Trash2 size={16} />
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
    </>
  );
}

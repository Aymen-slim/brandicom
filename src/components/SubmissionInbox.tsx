'use client';

import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { ContactSubmission } from '@/lib/submissions';

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export function SubmissionInbox({ submissions }: { submissions: ContactSubmission[] }) {
  const [nameQuery, setNameQuery] = useState('');
  const [emailQuery, setEmailQuery] = useState('');
  const [service, setService] = useState('all');

  const services = useMemo(() => {
    const names = new Set<string>();
    submissions.forEach((row) => row.services.forEach((item) => names.add(item)));
    return Array.from(names).sort();
  }, [submissions]);

  const filtered = useMemo(() => {
    const name = nameQuery.trim().toLowerCase();
    const email = emailQuery.trim().toLowerCase();
    return submissions.filter((row) => {
      if (name && !row.name.toLowerCase().includes(name)) return false;
      if (email && !row.email.toLowerCase().includes(email)) return false;
      if (service !== 'all' && !row.services.includes(service)) return false;
      return true;
    });
  }, [submissions, nameQuery, emailQuery, service]);

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
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
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
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
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
                <th>Budget</th>
                <th style={{ minWidth: 160 }}>Services</th>
                <th style={{ minWidth: 220 }}>Message</th>
                <th style={{ minWidth: 140 }}>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ color: 'var(--text-muted)', padding: '28px 16px' }}>
                    {submissions.length === 0
                      ? 'No form submissions yet.'
                      : 'No submissions match these filters.'}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id}>
                    <td style={{ fontWeight: 600 }}>{row.name}</td>
                    <td>
                      <a href={`mailto:${row.email}`}>{row.email}</a>
                    </td>
                    <td>{row.budget}</td>
                    <td>{row.services.join(', ') || '—'}</td>
                    <td style={{ whiteSpace: 'pre-wrap', maxWidth: 360 }}>{row.message || '—'}</td>
                    <td suppressHydrationWarning>{formatWhen(row.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

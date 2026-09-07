'use client';

import React from 'react';
import { CreatorData } from '@/types';
import { Instagram, Calendar, Mail, Phone } from 'lucide-react';

interface CreatorCardProps {
  creator: CreatorData;
  onEdit?: (creator: CreatorData) => void;
}

export function CreatorCard({ creator, onEdit }: CreatorCardProps) {
  const roleColors: Record<string, { bg: string; text: string }> = {
    videographer: { bg: '#eff6ff', text: '#1d4ed8' },
    photographer: { bg: '#e0f2fe', text: '#0369a1' },
    ugc: { bg: '#f3e8ff', text: '#7e22ce' },
    presenter: { bg: '#fffbeb', text: '#b45309' },
  };

  const currentRoleStyle = roleColors[creator.role] || roleColors.videographer;

  const formatFollowers = (count: number | null) => {
    if (!count) return null;
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${Math.round(count / 1000)}k`;
    return count.toString();
  };

  return (
    <div
      className="glass-card"
      style={{
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        position: 'relative',
      }}
    >
      {/* Top row: Name & Availability */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>
            {creator.name}
          </h4>
          <span
            style={{
              padding: '1.5px 7px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'capitalize',
              backgroundColor: currentRoleStyle.bg,
              color: currentRoleStyle.text,
            }}
          >
            {creator.role}
          </span>
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            fontWeight: 600,
            padding: '2px 7px',
            borderRadius: '4px',
            backgroundColor: creator.available ? '#ecfdf5' : '#fff1f2',
            color: creator.available ? '#059669' : '#e11d48',
          }}
        >
          <span
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              backgroundColor: creator.available ? '#10b981' : '#f43f5e',
            }}
          />
          {creator.available ? 'Available' : 'Booked'}
        </div>
      </div>

      {/* Style tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
        {creator.styleTags.map((tag, idx) => (
          <span
            key={idx}
            style={{
              fontSize: '11px',
              padding: '1px 7px',
              borderRadius: '4px',
              backgroundColor: '#f3f4f6',
              color: '#4b5563',
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Rate & Reach stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
          padding: '10px 12px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: '#f9fafb',
          border: '1px solid #eaedf0',
        }}
      >
        <div>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#9ca3af', fontWeight: 600 }}>
            Day Rate
          </span>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginTop: '1px' }}>
            {creator.dayRate != null ? `${Number(creator.dayRate).toLocaleString()} TND/${creator.rateUnit || 'day'}` : (creator.dayRate === null ? '—' : 'Negotiable')}
          </div>
        </div>

        <div>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#9ca3af', fontWeight: 600 }}>
            Instagram Reach
          </span>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', marginTop: '1px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {creator.instagramHandle ? (
              <a
                href={`https://instagram.com/${creator.instagramHandle.replace('@', '')}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#4f46e5', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
              >
                <Instagram size={12} />
                {formatFollowers(creator.followers) ? `${formatFollowers(creator.followers)}` : creator.instagramHandle}
              </a>
            ) : (
              <span style={{ color: '#9ca3af' }}>—</span>
            )}
          </div>
        </div>
      </div>

      {/* Booked Shoots count if available */}
      {creator.assignments && creator.assignments.length > 0 && (
        <div style={{ fontSize: '11px', color: '#4b5563', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Calendar size={11} color="#6366f1" />
          <span>
            Booked on <strong>{creator.assignments.length} shoots</strong> ({creator.assignments.map(a => a.client.name).join(', ')})
          </span>
        </div>
      )}

      {/* Footer Contact */}
      <div
        style={{
          marginTop: 'auto',
          paddingTop: '10px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: '6px' }}>
          {creator.email && (
            <a
              href={`mailto:${creator.email}`}
              className="btn btn-ghost btn-sm"
              style={{ padding: '4px 6px', color: '#6b7280' }}
              title={creator.email}
            >
              <Mail size={13} />
            </a>
          )}
          {creator.phone && (
            <a
              href={`tel:${creator.phone}`}
              className="btn btn-ghost btn-sm"
              style={{ padding: '4px 6px', color: '#6b7280' }}
              title={creator.phone}
            >
              <Phone size={13} />
            </a>
          )}
        </div>

        {onEdit && (
          <button
            onClick={() => onEdit(creator)}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '11px' }}
          >
            Edit Profile
          </button>
        )}
      </div>
    </div>
  );
}

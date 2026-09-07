'use client';

import React from 'react';
import { ClientStatus } from '@/types';
import { StatusBadge } from './StatusBadge';

interface PipelineBreakdownProps {
  breakdown: Record<ClientStatus, number>;
  totalClients: number;
}

export function PipelineBreakdown({ breakdown, totalClients }: PipelineBreakdownProps) {
  const statuses: Array<{ key: ClientStatus; label: string; color: string }> = [
    { key: 'active', label: 'Active', color: '#10b981' },
    { key: 'starting', label: 'Starting', color: '#0ea5e9' },
    { key: 'potential', label: 'Potential', color: '#8b5cf6' },
    { key: 'paused', label: 'Paused', color: '#f59e0b' },
    { key: 'churned', label: 'Churned', color: '#f43f5e' },
  ];

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Client Pipeline Breakdown
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Live roster distribution across engagement lifecycle stages
          </p>
        </div>
        <div
          style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          Total: <strong style={{ color: '#fff' }}>{totalClients} Clients</strong>
        </div>
      </div>

      {/* Segmented Distribution Bar */}
      <div
        style={{
          width: '100%',
          height: '14px',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
          display: 'flex',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          marginBottom: '20px',
        }}
      >
        {statuses.map((s) => {
          const count = breakdown[s.key] || 0;
          if (count === 0) return null;
          const pct = totalClients > 0 ? (count / totalClients) * 100 : 0;
          return (
            <div
              key={s.key}
              title={`${s.label}: ${count} (${Math.round(pct)}%)`}
              style={{
                width: `${pct}%`,
                backgroundColor: s.color,
                transition: 'width 0.5s ease',
              }}
            />
          );
        })}
      </div>

      {/* Grid of status counters */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '12px',
        }}
      >
        {statuses.map((s) => {
          const count = breakdown[s.key] || 0;
          const pct = totalClients > 0 ? Math.round((count / totalClients) * 100) : 0;

          return (
            <div
              key={s.key}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <StatusBadge status={s.key} size="sm" />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{pct}%</span>
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>
                {count}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

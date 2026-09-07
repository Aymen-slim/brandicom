'use client';

import React from 'react';
import { ClientStatus } from '@/types';

interface StageBarChartProps {
  breakdown: Record<ClientStatus, number>;
  totalClients: number;
}

export function StageBarChart({ breakdown = {} as Record<ClientStatus, number>, totalClients = 0 }: StageBarChartProps) {
  const b = breakdown || {};
  const stages: Array<{ key: ClientStatus; label: string; count: number; relativeHeight: number }> = [
    { key: 'potential', label: 'Potential', count: b.potential || 0, relativeHeight: 40 },
    { key: 'starting', label: 'Starting', count: b.starting || 0, relativeHeight: 60 },
    { key: 'active', label: 'Active', count: b.active || 0, relativeHeight: 95 },
    { key: 'paused', label: 'Paused', count: b.paused || 0, relativeHeight: 35 },
    { key: 'churned', label: 'Churned', count: b.churned || 0, relativeHeight: 25 },
  ];

  // Max count to scale bar heights
  const maxCount = Math.max(...stages.map((s) => s.count), 4);

  return (
    <div
      className="glass-card"
      style={{
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            My pipeline by stage
          </h4>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            Client account volume by lifecycle stage
          </span>
        </div>

        <span
          style={{
            fontSize: '11px',
            color: 'var(--text-secondary)',
            fontWeight: 600,
            background: '#f3f4f6',
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          {totalClients} Accounts
        </span>
      </div>

      {/* Bars container */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-around',
          flex: 1,
          minHeight: '160px',
          borderBottom: '1px solid #eaedf0',
          paddingBottom: '8px',
          gap: '16px',
        }}
      >
        {stages.map((stage) => {
          // Height percentage between 15% and 90%
          const pct = Math.max((stage.count / maxCount) * 85, 12);

          return (
            <div
              key={stage.key}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: 1,
                height: '100%',
                justifyContent: 'flex-end',
              }}
            >
              {/* Count above bar */}
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#111827',
                  marginBottom: '4px',
                }}
              >
                {stage.count}
              </span>

              {/* Bar column */}
              <div
                style={{
                  width: '100%',
                  maxWidth: '44px',
                  height: `${pct}%`,
                  backgroundColor: stage.key === 'active' ? '#93c5fd' : '#bfdbfe',
                  borderRadius: '6px 6px 0 0',
                  transition: 'height 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                  position: 'relative',
                }}
                title={`${stage.label}: ${stage.count} accounts`}
              />
            </div>
          );
        })}
      </div>

      {/* Stage labels underneath */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-around',
          marginTop: '10px',
          gap: '16px',
        }}
      >
        {stages.map((stage) => (
          <div
            key={stage.key}
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              fontWeight: 500,
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            {stage.label}
          </div>
        ))}
      </div>
    </div>
  );
}

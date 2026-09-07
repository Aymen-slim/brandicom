'use client';

import React from 'react';

interface GaugeCardProps {
  title: string;
  percentage: number;
  subtitle?: string;
  color?: string;
  badgeLabel?: string;
}

export function GaugeCard({
  title,
  percentage,
  subtitle,
  color = '#f97316', // orange default like "Target progress" in screenshot
  badgeLabel,
}: GaugeCardProps) {
  const radius = 60;
  const strokeWidth = 10;
  // Semicircle circumference: PI * radius
  const arcLength = Math.PI * radius;
  // Clamped percentage: 0 - 100
  const clampedPct = Math.min(Math.max(percentage, 0), 100);
  const strokeDashoffset = arcLength * (1 - clampedPct / 100);

  return (
    <div
      className="glass-card"
      style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '190px',
      }}
    >
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
        {title}
      </div>

      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '10px 0',
        }}
      >
        <svg width="150" height="85" viewBox="0 0 150 85" style={{ overflow: 'visible' }}>
          {/* Background gray arc */}
          <path
            d="M 15 75 A 60 60 0 0 1 135 75"
            fill="none"
            stroke="#f1f3f5"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Active colored arc */}
          <path
            d="M 15 75 A 60 60 0 0 1 135 75"
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={arcLength}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>

        {/* Center Percentage Text */}
        <div
          style={{
            position: 'absolute',
            bottom: '4px',
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontSize: '24px',
              fontWeight: 800,
              color: 'var(--text-primary)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {clampedPct}%
          </span>
        </div>
      </div>

      {/* Footer detail */}
      <div style={{ textAlign: 'center', marginTop: 'auto' }}>
        {badgeLabel ? (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              color: 'var(--text-muted)',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: color,
              }}
            />
            <span>{badgeLabel}</span>
          </div>
        ) : subtitle ? (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{subtitle}</span>
        ) : null}
      </div>
    </div>
  );
}

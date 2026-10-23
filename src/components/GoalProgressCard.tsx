'use client';

import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { formatMoney, formatNumber, formatCompactNumber } from '@/lib/format';

interface GoalProgressCardProps {
  title: string;
  actual: number;
  target: number;
  unit?: string;
  isCurrency?: boolean;
  deltaText?: string;
  isPositiveDelta?: boolean;
  subtitle?: string;
  icon?: React.ReactNode;
}

export function GoalProgressCard({
  title,
  actual,
  target,
  unit = '',
  isCurrency = false,
  deltaText,
  isPositiveDelta = true,
}: GoalProgressCardProps) {
  const percentage = target > 0 ? Math.round((actual / target) * 100) : 100;

  const formatValue = (val: number) => {
    if (isCurrency) return formatMoney(val);
    if (val >= 1_000_000) {
      return `${formatCompactNumber(val)}${unit ? ' ' + unit : ''}`;
    }
    return `${formatNumber(val)}${unit ? ' ' + unit : ''}`;
  };

  const deltaBadge = deltaText ?? `${percentage}% of target`;
  const clampedPct = Math.min(100, Math.max(0, percentage));

  return (
    <div
      className="glass-card"
      style={{
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '10px',
        minHeight: '124px',
        minWidth: 0,
      }}
    >
      {/* Title */}
      <div
        style={{
          fontSize: '12.5px',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {title}
      </div>

      {/* Metric Value */}
      <div
        style={{
          fontSize: '23px',
          fontWeight: 800,
          color: 'var(--text-primary)',
          letterSpacing: '-0.03em',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.15,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {formatValue(actual)}
      </div>

      {/* Progress & Delta Tag */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: 'auto' }}>
        <div
          style={{
            flex: 1,
            height: '5px',
            backgroundColor: '#f1f5f9',
            borderRadius: '999px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${clampedPct}%`,
              background: clampedPct >= 100 ? '#10b981' : '#6366f1',
              borderRadius: '999px',
              transition: 'width 0.4s ease',
            }}
          />
        </div>

        <div
          className={`delta-tag ${isPositiveDelta ? 'positive' : 'negative'}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          <span>{deltaBadge}</span>
          <ArrowUpRight size={11} />
        </div>
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { formatMoney, formatNumber } from '@/lib/format';

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
    return `${formatNumber(val)}${unit ? ' ' + unit : ''}`;
  };

  const deltaBadge = deltaText ?? `${percentage}% of target`;

  return (
    <div
      className="glass-card"
      style={{
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '120px',
      }}
    >
      {/* Title */}
      <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--text-secondary)' }}>
        {title}
      </div>

      {/* Metric Value & Delta Tag */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginTop: '12px',
        }}
      >
        <div
          style={{
            fontSize: '26px',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.03em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatValue(actual)}
        </div>

        {/* Delta tag like in the screenshot (+8% ↗) */}
        <div
          className={`delta-tag ${isPositiveDelta ? 'positive' : 'negative'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '2px' }}
        >
          <span>{deltaBadge}</span>
          <ArrowUpRight size={12} />
        </div>
      </div>
    </div>
  );
}

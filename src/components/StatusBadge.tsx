'use client';

import React from 'react';
import { ClientStatus } from '@/types';
import { CLIENT_STATUS_LABELS, CLIENT_STATUS_STYLES, normalizeClientStatus } from '@/lib/clientStatus';

interface StatusBadgeProps {
  status: ClientStatus | string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const normalized = normalizeClientStatus(status);
  const label = CLIENT_STATUS_LABELS[normalized];
  const current = CLIENT_STATUS_STYLES[normalized];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: size === 'sm' ? '2px 7px' : '3px 9px',
        fontSize: size === 'sm' ? '11px' : '11.5px',
        fontWeight: 600,
        borderRadius: '4px',
        backgroundColor: current.bg,
        color: current.text,
        letterSpacing: '0.01em',
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

'use client';

import React from 'react';
import { ClientStatus } from '@/types';

interface StatusBadgeProps {
  status: ClientStatus | string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const normalized = (status || 'potential').toLowerCase();

  const labels: Record<string, string> = {
    active: 'Active',
    starting: 'Starting',
    potential: 'Potential',
    paused: 'Paused',
    churned: 'Churned',
  };

  const label = labels[normalized] || normalized;

  // Custom pastel pill styles matching reference image
  const pillStyles: Record<string, { bg: string; text: string }> = {
    active: { bg: '#ecfdf5', text: '#047857' },     // Soft mint
    starting: { bg: '#e0f2fe', text: '#0284c7' },   // Soft sky (like 'Verbal' in screenshot)
    potential: { bg: '#f3e8ff', text: '#7e22ce' },  // Soft lavender (like 'Proposal' in screenshot)
    paused: { bg: '#fffbeb', text: '#b45309' },     // Soft amber
    churned: { bg: '#ffe4e6', text: '#be123c' },    // Soft rose
  };

  const current = pillStyles[normalized] || pillStyles.potential;

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

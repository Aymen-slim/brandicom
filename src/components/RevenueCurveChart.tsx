'use client';

import React from 'react';

interface RevenueCurveChartProps {
  title?: string;
  unitLabel?: string;
}

export function RevenueCurveChart({
  title = 'Revenue this year',
  unitLabel = 'USD (Thousands)',
}: RevenueCurveChartProps) {
  // Smooth curve points representing agency growth trajectory
  // Points (x, y) where y is mapped from 0 to 110:
  // Jan(25, 65), Feb(75, 60), Mar(125, 80), Apr(175, 55), May(225, 50), Jun(275, 20), Jul(325, 35), Aug(375, 45), Sep(425, 30)
  const pathData = 'M 25 70 C 50 70, 60 55, 80 55 C 105 55, 115 85, 135 85 C 160 85, 170 55, 195 55 C 220 55, 230 45, 255 45 C 275 45, 285 20, 305 20 C 325 20, 335 38, 355 38 C 375 38, 385 45, 405 45 C 425 45, 435 30, 455 30';
  const fillPathData = `${pathData} L 455 110 L 25 110 Z`;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {title}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{unitLabel}</div>
        </div>

        <div style={{ fontSize: '12px', fontWeight: 700, color: '#8b5cf6' }}>
          Current: $66k /mo
        </div>
      </div>

      {/* SVG Chart area */}
      <div style={{ width: '100%', height: '105px', marginTop: '10px', position: 'relative' }}>
        <svg
          viewBox="0 0 480 125"
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal grid lines */}
          <line x1="20" y1="20" x2="460" y2="20" stroke="#f1f3f5" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="20" y1="55" x2="460" y2="55" stroke="#f1f3f5" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="20" y1="85" x2="460" y2="85" stroke="#f1f3f5" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="20" y1="110" x2="460" y2="110" stroke="#eaedf0" strokeWidth="1" />

          {/* Area fill */}
          <path d={fillPathData} fill="url(#curveGradient)" />

          {/* Main smooth curve stroke */}
          <path
            d={pathData}
            fill="none"
            stroke="#8b5cf6"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Latest point pulse */}
          <circle cx="455" cy="30" r="4.5" fill="#8b5cf6" />
          <circle cx="455" cy="30" r="8" fill="#8b5cf6" opacity="0.2" />
        </svg>
      </div>

      {/* Month labels */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          paddingLeft: '20px',
          paddingRight: '15px',
          marginTop: '2px',
        }}
      >
        {months.map((m, idx) => (
          <span key={idx} style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}

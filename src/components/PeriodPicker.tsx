'use client';

import React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { currentMonth, currentYear, detectPeriodKind, normalizePeriod, periodShortLabel, shiftPeriod } from '@/lib/period';

export function PeriodPicker({ defaultKind = 'month' }: { defaultKind?: 'month' | 'year' }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const period = normalizePeriod(searchParams.get('period'), defaultKind);
  const kind = detectPeriodKind(period);

  const setPeriod = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('period', next);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="period-picker-container">
      <button
        type="button"
        className="btn btn-secondary btn-sm period-chevron-btn"
        onClick={() => setPeriod(shiftPeriod(period, -1))}
        aria-label="Previous period"
      >
        <ChevronLeft size={14} />
      </button>
      <div className="period-picker-label">
        {periodShortLabel(period)}
      </div>
      <button
        type="button"
        className="btn btn-secondary btn-sm period-chevron-btn"
        onClick={() => setPeriod(shiftPeriod(period, 1))}
        aria-label="Next period"
      >
        <ChevronRight size={14} />
      </button>
      <button
        type="button"
        className={`btn btn-sm desktop-only-btn ${kind === 'month' ? 'btn-primary' : 'btn-secondary'}`}
        onClick={() => setPeriod(currentMonth())}
      >
        Month
      </button>
      <button
        type="button"
        className={`btn btn-sm desktop-only-btn ${kind === 'year' ? 'btn-primary' : 'btn-secondary'}`}
        onClick={() => setPeriod(currentYear())}
      >
        Year
      </button>
    </div>
  );
}

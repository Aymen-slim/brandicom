export type PeriodKind = 'month' | 'year';

const MONTH_RE = /^\d{4}-\d{2}$/;
const YEAR_RE = /^\d{4}$/;

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function currentYear(): string {
  return String(new Date().getFullYear());
}

export function detectPeriodKind(period: string): PeriodKind {
  if (YEAR_RE.test(period) && !MONTH_RE.test(period)) return 'year';
  return 'month';
}

export function isValidPeriod(period: string | null | undefined): period is string {
  if (!period) return false;
  if (YEAR_RE.test(period)) return true;
  if (!MONTH_RE.test(period)) return false;
  const month = Number(period.slice(5, 7));
  return month >= 1 && month <= 12;
}

export function normalizePeriod(period?: string | null, fallbackKind: PeriodKind = 'month'): string {
  if (isValidPeriod(period)) return period;
  return fallbackKind === 'year' ? currentYear() : currentMonth();
}

export function periodLabel(period: string): string {
  if (YEAR_RE.test(period) && !MONTH_RE.test(period)) return period;
  const [y, m] = period.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function periodShortLabel(period: string): string {
  if (YEAR_RE.test(period) && !MONTH_RE.test(period)) return period;
  const [y, m] = period.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function shiftPeriod(period: string, delta: number): string {
  if (YEAR_RE.test(period) && !MONTH_RE.test(period)) {
    return String(Number(period) + delta);
  }
  const [y, m] = period.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function periodRange(period: string): { start: string; end: string; kind: PeriodKind } {
  if (YEAR_RE.test(period) && !MONTH_RE.test(period)) {
    return { start: `${period}-01-01`, end: `${period}-12-31`, kind: 'year' };
  }
  const [y, m] = period.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return {
    start: `${period}-01`,
    end: `${period}-${String(last).padStart(2, '0')}`,
    kind: 'month',
  };
}

export function yearMonths(year: string | number): string[] {
  const y = String(year);
  return Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`);
}

export const CURRENCY = 'TND';
export const CURRENCY_LOCALE = 'fr-TN';
export const VAT_RATE = 0.19;

const moneyFmt = new Intl.NumberFormat(CURRENCY_LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

const numberFmt = new Intl.NumberFormat(CURRENCY_LOCALE, { maximumFractionDigits: 0 });

export function formatMoney(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return moneyFmt.format(n).replace(/[\u202F\u00A0]/g, ' ');
}

/**
 * Deterministic compact money formatting (e.g. 16 k DT, 1,5 k DT, 1 M DT).
 * Avoids React hydration mismatches caused by ICU/runtime differences between Node.js and browsers.
 */
export function formatCompactMoney(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';

  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    const v = abs / 1_000_000_000;
    const formatted = (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '')).replace('.', ',');
    return `${sign}${formatted} Mrd DT`;
  }
  if (abs >= 1_000_000) {
    const v = abs / 1_000_000;
    const formatted = (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '')).replace('.', ',');
    return `${sign}${formatted} M DT`;
  }
  if (abs >= 1_000) {
    const v = abs / 1_000;
    const formatted = (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '')).replace('.', ',');
    return `${sign}${formatted} k DT`;
  }

  return `${sign}${Math.round(abs)} DT`;
}

export function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return numberFmt.format(n).replace(/[\u202F\u00A0]/g, ' ');
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

export function monthsBetween(start: string | Date | null | undefined, end?: string | Date | null): number {
  if (!start) return 0;
  const a = new Date(start);
  const b = end ? new Date(end) : new Date();
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  const months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  return Math.max(0, months);
}

export function formatTenure(start: string | Date | null | undefined): string {
  const months = monthsBetween(start);
  if (months === 0) return 'Just started';
  if (months < 12) return `${months} mo together`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${years} yr together`;
  return `${years} yr ${rem} mo together`;
}

export function withVat(subtotal: number, vatRate = VAT_RATE): { subtotal: number; vat: number; total: number } {
  const vat = Math.round(subtotal * vatRate * 1000) / 1000;
  const total = Math.round((subtotal + vat) * 1000) / 1000;
  return { subtotal, vat, total };
}

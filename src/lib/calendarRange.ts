export interface CalendarRange { from: string; to: string }

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getCalendarRange(date: Date): CalendarRange {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  const remainder = (end.getDay() + 6) % 7;
  if (remainder) end.setDate(end.getDate() + 7 - remainder);
  return { from: localDateKey(start), to: localDateKey(end) };
}

export function isInCalendarRange(deliverable: { publishDate?: string | null; filmingDate?: string | null }, range: CalendarRange) {
  return [deliverable.publishDate, deliverable.filmingDate].some((date) => date && date >= range.from && date < range.to);
}

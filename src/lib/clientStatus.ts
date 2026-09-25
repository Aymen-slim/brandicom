import { ClientData, ClientStatus } from '@/types';

export const CLIENT_STATUSES: ClientStatus[] = ['active', 'starting', 'one_time', 'paused'];

const LEGACY_STATUS_MAP: Record<string, ClientStatus> = {
  potential: 'starting',
  churned: 'paused',
};

export function normalizeClientStatus(value: unknown): ClientStatus {
  const raw = typeof value === 'string' ? value.toLowerCase() : '';
  if (CLIENT_STATUSES.includes(raw as ClientStatus)) return raw as ClientStatus;
  if (LEGACY_STATUS_MAP[raw]) return LEGACY_STATUS_MAP[raw];
  return 'starting';
}

export const isClientStatus = (v: unknown): v is ClientStatus =>
  typeof v === 'string' && CLIENT_STATUSES.includes(v as ClientStatus);

/** Lower number = higher in the list. Paused clients sink to the bottom. */
export function clientStatusSortKey(status: ClientStatus | string): number {
  const normalized = normalizeClientStatus(status);
  switch (normalized) {
    case 'active':
      return 0;
    case 'starting':
      return 1;
    case 'one_time':
      return 2;
    case 'paused':
      return 3;
    default:
      return 1;
  }
}

export function sortClientsForDisplay<T extends Pick<ClientData, 'status' | 'createdAt'>>(clients: T[]): T[] {
  return [...clients].sort((a, b) => {
    const stageDiff = clientStatusSortKey(a.status) - clientStatusSortKey(b.status);
    if (stageDiff !== 0) return stageDiff;
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
}

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  active: 'Active',
  starting: 'Starting',
  one_time: 'One Time Work',
  paused: 'Paused',
};

export const CLIENT_STATUS_STYLES: Record<ClientStatus, { bg: string; text: string }> = {
  active: { bg: '#ecfdf5', text: '#047857' },
  starting: { bg: '#e0f2fe', text: '#0284c7' },
  one_time: { bg: '#ede9fe', text: '#6d28d9' },
  paused: { bg: '#fffbeb', text: '#b45309' },
};

export function clientStatusSelectStyle(status: ClientStatus | string) {
  const key = normalizeClientStatus(status);
  return CLIENT_STATUS_STYLES[key];
}

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, X } from 'lucide-react';
import { getProxiedImageUrl } from '@/lib/format';
import { SilentClientAlert } from '@/lib/postingSilence';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatAlertDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return `${day} ${MONTHS[month - 1] || ''} ${year}`;
}

function ClientMark({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const src = getProxiedImageUrl(logoUrl);
  const [failed, setFailed] = useState(false);
  return (
    <span
      style={{
        width: 52,
        height: 52,
        flexShrink: 0,
        borderRadius: 14,
        overflow: 'hidden',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fff',
        border: '1px solid #fecdd3',
        color: '#be123c',
        fontWeight: 800,
        fontSize: 16,
      }}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          width={52}
          height={52}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        name.slice(0, 2).toUpperCase()
      )}
    </span>
  );
}

export function SilentClientAlerts({ alerts }: { alerts: SilentClientAlert[] }) {
  const router = useRouter();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState('');
  const visible = alerts.filter((alert) => !hidden.has(`${alert.clientId}:${alert.gapKey}`));

  if (!visible.length && !error) return null;

  const closeAlert = async (alert: SilentClientAlert) => {
    const key = `${alert.clientId}:${alert.gapKey}`;
    setPending(key);
    setError('');
    setHidden((current) => new Set(current).add(key));
    try {
      const res = await fetch('/api/notifications/posting-silence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ clientId: alert.clientId, gapKey: alert.gapKey }),
      });
      if (!res.ok && res.status !== 404) throw new Error('Could not close this alert');
      router.refresh();
    } catch {
      setHidden((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
      setError('Could not close this alert. Try again.');
    } finally {
      setPending(null);
    }
  };

  return (
    <section
      aria-label="Clients without a recent post"
      style={{
        display: 'grid',
        gridTemplateColumns: visible.length > 1 ? 'repeat(auto-fit, minmax(380px, 1fr))' : '1fr',
        gap: 12,
        marginBottom: 18,
      }}
    >
      {error && (
        <div role="status" style={{ fontSize: 13, fontWeight: 700, color: '#9f1239', gridColumn: '1 / -1' }}>
          {error}
        </div>
      )}
      {visible.map((alert) => (
        <article
          key={`${alert.clientId}:${alert.gapKey}`}
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '14px 16px',
            borderRadius: 14,
            background: 'linear-gradient(135deg, #fff1f2 0%, #fff7ed 100%)',
            border: '1.5px solid #fda4af',
            boxShadow: '0 4px 14px rgba(225, 29, 72, 0.08)',
          }}
        >
          <ClientMark name={alert.name} logoUrl={alert.logoUrl} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#be123c', fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              <AlertTriangle size={14} aria-hidden="true" />
              Posting alert
            </div>
            <h2 style={{ margin: '2px 0 0', fontSize: 16, lineHeight: 1.25, fontWeight: 800, color: '#111827' }}>
              {alert.neverPosted ? `Nothing posted for ${alert.name}` : `No post for ${alert.name} in ${alert.daysSilent} days`}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#7f1d1d' }}>
              {alert.neverPosted
                ? `This active client has had no post for ${alert.daysSilent} days.`
                : `Last post ${formatAlertDate(alert.lastPostDate || '')}. More than 6 days with nothing published.`}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              <Link href={`/calendar?client=${alert.clientId}`} className="btn btn-sm" style={{ background: '#e11d48', color: '#fff', fontWeight: 700 }}>
                Schedule content
              </Link>
              <Link href={`/clients/${alert.clientId}`} className="btn btn-secondary btn-sm" style={{ fontWeight: 700 }}>
                Open client
              </Link>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-label={`Close alert for ${alert.name}`}
            title="Close alert"
            disabled={pending === `${alert.clientId}:${alert.gapKey}`}
            onClick={() => { void closeAlert(alert); }}
            style={{ color: '#9f1239', flexShrink: 0, padding: '4px' }}
          >
            <X size={16} />
          </button>
        </article>
      ))}
    </section>
  );
}

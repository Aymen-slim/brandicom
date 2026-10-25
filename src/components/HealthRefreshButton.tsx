'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

export function HealthRefreshButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/ai/health', { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Health refresh failed');
      setMessage(`Updated ${data.clients ?? 0} client${data.clients === 1 ? '' : 's'}.`);
      router.refresh();
    } catch (refreshError: any) {
      setError(refreshError?.message || 'Health refresh failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end' }}>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={refresh}
        disabled={busy}
        title="Recompute client health and AI summaries"
      >
        <RefreshCw size={12} className={busy ? 'animate-spin' : undefined} />
        {busy ? 'Refreshing…' : 'Refresh health'}
      </button>
      {message && <span style={{ fontSize: 10, color: '#047857' }}>{message}</span>}
      {error && <span style={{ fontSize: 10, color: '#b91c1c', maxWidth: 190, textAlign: 'right' }}>{error}</span>}
    </div>
  );
}

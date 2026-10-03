'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function WorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[WorkspaceError]', error); }, [error]);

  return (
    <div className="glass-card" role="alert" style={{ padding: 28, maxWidth: 540, margin: '24px auto' }}>
      <AlertTriangle size={24} color="#e11d48" />
      <h2 style={{ marginTop: 12 }}>This page could not be loaded</h2>
      <p style={{ margin: '12px 0', color: 'var(--text-secondary)' }}>Your navigation is still available. Retry the page or open another section.</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary btn-sm" onClick={reset}><RefreshCw size={14} /> Retry</button>
        <Link href="/dashboard" className="btn btn-secondary btn-sm">Dashboard</Link>
      </div>
    </div>
  );
}

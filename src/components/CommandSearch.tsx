'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

export function CommandSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any>({ clients: [], partners: [], deliverables: [], invoices: [] });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open || q.trim().length < 2) return;
    const t = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) setResults(await res.json());
    }, 200);
    return () => clearTimeout(t);
  }, [q, open]);

  if (!open) return null;

  const go = (href: string) => {
    setOpen(false);
    setQ('');
    router.push(href);
  };

  return (
    <div className="modal-overlay" onClick={() => setOpen(false)}>
      <div className="modal-container" style={{ padding: 16, maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#9ca3af' }} />
          <input
            autoFocus
            className="input-field"
            style={{ paddingLeft: 32 }}
            placeholder="Search clients, partners, posts…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 360, overflow: 'auto' }}>
          {results.clients.map((c: any) => (
            <button key={c.id} className="btn btn-ghost" style={{ justifyContent: 'flex-start' }} onClick={() => go(`/clients/${c.id}`)}>
              Client · {c.name}
            </button>
          ))}
          {results.partners.map((p: any) => (
            <button key={p.id} className="btn btn-ghost" style={{ justifyContent: 'flex-start' }} onClick={() => go('/partners')}>
              Partner · {p.name}
            </button>
          ))}
          {results.deliverables.map((d: any) => (
            <button key={d.id} className="btn btn-ghost" style={{ justifyContent: 'flex-start' }} onClick={() => go(`/clients/${d.client_id}`)}>
              Post · {d.idea}
            </button>
          ))}
          {results.invoices.map((i: any) => (
            <button key={i.id} className="btn btn-ghost" style={{ justifyContent: 'flex-start' }} onClick={() => go(`/finance/invoices/${i.id}`)}>
              Invoice · {i.number}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

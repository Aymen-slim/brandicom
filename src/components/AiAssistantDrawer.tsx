'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Markdown from 'react-markdown';
import { Sparkles, X, Send, Check, Ban } from 'lucide-react';

interface ChatItem {
  role: 'user' | 'assistant';
  content: string;
  proposal?: { proposalId: string; actions: unknown[]; summary?: string };
}

export function AiAssistantDrawer() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [items, setItems] = useState<ChatItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [selection, setSelection] = useState<string | null>(null);
  const [selPos, setSelPos] = useState<{ x: number; y: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const conversationId = useRef<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onMouseUp = () => {
      const sel = window.getSelection()?.toString().trim();
      if (sel && sel.length > 8 && sel.length < 2000) {
        const range = window.getSelection()?.getRangeAt(0);
        const rect = range?.getBoundingClientRect();
        setSelection(sel);
        if (rect) setSelPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
      } else {
        setSelPos(null);
      }
    };
    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [items, busy]);

  const clientId = pathname.match(/\/clients\/([0-9a-f-]{36})/i)?.[1] || null;

  const send = async (text: string, extra?: { selection?: string }) => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setStatusText(null);
    setItems((prev) => [...prev, { role: 'user', content: text.trim() }]);
    setInput('');
    setOpen(true);

    let assistant = '';
    let proposal: ChatItem['proposal'];
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          conversationId: conversationId.current,
          page: pathname,
          clientId,
          selection: extra?.selection || null,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed (${res.status})`);
      }
      if (!res.body) throw new Error('No stream');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() || '';
        for (const chunk of chunks) {
          const event = chunk.match(/^event: (.+)$/m)?.[1];
          const dataLine = chunk.match(/^data: (.+)$/m)?.[1];
          if (!event || !dataLine) continue;
          const data = JSON.parse(dataLine);
          if (event === 'meta' && data.conversationId) conversationId.current = data.conversationId;
          if (event === 'text') {
            setStatusText(null);
            assistant += data.text || '';
            setItems((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === 'assistant') last.content = assistant;
              else next.push({ role: 'assistant', content: assistant });
              return next;
            });
          }
          if (event === 'tool') {
            if (data.status === 'running') {
              const readable = String(data.name || '').replace(/_/g, ' ');
              setStatusText(`Querying ${readable}…`);
            } else if (data.status === 'done') {
              setStatusText(null);
              if (data.name === 'propose_changes' && data.result?.proposalId) {
                proposal = {
                  proposalId: data.result.proposalId,
                  actions: data.result.actions,
                  summary: data.result.summary,
                };
              }
            }
          }
          if (event === 'error') {
            setStatusText(null);
            const msg = data.message || 'AI request failed.';
            assistant = assistant ? `${assistant}\n\n⚠️ ${msg}` : `⚠️ ${msg}`;
            setItems((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === 'assistant') last.content = assistant;
              else next.push({ role: 'assistant', content: assistant });
              return next;
            });
          }
        }
      }
      if (proposal) {
        setItems((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === 'assistant') last.proposal = proposal;
          else next.push({ role: 'assistant', content: assistant, proposal });
          return next;
        });
      }
    } catch (err: any) {
      setItems((prev) => [...prev, { role: 'assistant', content: `Sorry, the assistant failed: ${err?.message || 'Check GEMINI_API_KEY.'}` }]);
    } finally {
      setStatusText(null);
      setBusy(false);
    }
  };

  const applyProposal = async (id: string, action: 'apply' | 'reject') => {
    const res = await fetch(`/api/ai/proposals/${id}?action=${action}`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const createdClient = Array.isArray(data.results)
        ? data.results.find((r: any) => r?.type === 'create_client' && r?.id)
        : null;

      setItems((prev) =>
        prev.map((m) =>
          m.proposal?.proposalId === id
            ? {
                ...m,
                content:
                  m.content +
                  `\n\n_${action === 'apply' ? '✓ Applied successfully' : 'Rejected'}._` +
                  (createdClient ? `\n\n👉 **[Open ${createdClient.name || 'Client'} Workspace →](/clients/${createdClient.id})**` : ''),
                proposal: undefined,
              }
            : m
        )
      );
    }
  };

  if (pathname === '/login') return null;

  return (
    <>
      {selPos && selection && (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          style={{
            position: 'fixed',
            left: selPos.x,
            top: selPos.y,
            transform: 'translate(-50%, -100%)',
            zIndex: 80,
          }}
          onClick={() => {
            send(`Explain or act on this selected text:\n${selection}`, { selection });
            setSelPos(null);
          }}
        >
          <Sparkles size={12} /> Ask AI
        </button>
      )}

      <button
        type="button"
        aria-label="Ask AI"
        onClick={() => setOpen(true)}
        className="btn btn-primary"
        style={{
          position: 'fixed',
          right: 20,
          bottom: 20,
          zIndex: 50,
          borderRadius: 999,
          width: 48,
          height: 48,
          padding: 0,
          display: open ? 'none' : 'inline-flex',
        }}
      >
        <Sparkles size={18} />
      </button>

      {open && (
        <>
          <div
            className="sidebar-backdrop open"
            style={{ zIndex: 69 }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              width: 'min(420px, 100vw)',
              height: '100vh',
              background: '#fff',
              borderLeft: '1px solid #eaedf0',
              zIndex: 70,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-8px 0 24px rgba(0,0,0,0.12)',
            }}
          >
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #eaedf0', display: 'flex', justifyContent: 'space-between' }}>
            <strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={14} color="#8b5cf6" /> Ask Brandicom
            </strong>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
              <X size={16} />
            </button>
          </div>
          <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.length === 0 && (
              <div style={{ fontSize: 13, color: '#6b7280' }}>
                Ask anything about clients, posts, partners
                {pathname.startsWith('/finance') ? ', or finance' : ''}. Changes require your confirmation.
              </div>
            )}
            {items.map((item, i) => (
              <div
                key={i}
                style={{
                  alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start',
                  background: item.role === 'user' ? '#111827' : '#f3f4f6',
                  color: item.role === 'user' ? '#fff' : '#111827',
                  padding: '8px 12px',
                  borderRadius: 12,
                  maxWidth: '92%',
                  fontSize: 13,
                }}
              >
                {item.role === 'assistant' ? <Markdown>{item.content}</Markdown> : item.content}
                {item.proposal && (
                  <div style={{ marginTop: 8, background: '#fff', color: '#111', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                      {item.proposal.summary || 'Proposed changes'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '8px 0' }}>
                      {(item.proposal.actions as any[]).map((act, actIdx) => {
                        if (act?.type === 'create_client') {
                          const servicesList = Array.isArray(act.services)
                            ? act.services
                            : typeof act.services === 'string'
                            ? act.services.split(',').map((s: string) => s.trim()).filter(Boolean)
                            : [];

                          return (
                            <div
                              key={actIdx}
                              style={{
                                background: '#f8fafc',
                                border: '1.5px solid #e2e8f0',
                                borderRadius: 8,
                                padding: 10,
                                fontSize: 12,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                <strong style={{ fontSize: 13.5, color: '#0f172a' }}>🏢 {act.name}</strong>
                                {act.status && (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 800,
                                      textTransform: 'uppercase',
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                      backgroundColor: '#dbeafe',
                                      color: '#1e40af',
                                    }}
                                  >
                                    {act.status}
                                  </span>
                                )}
                              </div>

                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6, color: '#475569', fontSize: 11.5 }}>
                                {act.industry && <span>🏷️ <strong>Industry:</strong> {act.industry}</span>}
                                {act.location && <span>📍 <strong>Location:</strong> {act.location}</span>}
                                {act.monthlyFee != null && (
                                  <span style={{ color: '#047857', fontWeight: 700 }}>
                                    💰 {act.monthlyFee} DT / mo
                                  </span>
                                )}
                              </div>

                              {(act.contactName || act.contactPhone || act.contactEmail) && (
                                <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed #cbd5e1', fontSize: 11.5, color: '#334155' }}>
                                  👤 <strong>{act.contactName || 'Contact'}</strong>
                                  {act.contactPhone && ` • 📞 ${act.contactPhone}`}
                                  {act.contactEmail && ` • ✉️ ${act.contactEmail}`}
                                </div>
                              )}

                              {servicesList.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                                  {servicesList.map((svc: string, sIdx: number) => (
                                    <span
                                      key={sIdx}
                                      style={{
                                        fontSize: 10.5,
                                        backgroundColor: '#e2e8f0',
                                        color: '#334155',
                                        padding: '1px 6px',
                                        borderRadius: 4,
                                        fontWeight: 600,
                                      }}
                                    >
                                      {svc}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {act.notes && (
                                <div style={{ fontSize: 11, color: '#64748b', marginTop: 6, fontStyle: 'italic' }}>
                                  &ldquo;{act.notes}&rdquo;
                                </div>
                              )}
                            </div>
                          );
                        }

                        return (
                          <pre
                            key={actIdx}
                            style={{
                              fontSize: 11,
                              background: '#f9fafb',
                              border: '1px solid #e5e7eb',
                              padding: 8,
                              borderRadius: 6,
                              whiteSpace: 'pre-wrap',
                              margin: 0,
                            }}
                          >
                            {JSON.stringify(act, null, 2)}
                          </pre>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => applyProposal(item.proposal!.proposalId, 'apply')}>
                        <Check size={12} /> Confirm & Create
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyProposal(item.proposal!.proposalId, 'reject')}>
                        <Ban size={12} /> Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={13} className="animate-spin" color="#8b5cf6" />
                <span>{statusText || 'Thinking…'}</span>
              </div>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            style={{ padding: 12, borderTop: '1px solid #eaedf0', display: 'flex', gap: 8 }}
          >
            <input
              className="input-field"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about this page…"
            />
            <button type="submit" className="btn btn-primary" disabled={busy}>
              <Send size={14} />
            </button>
          </form>
        </aside>
        </>
      )}
    </>
  );
}

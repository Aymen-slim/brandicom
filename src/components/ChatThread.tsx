'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MessageData, UserSummary } from '@/types';
import { Send, ExternalLink, Lightbulb } from 'lucide-react';

interface ChatThreadProps {
  clientId: string;
  initialMessages?: MessageData[];
  user?: UserSummary | null;
  onSaveInspiration?: (url: string) => void;
}

export function ChatThread({ clientId, initialMessages = [], user: currentUser, onSaveInspiration }: ChatThreadProps) {

  const [messages, setMessages] = useState<MessageData[]>(initialMessages);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [loading, setLoading] = useState(initialMessages.length === 0);
  const [loadError, setLoadError] = useState('');
  const [hasOlder, setHasOlder] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const prepending = useRef(false);
  const olderRequest = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastTimestampRef = useRef<string | null>(
    initialMessages.length > 0
      ? initialMessages[initialMessages.length - 1].createdAt
      : null
  );

  const lastIdRef = useRef<string | null>(initialMessages.length ? initialMessages[initialMessages.length - 1].id : null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (prepending.current) prepending.current = false;
    else scrollToBottom();
  }, [messages.length]);

  // Polling mechanism every 4.5 seconds (Section 6)
  useEffect(() => {
    let active = true;
    let request: AbortController | null = null;
    const poll = async () => {
      if (!active || request || document.visibilityState !== 'visible') return;
      const controller = new AbortController();
      request = controller;
      try {
        const firstRead = !lastTimestampRef.current;
        const url = lastTimestampRef.current
          ? `/api/clients/${clientId}/messages?since=${encodeURIComponent(lastTimestampRef.current)}${lastIdRef.current ? `&cursorId=${encodeURIComponent(lastIdRef.current)}` : ''}`
          : `/api/clients/${clientId}/messages?recent=1`;
        const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        if (!res.ok) throw new Error('Could not load messages');
        const rows: MessageData[] = await res.json();
        if (!active) return;
        setLoadError('');
        if (firstRead) setHasOlder(rows.length === 100);
        if (rows.length) {
          lastTimestampRef.current = rows[rows.length - 1].createdAt;
          lastIdRef.current = rows[rows.length - 1].id;
          setMessages((previous) => Array.from(new Map([...previous, ...rows].map((row) => [row.id, row])).values())
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)));
        }
      } catch (err) {
        if (active && !controller.signal.aborted) {
          console.error('Polling error:', err);
          setLoadError('Could not load messages. Retrying while this chat is open.');
        }
      } finally {
        request = null;
        if (active) setLoading(false);
      }
    };
    void poll();
    const interval = setInterval(() => { void poll(); }, 4500);
    const onVisible = () => { void poll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      request?.abort();
      olderRequest.current?.abort();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [clientId]);

  const loadOlder = async () => {
    if (!messages.length || loadingOlder) return;
    olderRequest.current?.abort();
    const controller = new AbortController();
    olderRequest.current = controller;
    setLoadingOlder(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/messages?before=${encodeURIComponent(messages[0].createdAt)}&cursorId=${encodeURIComponent(messages[0].id)}`, { signal: controller.signal, cache: 'no-store' });
      if (!res.ok) throw new Error('Could not load older messages');
      const rows: MessageData[] = await res.json();
      if (controller.signal.aborted) return;
      prepending.current = rows.length > 0;
      setHasOlder(rows.length === 100);
      setMessages((previous) => Array.from(new Map([...rows, ...previous].map((row) => [row.id, row])).values()));
    } catch {
      if (!controller.signal.aborted) setLoadError('Could not load older messages. Please try again.');
    } finally {
      if (!controller.signal.aborted) setLoadingOlder(false);
    }
  };

  // Send message with optimistic update
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || isSending) return;

    setInputText('');
    setIsSending(true);

    const tempId = `temp-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const optimisticMessage: MessageData = {
      id: tempId,
      clientId,
      senderId: currentUser?.id || 'current',
      body: text,
      createdAt: nowIso,
      sender: {
        id: currentUser?.id || '',
        name: currentUser?.name || 'You',
        email: currentUser?.email || '',
        role: currentUser?.role || 'member',
      },
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const res = await fetch(`/api/clients/${clientId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });

      if (!res.ok) throw new Error('Could not send message');
      const savedMessage: MessageData = await res.json();
      setMessages((previous) => [...previous.filter((message) => message.id !== tempId && message.id !== savedMessage.id), savedMessage]
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)));
      lastTimestampRef.current = savedMessage.createdAt;
      lastIdRef.current = savedMessage.id;
      setLoadError('');
    } catch (err) {
      setMessages((previous) => previous.filter((message) => message.id !== tempId));
      setInputText((previous) => previous || text);
      setLoadError('Could not send your message. Your draft has been restored.');
      console.error('Error sending message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const formatMessageTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const renderMessageBody = (body: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = body.split(urlRegex);

    return parts.map((part, idx) => {
      if (part.match(urlRegex)) {
        const isVideoOrReel = /(instagram\.com|tiktok\.com|youtube\.com|youtu\.be)/i.test(part);
        return (
          <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', margin: '2px 0' }}>
            <a
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#4338ca',
                fontWeight: 600,
                textDecoration: 'underline',
                wordBreak: 'break-all',
              }}
            >
              {part} <ExternalLink size={10} style={{ display: 'inline', marginLeft: 2 }} />
            </a>
            {isVideoOrReel && onSaveInspiration && (
              <button
                type="button"
                onClick={() => onSaveInspiration(part)}
                className="btn btn-ghost btn-xs"
                style={{
                  padding: '1px 5px',
                  fontSize: '9.5px',
                  color: '#db2777',
                  backgroundColor: '#fdf2f8',
                  borderRadius: 4,
                  border: '1px solid #fbcfe8',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  cursor: 'pointer',
                }}
                title="Save this video/reel link to client inspiration ideas"
              >
                <Lightbulb size={9} /> Save to Inspiration
              </button>
            )}
          </span>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  return (
    <div
      className="glass-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '480px',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: '#111827' }}>
            Client Team Chat
          </h4>
          <p style={{ fontSize: '11px', color: '#6b7280' }}>
            Internal notes & async deliverables sync
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '11px',
            color: '#059669',
            fontWeight: 500,
          }}
        >
          <span
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
            }}
          />
          Live polling
        </div>
      </div>

      {/* Messages list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {loadError && <div role="alert" style={{ fontSize: 12, color: '#be123c' }}>{loadError}</div>}
        {hasOlder && messages.length > 0 && <button type="button" className="btn btn-secondary btn-sm" disabled={loadingOlder} onClick={loadOlder}>{loadingOlder ? 'Loading history...' : 'Load older messages'}</button>}
        {messages.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--text-muted)',
              margin: 'auto',
              fontSize: '12.5px',
            }}
          >
            {loading ? 'Loading messages...' : 'No messages yet. Post a brief note or update below.'}
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.senderId === currentUser?.id;
            const senderName = m.sender?.name || (isMe ? 'You' : 'Team Member');
            const senderRole = m.sender?.role || 'member';

            return (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  gap: '8px',
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '82%',
                }}
              >
                {!isMe && (
                  <div
                    className="avatar"
                    style={{
                      width: '26px',
                      height: '26px',
                      fontSize: '10px',
                      flexShrink: 0,
                      borderRadius: '50%',
                    }}
                  >
                    {senderName.slice(0, 2).toUpperCase()}
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isMe ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      marginBottom: '2px',
                    }}
                  >
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#4b5563' }}>
                      {senderName}
                    </span>
                    <span
                      style={{
                        fontSize: '9.5px',
                        padding: '0 4px',
                        borderRadius: '3px',
                        backgroundColor: senderRole === 'admin' ? '#f3e8ff' : '#ecfdf5',
                        color: senderRole === 'admin' ? '#7e22ce' : '#047857',
                        fontWeight: 600,
                        textTransform: 'capitalize',
                      }}
                    >
                      {senderRole}
                    </span>
                    <span style={{ fontSize: '10px', color: '#9ca3af' }}>
                      {formatMessageTime(m.createdAt)}
                    </span>
                  </div>

                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: isMe ? '#eff6ff' : '#f3f4f6',
                      border: isMe ? '1px solid #dbeafe' : '1px solid #e5e7eb',
                      color: '#111827',
                      fontSize: '12.5px',
                      lineHeight: 1.45,
                      wordBreak: 'break-word',
                    }}
                  >
                    {renderMessageBody(m.body)}
                  </div>
                </div>

                {isMe && (
                  <div
                    className="avatar"
                    style={{
                      width: '26px',
                      height: '26px',
                      fontSize: '10px',
                      flexShrink: 0,
                      borderRadius: '50%',
                      backgroundColor: '#111827',
                      color: '#fff',
                    }}
                  >
                    {senderName.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input box */}
      <form
        onSubmit={handleSend}
        style={{
          padding: '10px 14px',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: '#ffffff',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
        }}
      >
        <input
          type="text"
          placeholder="Send a team message..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="input-field"
          style={{ flex: 1, padding: '6px 12px' }}
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isSending}
          className="btn btn-primary"
          style={{ padding: '7px 12px' }}
        >
          <Send size={13} />
        </button>
      </form>
    </div>
  );
}

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastTimestampRef = useRef<string | null>(
    initialMessages.length > 0
      ? initialMessages[initialMessages.length - 1].createdAt
      : null
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  // Polling mechanism every 4.5 seconds (Section 6)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const url = lastTimestampRef.current
          ? `/api/clients/${clientId}/messages?since=${encodeURIComponent(lastTimestampRef.current)}`
          : `/api/clients/${clientId}/messages`;

        const res = await fetch(url);
        if (res.ok) {
          const newMessages: MessageData[] = await res.json();
          if (newMessages.length > 0) {
            setMessages((prev) => {
              const existingIds = new Set(prev.map((m) => m.id));
              const filtered = newMessages.filter((m) => !existingIds.has(m.id));
              if (filtered.length === 0) return prev;

              const updated = [...prev, ...filtered];
              lastTimestampRef.current = updated[updated.length - 1].createdAt;
              return updated;
            });
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 4500);

    return () => clearInterval(interval);
  }, [clientId]);

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

      if (res.ok) {
        const savedMessage: MessageData = await res.json();
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? savedMessage : m))
        );
        lastTimestampRef.current = savedMessage.createdAt;
      }
    } catch (err) {
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
        {messages.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--text-muted)',
              margin: 'auto',
              fontSize: '12.5px',
            }}
          >
            No messages yet. Post a brief note or update below.
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

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  Copy,
  History,
  MessageSquare,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import remarkGfm from 'remark-gfm';
import type { ChatItem, ConversationSummary, ProposalView, UsageSnapshot } from '@/lib/ai/chatTypes';
import { ProposalCard } from './ai/ProposalCard';

const Markdown = dynamic(() => import('react-markdown'), { ssr: false });

const STORAGE_KEY = 'brandicom:ai:conversation';

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `ai-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function pageLabel(pathname: string): string {
  if (pathname.startsWith('/clients/')) return 'Client workspace';
  if (pathname.startsWith('/clients')) return 'Clients';
  if (pathname.startsWith('/calendar')) return 'Content calendar';
  if (pathname.startsWith('/finance')) return 'Finance';
  if (pathname.startsWith('/leads')) return 'Leads';
  if (pathname.startsWith('/partners')) return 'Partners';
  if (pathname.startsWith('/inspirations')) return 'Inspirations';
  if (pathname === '/dashboard') return 'Dashboard';
  return 'Workspace';
}

function suggestionsFor(pathname: string): Array<{ label: string; prompt: string }> {
  if (pathname.startsWith('/clients/')) {
    return [
      { label: 'Summarize this client', prompt: 'Give me a concise health and performance summary for this client.' },
      { label: 'What should I do next?', prompt: 'What are the three highest-impact actions for this client right now?' },
      { label: 'Plan next month', prompt: 'Draft a content plan for this client for next month using their goals and recent performance.' },
      { label: 'Review content', prompt: 'Which recent posts performed best and what should we repeat?' },
    ];
  }
  if (pathname.startsWith('/calendar')) {
    return [
      { label: 'What is due next?', prompt: 'What filming and publishing is due in the next 14 days? Flag anything at risk.' },
      { label: 'Find gaps', prompt: 'Find gaps or conflicts in the content calendar for the next two weeks.' },
      { label: 'Plan next week', prompt: 'Build a practical shooting and publishing plan for next week.' },
    ];
  }
  if (pathname.startsWith('/finance')) {
    return [
      { label: 'Cash snapshot', prompt: 'Summarize cash received, outstanding invoices and overdue invoices for this period.' },
      { label: 'Biggest expenses', prompt: 'Show the largest expenses this period and any unusual changes.' },
      { label: 'Profit check', prompt: 'How is profit tracking against target this period?' },
    ];
  }
  if (pathname.startsWith('/leads')) {
    return [
      { label: 'Prioritize leads', prompt: 'Prioritize the open leads and explain what to do first.' },
      { label: 'Draft a reply', prompt: 'Draft a warm reply to the most recent lead asking about services and budget.' },
    ];
  }
  if (pathname.startsWith('/dashboard')) {
    return [
      { label: 'What needs attention?', prompt: 'What needs my attention today? Focus on risks and overdue work.' },
      { label: 'At-risk clients', prompt: 'Which clients are at risk and what should I do about each one?' },
      { label: 'Explain this month', prompt: 'Explain how this month is tracking against goals and what is driving the numbers.' },
    ];
  }
  return [
    { label: 'Daily briefing', prompt: 'Give me a short daily briefing: priorities, risks and what changed.' },
    { label: 'At-risk clients', prompt: 'Which clients are at risk right now and why?' },
    { label: 'Content performance', prompt: 'Summarize this month’s content performance and the best next actions.' },
  ];
}

function formatReset(resetAt?: string): string {
  if (!resetAt) return '';
  try {
    return new Date(resetAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function quotaMessage(data: any): string {
  const reset = formatReset(data?.resetAt);
  const limit = data?.limit ? ` of ${data.limit} requests` : '';
  return `You have reached the daily AI limit${limit}.${reset ? ` It resets around ${reset}.` : ''}`;
}

export function AiAssistantDrawer({ initialOpen = false }: { initialOpen?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(initialOpen);
  const [input, setInput] = useState('');
  const [items, setItems] = useState<ChatItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [selection, setSelection] = useState<string | null>(null);
  const [selPos, setSelPos] = useState<{ x: number; y: number } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [busyProposalId, setBusyProposalId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const conversationId = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sendSeqRef = useRef(0);
  const restoredRef = useRef(false);
  const stickToBottom = useRef(true);

  const clientId = pathname.match(/\/clients\/([0-9a-f-]{36})/i)?.[1] || null;
  const suggestions = useMemo(() => suggestionsFor(pathname), [pathname]);
  const exhausted = Boolean(usage && usage.limit > 0 && usage.remaining <= 0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => textareaRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open || restoredRef.current) return;
    restoredRef.current = true;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) void loadConversation(saved, { silent: true });
    void refreshUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!stickToBottom.current) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'auto' });
  }, [items, busy, statusText]);

  useEffect(() => {
    const onMouseUp = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-ai-drawer]')) return;
      const selected = window.getSelection()?.toString().trim();
      if (selected && selected.length > 8 && selected.length < 2000) {
        const selectionObject = window.getSelection();
        const rect =
          selectionObject && selectionObject.rangeCount > 0
            ? selectionObject.getRangeAt(0).getBoundingClientRect()
            : null;
        setSelection(selected);
        if (rect) setSelPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
      } else {
        setSelPos(null);
      }
    };
    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (historyOpen) setHistoryOpen(false);
        else setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, historyOpen]);

  function patchItem(id: string, patch: (item: ChatItem) => ChatItem) {
    setItems((current) => current.map((item) => (item.id === id ? patch(item) : item)));
  }

  function updateProposal(itemId: string, updater: (proposal: ProposalView) => ProposalView) {
    patchItem(itemId, (item) =>
      item.proposal ? { ...item, proposal: updater(item.proposal) } : item
    );
  }

  async function refreshUsage() {
    try {
      const response = await fetch('/api/ai/usage', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      if (data?.usage) setUsage(data.usage);
    } catch {
      // Usage is non-critical.
    }
  }

  async function loadHistory() {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const response = await fetch('/api/ai/conversations', { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (response.ok) setConversations(Array.isArray(data.conversations) ? data.conversations : []);
      else setErrorBanner(data.error || 'Could not load chat history.');
    } catch (error: any) {
      setErrorBanner(error?.message || 'Could not load chat history.');
    } finally {
      setHistoryLoading(false);
    }
  }

  async function loadConversation(id: string, options?: { silent?: boolean }) {
    abortRef.current?.abort();
    abortRef.current = null;
    if (!options?.silent) setHistoryOpen(false);
    setLoadingConversation(true);
    setErrorBanner(null);
    try {
      const response = await fetch(`/api/ai/conversations/${id}`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 404 && options?.silent) {
          window.localStorage.removeItem(STORAGE_KEY);
          conversationId.current = null;
          return;
        }
        throw new Error(data.error || 'Could not load this chat.');
      }

      const mapped: ChatItem[] = (Array.isArray(data.messages) ? data.messages : [])
        .filter((message: any) => message.role === 'user' || message.role === 'assistant')
        .map((message: any) => ({
          id: message.id || makeId(),
          role: message.role,
          content: message.content || '',
          createdAt: message.createdAt,
          tools: Array.isArray(message.tools) ? message.tools : [],
          proposal: message.proposal
            ? {
                ...message.proposal,
                status: message.proposal.status,
                needsConfirmation:
                  message.proposal.status === 'pending' &&
                  !message.proposal.autoApplied &&
                  message.proposal.needsConfirmation !== false,
              }
            : undefined,
        }));

      conversationId.current = id;
      window.localStorage.setItem(STORAGE_KEY, id);
      stickToBottom.current = true;
      setItems(mapped);
      setOpen(true);
    } catch (error: any) {
      if (!options?.silent) setErrorBanner(error?.message || 'Could not load this chat.');
    } finally {
      setLoadingConversation(false);
    }
  }

  async function deleteConversation(id: string) {
    if (!window.confirm('Delete this chat? This cannot be undone.')) return;
    try {
      const response = await fetch(`/api/ai/conversations/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not delete this chat.');
      setConversations((current) => current.filter((conversation) => conversation.id !== id));
      if (conversationId.current === id) newChat();
    } catch (error: any) {
      setErrorBanner(error?.message || 'Could not delete this chat.');
    }
  }

  function newChat() {
    abortRef.current?.abort();
    abortRef.current = null;
    conversationId.current = null;
    window.localStorage.removeItem(STORAGE_KEY);
    stickToBottom.current = true;
    setItems([]);
    setInput('');
    setBusy(false);
    setStatusText(null);
    setHistoryOpen(false);
    setErrorBanner(null);
    setOpen(true);
    window.setTimeout(() => textareaRef.current?.focus(), 60);
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function send(text: string, extra?: { selection?: string }) {
    const message = text.trim();
    if (!message || busy || abortRef.current) return;

    const seq = ++sendSeqRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    const assistantId = makeId();
    const userItem: ChatItem = { id: makeId(), role: 'user', content: message };
    const assistantItem: ChatItem = {
      id: assistantId,
      role: 'assistant',
      content: '',
      streaming: true,
      tools: [],
    };

    setItems((current) => [...current, userItem, assistantItem]);
    stickToBottom.current = true;
    setInput('');
    setBusy(true);
    setStatusText('Thinking…');
    setErrorBanner(null);
    setOpen(true);

    let assistantText = '';
    let sawEvent = false;

    const setAssistantContent = (next: string, error = false) => {
      assistantText = next;
      patchItem(assistantId, (item) => ({ ...item, content: next, error }));
    };

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message,
          conversationId: conversationId.current,
          page: pathname,
          clientId,
          selection: extra?.selection || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 429) {
          setUsage((current) =>
            current
              ? { ...current, used: data.used ?? current.used, limit: data.limit ?? current.limit, remaining: 0 }
              : {
                  used: data.used || 0,
                  limit: data.limit || 0,
                  remaining: 0,
                  resetAt: data.resetAt,
                }
          );
        }
        throw new Error(response.status === 429 ? quotaMessage(data) : data.error || `Request failed (${response.status})`);
      }
      if (!response.body) throw new Error('The assistant did not return a response stream.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const handleEvent = (event: string, data: any) => {
        sawEvent = true;
        if (event === 'meta') {
          if (data?.conversationId) {
            conversationId.current = data.conversationId;
            window.localStorage.setItem(STORAGE_KEY, data.conversationId);
          }
          if (data?.usage) setUsage(data.usage);
          return;
        }
        if (event === 'delta') {
          setStatusText(null);
          setAssistantContent(assistantText + (data.text || ''));
          return;
        }
        // Compatibility with pre-streaming servers.
        if (event === 'text') {
          setStatusText(null);
          setAssistantContent(assistantText + (data.text || ''));
          return;
        }
        if (event === 'tool') {
          if (data.status === 'running') {
            const readable = String(data.name || 'data').replace(/_/g, ' ');
            setStatusText(`Looking up ${readable}…`);
          } else {
            setStatusText(null);
            patchItem(assistantId, (item) => ({
              ...item,
              tools: [
                ...(item.tools || []).filter((tool) => tool.name !== data.name),
                { name: data.name, status: data.status, summary: data.summary },
              ],
            }));
          }
          return;
        }
        if (event === 'proposal' && data) {
          patchItem(assistantId, (item) => ({ ...item, proposal: data as ProposalView }));
          return;
        }
        if (event === 'done') {
          if (data?.conversationId) {
            conversationId.current = data.conversationId;
            window.localStorage.setItem(STORAGE_KEY, data.conversationId);
          }
          if (data?.usage) setUsage(data.usage);
          patchItem(assistantId, (item) => ({ ...item, streaming: false }));
          return;
        }
        if (event === 'error') {
          const message = data?.message || 'The assistant failed. Please try again.';
          setAssistantContent(assistantText ? `${assistantText}\n\n${message}` : message, true);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split(/\r?\n\r?\n/);
        buffer = chunks.pop() || '';
        for (const chunk of chunks) {
          const lines = chunk.split(/\r?\n/);
          const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim();
          const dataLine = lines.find((line) => line.startsWith('data:'))?.slice(5).trim();
          if (!event || !dataLine) continue;
          try {
            handleEvent(event, JSON.parse(dataLine));
          } catch {
            // Ignore malformed chunks; the next chunk can still be valid.
          }
        }
      }

      if (buffer.trim()) {
        const lines = buffer.split(/\r?\n/);
        const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim();
        const dataLine = lines.find((line) => line.startsWith('data:'))?.slice(5).trim();
        if (event && dataLine) {
          try {
            handleEvent(event, JSON.parse(dataLine));
          } catch {
            // Ignore a malformed trailing chunk.
          }
        }
      }

      if (!sawEvent && !assistantText) {
        setAssistantContent('The assistant did not return a response. Please try again.', true);
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        setAssistantContent(assistantText ? `${assistantText}\n\n_Stopped._` : '_Stopped._');
      } else {
        setAssistantContent(
          assistantText
            ? `${assistantText}\n\n${error?.message || 'The assistant failed.'}`
            : error?.message || 'The assistant failed. Please try again.',
          true
        );
      }
    } finally {
      patchItem(assistantId, (item) => ({ ...item, streaming: false }));
      if (seq === sendSeqRef.current) {
        setStatusText(null);
        setBusy(false);
        if (abortRef.current === controller) abortRef.current = null;
      }
    }
  }

  async function applyProposal(itemId: string, proposal: ProposalView, indices: number[]) {
    if (!proposal.proposalId) {
      setErrorBanner('This proposal cannot be applied because it was not saved. Ask the assistant again.');
      return;
    }
    setBusyProposalId(proposal.proposalId);
    setErrorBanner(null);
    try {
      const response = await fetch(`/api/ai/proposals/${proposal.proposalId}?action=apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indices }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not apply these changes.');

      const failures = (Array.isArray(data.results) ? data.results : []).filter(
        (result: any) => !result.ok
      );
      if (failures.length > 0) {
        setErrorBanner(
          failures
            .map((result: any) => result.error || 'One of the selected changes failed.')
            .join(' ')
        );
      }

      updateProposal(itemId, (current) => {
        const appliedCount = (data.results || []).filter((result: any) => result.ok).length;
        return {
          ...current,
          summary:
            data.remaining > 0
              ? `${current.summary || 'Proposed changes'} — ${appliedCount} applied, ${data.remaining} remaining`
              : current.summary,
          status: data.remaining > 0 ? 'pending' : appliedCount > 0 ? 'applied' : 'failed',
          appliedAt: data.remaining > 0 || appliedCount === 0 ? null : new Date().toISOString(),
          needsConfirmation: data.remaining > 0,
          actions: data.remaining > 0 && Array.isArray(data.remainingActions) ? data.remainingActions : current.actions,
          results: data.remaining > 0 ? [] : data.results || [],
          undo: data.remaining > 0 ? [...(current.undo || []), ...(data.undo || [])] : data.undo || [],
        };
      });
    } catch (error: any) {
      setErrorBanner(error?.message || 'Could not apply these changes.');
    } finally {
      setBusyProposalId(null);
    }
  }

  async function rejectProposal(itemId: string, proposal: ProposalView) {
    if (!proposal.proposalId) return;
    setBusyProposalId(proposal.proposalId);
    setErrorBanner(null);
    try {
      const response = await fetch(`/api/ai/proposals/${proposal.proposalId}?action=reject`, {
        method: 'POST',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not reject this proposal.');
      updateProposal(itemId, (current) => ({
        ...current,
        status: 'rejected',
        needsConfirmation: false,
      }));
    } catch (error: any) {
      setErrorBanner(error?.message || 'Could not reject this proposal.');
    } finally {
      setBusyProposalId(null);
    }
  }

  async function undoProposal(itemId: string, proposal: ProposalView) {
    const actions = proposal.undo || [];
    if (actions.length === 0) return;
    setBusyProposalId(proposal.proposalId || 'undo');
    setErrorBanner(null);
    try {
      const response = await fetch('/api/ai/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actions, proposalId: proposal.proposalId || null }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not undo these changes.');
      const failed = (data.results || []).filter((result: any) => !result.ok);
      const failedKeys = new Set(
        failed.map((result: any) => `${result.type}:${result.id || result.deliverableId || ''}`)
      );
      updateProposal(itemId, (current) => {
        const stillPending = current.status === 'pending' || Boolean(current.needsConfirmation);
        return {
          ...current,
          status: failed.length > 0 ? current.status : stillPending ? 'pending' : 'reverted',
          needsConfirmation: failed.length > 0 ? current.needsConfirmation : stillPending,
          undo:
            failed.length > 0
              ? (current.undo || []).filter((action) =>
                  failedKeys.has(`${action.type}:${action.deliverableId || ''}`)
                )
              : [],
        };
      });
      if (failed.length > 0) {
        setErrorBanner(failed.map((result: any) => result.error || 'An undo failed.').join(' '));
      }
    } catch (error: any) {
      setErrorBanner(error?.message || 'Could not undo these changes.');
    } finally {
      setBusyProposalId(null);
    }
  }

  async function copyMessage(item: ChatItem) {
    try {
      await navigator.clipboard.writeText(item.content);
      setCopiedId(item.id);
      window.setTimeout(() => setCopiedId((current) => (current === item.id ? null : current)), 1600);
    } catch {
      setErrorBanner('Could not copy to clipboard.');
    }
  }

  function retryFrom(index: number) {
    if (busy) return;
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      if (items[cursor].role === 'user') {
        void send(items[cursor].content);
        return;
      }
    }
  }

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
            zIndex: 95,
            boxShadow: '0 8px 22px rgba(79, 70, 229, 0.28)',
          }}
          onClick={() => {
            void send(`Explain or act on this selected text:\n\n${selection}`, { selection });
            setSelPos(null);
          }}
        >
          <Sparkles size={12} /> Ask AI
        </button>
      )}

      <button
        type="button"
        aria-label="Open Brandicom AI assistant"
        aria-expanded={open}
        aria-controls="ai-assistant-panel"
        title="Ask Brandicom AI (Ctrl/⌘ J)"
        onClick={() => setOpen(true)}
        className="btn btn-primary"
        style={{
          position: 'fixed',
          right: 20,
          bottom: 20,
          zIndex: 50,
          borderRadius: 999,
          width: 50,
          height: 50,
          padding: 0,
          display: open ? 'none' : 'inline-flex',
          boxShadow: '0 12px 28px rgba(79, 70, 229, 0.34)',
        }}
      >
        <Sparkles size={19} />
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
            id="ai-assistant-panel"
            ref={panelRef}
            data-ai-drawer
            role="dialog"
            aria-modal="true"
            aria-label="Brandicom AI assistant"
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              width: 'min(460px, 100vw)',
              height: '100dvh',
              background: '#fff',
              borderLeft: '1px solid #eaedf0',
              zIndex: 70,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-12px 0 34px rgba(15, 23, 42, 0.16)',
            }}
          >
            <header
              style={{
                padding: '12px 14px',
                borderBottom: '1px solid #eaedf0',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                background: 'linear-gradient(180deg, #fbfaff 0%, #ffffff 100%)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <strong style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5 }}>
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                      color: '#fff',
                      boxShadow: '0 3px 10px rgba(79, 70, 229, 0.3)',
                    }}
                  >
                    <Sparkles size={14} />
                  </span>
                  Ask Brandicom
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', background: '#f1f5f9', padding: '2px 6px', borderRadius: 999 }}>
                    {pageLabel(pathname)}
                  </span>
                </strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={newChat} title="New chat" aria-label="New chat">
                    <Plus size={15} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => (historyOpen ? setHistoryOpen(false) : void loadHistory())}
                    title="Chat history"
                    aria-label="Chat history"
                  >
                    <History size={15} />
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} aria-label="Close assistant" title="Close">
                    <X size={16} />
                  </button>
                </div>
              </div>

              {usage && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 4, background: '#eef2f7', borderRadius: 999, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${usage.limit > 0 ? Math.min(100, (usage.used / usage.limit) * 100) : 0}%`,
                        height: '100%',
                        background: usage.remaining <= 5 ? '#dc2626' : usage.remaining <= 15 ? '#d97706' : '#7c3aed',
                        transition: 'width 240ms ease',
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {usage.remaining} / {usage.limit} left today
                  </span>
                </div>
              )}
            </header>

            {errorBanner && (
              <div
                role="alert"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 7,
                  padding: '9px 12px',
                  background: '#fef2f2',
                  borderBottom: '1px solid #fecaca',
                  color: '#991b1b',
                  fontSize: 11.5,
                }}
              >
                <AlertCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{errorBanner}</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setErrorBanner(null)} aria-label="Dismiss error" style={{ padding: 2 }}>
                  <X size={12} />
                </button>
              </div>
            )}

            <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div
                ref={listRef}
                role="log"
                aria-label="Conversation"
                onScroll={(event) => {
                  const element = event.currentTarget;
                  stickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 90;
                }}
                style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                {loadingConversation && (
                  <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={13} className="animate-spin" color="#7c3aed" /> Loading chat…
                  </div>
                )}

                {!loadingConversation && items.length === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 14,
                        background: 'linear-gradient(145deg, #f5f1ff 0%, #eef2ff 55%, #ffffff 100%)',
                        border: '1px solid #e9e4ff',
                      }}
                    >
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#312e81', letterSpacing: '-0.01em' }}>
                        Your agency copilot
                      </div>
                      <div style={{ marginTop: 4, fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                        Ask about clients, content, partners and performance. I use live workspace data, respect your role, and never
                        invent numbers.
                      </div>
                      <div style={{ marginTop: 9, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, color: '#5b21b6', background: '#ede9fe', borderRadius: 999, padding: '3px 7px', fontWeight: 700 }}>
                          Low-risk edits apply with Undo
                        </span>
                        <span style={{ fontSize: 10, color: '#047857', background: '#d1fae5', borderRadius: 999, padding: '3px 7px', fontWeight: 700 }}>
                          Grounded in your data
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {suggestions.map((suggestion) => (
                        <button
                          key={suggestion.label}
                          type="button"
                          onClick={() => void send(suggestion.prompt)}
                          disabled={exhausted}
                          style={{
                            textAlign: 'left',
                            border: '1px solid #e5e7eb',
                            background: '#fff',
                            borderRadius: 9,
                            padding: '9px 10px',
                            cursor: exhausted ? 'not-allowed' : 'pointer',
                            opacity: exhausted ? 0.55 : 1,
                            fontSize: 12,
                            color: '#0f172a',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                          }}
                        >
                          <span>{suggestion.label}</span>
                          <Sparkles size={12} color="#8b5cf6" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {items.map((item, index) => {
                  if (item.role === 'user') {
                    return (
                      <div
                        key={item.id}
                        style={{
                          alignSelf: 'flex-end',
                          background: '#111827',
                          color: '#fff',
                          padding: '8px 11px',
                          borderRadius: '12px 12px 3px 12px',
                          maxWidth: '90%',
                          fontSize: 12.5,
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {item.content}
                      </div>
                    );
                  }

                  const hasBody = Boolean(item.content || item.proposal || (item.tools && item.tools.length > 0));
                  if (!hasBody && item.streaming) return null;

                  return (
                    <div key={item.id} style={{ alignSelf: 'stretch', maxWidth: '100%' }}>
                      <div
                        style={{
                          background: item.error ? '#fff7f7' : '#f8fafc',
                          border: `1px solid ${item.error ? '#fecaca' : '#eef2f7'}`,
                          color: '#111827',
                          padding: '9px 11px',
                          borderRadius: '12px 12px 12px 3px',
                          fontSize: 12.5,
                          lineHeight: 1.55,
                        }}
                      >
                        {item.content ? (
                          <div className="ai-chat-markdown">
                            <Markdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                a: ({ node: _node, ...props }) => (
                                  <a {...props} target="_blank" rel="noreferrer" />
                                ),
                              }}
                            >
                              {item.content}
                            </Markdown>
                          </div>
                        ) : null}

                        {item.tools && item.tools.length > 0 && !item.proposal && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: item.content ? 8 : 0 }}>
                            {item.tools.map((tool, toolIndex) => (
                              <span
                                key={`${tool.name}-${toolIndex}`}
                                title={tool.summary || tool.status}
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 700,
                                  color: '#475569',
                                  background: '#eef2f7',
                                  borderRadius: 999,
                                  padding: '2px 6px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                }}
                              >
                                <Check size={9} color="#047857" />
                                {tool.name.replace(/_/g, ' ')}
                                {tool.summary ? ` · ${tool.summary}` : ''}
                              </span>
                            ))}
                          </div>
                        )}

                        {item.proposal && (
                          <ProposalCard
                            proposal={item.proposal}
                            busy={busyProposalId === (item.proposal.proposalId || 'undo')}
                            onApply={(indices) => void applyProposal(item.id, item.proposal!, indices)}
                            onReject={() => void rejectProposal(item.id, item.proposal!)}
                            onUndo={(proposal) => void undoProposal(item.id, proposal)}
                          />
                        )}
                      </div>

                      {!item.streaming && (
                        <div style={{ display: 'flex', gap: 2, marginTop: 4, marginLeft: 2 }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => void copyMessage(item)}
                            title="Copy answer"
                            aria-label="Copy answer"
                            style={{ padding: '2px 5px' }}
                          >
                            {copiedId === item.id ? <Check size={12} color="#047857" /> : <Copy size={12} />}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => retryFrom(index)}
                            disabled={busy}
                            title="Regenerate answer"
                            aria-label="Regenerate answer"
                            style={{ padding: '2px 5px' }}
                          >
                            <RotateCcw size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {busy && (
                  <div
                    aria-live="polite"
                    style={{ fontSize: 11.5, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6, padding: '1px 2px' }}
                  >
                    <Sparkles size={13} className="animate-spin" color="#8b5cf6" />
                    <span>{statusText || 'Thinking…'}</span>
                  </div>
                )}
              </div>

              {historyOpen && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: '#fff',
                    zIndex: 3,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid #eaedf0', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setHistoryOpen(false)} aria-label="Back to chat">
                      <ChevronLeft size={15} />
                    </button>
                    <strong style={{ fontSize: 12.5, flex: 1 }}>Chat history</strong>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={newChat} title="New chat">
                      <Plus size={14} />
                    </button>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {historyLoading && <div style={{ fontSize: 12, color: '#6b7280', padding: 8 }}>Loading…</div>}
                    {!historyLoading && conversations.length === 0 && (
                      <div style={{ fontSize: 12, color: '#6b7280', padding: 8 }}>No saved chats yet.</div>
                    )}
                    {conversations.map((conversation) => {
                      const active = conversationId.current === conversation.id;
                      return (
                        <div
                          key={conversation.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            border: `1px solid ${active ? '#ddd6fe' : '#eef2f7'}`,
                            background: active ? '#f5f3ff' : '#fff',
                            borderRadius: 8,
                            padding: '4px 4px 4px 8px',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => void loadConversation(conversation.id)}
                            style={{
                              flex: 1,
                              minWidth: 0,
                              border: 0,
                              background: 'transparent',
                              textAlign: 'left',
                              cursor: 'pointer',
                              padding: '4px 0',
                              font: 'inherit',
                            }}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#0f172a', fontWeight: 600 }}>
                              <MessageSquare size={12} color="#7c3aed" />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conversation.title}</span>
                            </span>
                            <span style={{ display: 'block', fontSize: 10, color: '#94a3b8', marginTop: 2, marginLeft: 18 }}>
                              {new Date(conversation.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => void deleteConversation(conversation.id)}
                            aria-label={`Delete ${conversation.title}`}
                            title="Delete chat"
                            style={{ padding: '3px 5px', color: '#9ca3af' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (busy) stop();
                else void send(input);
              }}
              style={{ padding: 10, borderTop: '1px solid #eaedf0', display: 'flex', gap: 7, alignItems: 'flex-end', background: '#fff' }}
            >
              <textarea
                ref={textareaRef}
                className="input-field"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    if (busy) stop();
                    else void send(input);
                  }
                }}
                placeholder={exhausted ? 'Daily AI limit reached' : 'Ask about this page…'}
                disabled={exhausted && !busy}
                rows={1}
                maxLength={8000}
                style={{
                  resize: 'none',
                  minHeight: 36,
                  maxHeight: 130,
                  lineHeight: 1.45,
                  paddingTop: 8,
                  paddingBottom: 8,
                  flex: 1,
                }}
                aria-label="Message the AI assistant"
              />
              <button
                type={busy ? 'button' : 'submit'}
                className="btn btn-primary"
                disabled={!busy && (!input.trim() || exhausted)}
                onClick={busy ? stop : undefined}
                aria-label={busy ? 'Stop response' : 'Send message'}
                title={busy ? 'Stop' : 'Send (Enter)'}
                style={{ minWidth: 38, height: 36, padding: 0 }}
              >
                {busy ? <Square size={13} /> : <Send size={14} />}
              </button>
            </form>
          </aside>
        </>
      )}
    </>
  );
}

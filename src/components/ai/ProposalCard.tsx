'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Ban, Check, ChevronDown, ChevronUp, ExternalLink, RotateCcw, Sparkles } from 'lucide-react';
import { actionDetails, actionTitle, proposalStatusLabel } from '@/lib/ai/actionDisplay';
import type { ProposalView } from '@/lib/ai/chatTypes';

interface ProposalCardProps {
  proposal: ProposalView;
  busy?: boolean;
  onApply: (indices: number[]) => void;
  onReject: () => void;
  onUndo: (proposal: ProposalView) => void;
}

export function ProposalCard({ proposal, busy, onApply, onReject, onUndo }: ProposalCardProps) {
  const pending =
    Boolean(proposal.needsConfirmation) &&
    !proposal.autoApplied &&
    proposal.status !== 'applied' &&
    proposal.status !== 'rejected' &&
    proposal.status !== 'failed' &&
    proposal.status !== 'reverted';
  const [selected, setSelected] = useState<Set<number>>(() => new Set(proposal.actions.map((_, index) => index)));
  const [expanded, setExpanded] = useState<number | null>(null);
  const results = proposal.results || [];
  const undo = proposal.undo || [];
  const canUndo = undo.length > 0 && proposal.status !== 'reverted';

  useEffect(() => {
    setSelected(new Set(proposal.actions.map((_, index) => index)));
  }, [proposal.actions]);

  const selectedCount = selected.size;
  const allSelected = proposal.actions.length > 0 && selectedCount === proposal.actions.length;

  const statusLabel = useMemo(() => proposalStatusLabel(proposal), [proposal]);
  const hasFailures = results.some((result) => !result.ok);

  const toggle = (index: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div
      style={{
        marginTop: 10,
        background: '#ffffff',
        color: '#111827',
        padding: 12,
        borderRadius: 10,
        border: `1px solid ${hasFailures ? '#fecaca' : proposal.autoApplied ? '#bbf7d0' : '#e5e7eb'}`,
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Sparkles size={12} color={proposal.autoApplied ? '#047857' : '#7c3aed'} />
            {proposal.summary || 'Proposed changes'}
          </div>
          <div
            style={{
              marginTop: 3,
              fontSize: 10.5,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: hasFailures ? '#b91c1c' : proposal.autoApplied ? '#047857' : '#6b7280',
            }}
          >
            {statusLabel}
          </div>
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: '#475569',
            background: '#f1f5f9',
            borderRadius: 999,
            padding: '2px 7px',
            whiteSpace: 'nowrap',
          }}
        >
          {proposal.actions.length} action{proposal.actions.length === 1 ? '' : 's'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>
        {proposal.actions.map((action, index) => {
          const result =
            results.find((row) => row.index === index) ||
            (results.length === proposal.actions.length ? results[index] : undefined);
          const isOpen = expanded === index;
          return (
            <div
              key={index}
              style={{
                border: `1px solid ${result && !result.ok ? '#fecaca' : '#e2e8f0'}`,
                background: result && !result.ok ? '#fff7f7' : '#f8fafc',
                borderRadius: 8,
                padding: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                {pending && (
                  <input
                    type="checkbox"
                    checked={selected.has(index)}
                    onChange={() => toggle(index)}
                    aria-label={`Select action ${index + 1}`}
                    style={{ marginTop: 2 }}
                  />
                )}
                {result && (
                  <span
                    style={{
                      marginTop: 1,
                      color: result.ok ? '#047857' : '#b91c1c',
                      fontWeight: 800,
                      fontSize: 12,
                    }}
                    title={result.ok ? 'Applied' : result.error || 'Failed'}
                  >
                    {result.ok ? '✓' : '!'}
                  </span>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : index)}
                    style={{
                      border: 0,
                      background: 'transparent',
                      padding: 0,
                      textAlign: 'left',
                      cursor: 'pointer',
                      font: 'inherit',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#0f172a',
                      width: '100%',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {actionTitle(action)}
                      {isOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </span>
                  </button>
                  {result?.ok && result.name && (
                    <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>{result.name}</div>
                  )}
                  {result && !result.ok && (
                    <div style={{ fontSize: 10.5, color: '#b91c1c', marginTop: 3 }}>{result.error || 'Failed'}</div>
                  )}
                  {result?.ok && result.id && (result.type === 'create_client' || result.type === 'update_client') && (
                    <a
                      href={`/clients/${result.id}`}
                      style={{ fontSize: 10.5, color: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 3 }}
                    >
                      Open client <ExternalLink size={10} />
                    </a>
                  )}
                  {isOpen && (
                    <div style={{ marginTop: 6, display: 'grid', gap: 3 }}>
                      {actionDetails(action).map((row) => (
                        <div key={row.label} style={{ display: 'flex', gap: 6, fontSize: 10.5, color: '#475569' }}>
                          <span style={{ minWidth: 84, fontWeight: 600, color: '#64748b' }}>{row.label}</span>
                          <span style={{ wordBreak: 'break-word' }}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {results.length > 0 && hasFailures && (
        <div style={{ marginTop: 8, fontSize: 10.5, color: '#b91c1c' }}>
          {results.every((result) => !result.ok)
            ? 'No changes were applied.'
            : 'Some actions failed. Successful actions were kept; retry the failed ones if needed.'}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        {pending && (
          <>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy || selectedCount === 0}
              onClick={() => onApply(Array.from(selected).sort((a, b) => a - b))}
            >
              <Check size={12} />
              {allSelected ? 'Confirm changes' : `Apply ${selectedCount} selected`}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={onReject}>
              <Ban size={12} /> Reject
            </button>
            {proposal.actions.length > 1 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={busy}
                onClick={() => setSelected(allSelected ? new Set() : new Set(proposal.actions.map((_, index) => index)))}
              >
                {allSelected ? 'Clear' : 'Select all'}
              </button>
            )}
          </>
        )}
        {canUndo && (
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => onUndo(proposal)}>
            <RotateCcw size={12} /> Undo
          </button>
        )}
      </div>
    </div>
  );
}

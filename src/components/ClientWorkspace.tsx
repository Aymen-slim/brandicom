'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ClientData, DeliverableData, MessageData, UserSummary } from '@/types';
import { ClientDetailHeader } from './ClientDetailHeader';
import { DeliverableTracker } from './DeliverableTracker';
import { ChatThread } from './ChatThread';
import { MetricsEntryModal } from './MetricsEntryModal';
import dynamic from 'next/dynamic';
import { formatMoney, formatNumber, formatPercent } from '@/lib/format';
import { FileText, Sparkles, Plus, Printer, Trash2 } from 'lucide-react';

const Markdown = dynamic(() => import('react-markdown'), { ssr: false });

type Tab = 'overview' | 'content' | 'engagement' | 'partners' | 'finance' | 'chat';

export function ClientWorkspace({
  user,
  client,
  deliverables: initialDeliverables,
  messages,
  availableUsers,
  availableCreators,
}: {
  user: UserSummary;
  client: ClientData;
  deliverables: DeliverableData[];
  messages: MessageData[];
  availableUsers: UserSummary[];
  availableCreators: Array<{ id: string; name: string; role: string }>;
}) {
  const isAdmin = user.role === 'admin';
  const [tab, setTab] = useState<Tab>('overview');
  const [deliverables, setDeliverables] = useState(initialDeliverables);
  const [metricsFor, setMetricsFor] = useState<DeliverableData | null>(null);
  const [ideas, setIdeas] = useState<any[] | null>(null);
  const [ideasBusy, setIdeasBusy] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<any[] | null>(null);
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);
  const [newInvoiceSubtotal, setNewInvoiceSubtotal] = useState(
    client.contract?.monthlyFee != null ? String(client.contract.monthlyFee) : ''
  );
  const [newInvoicePeriod, setNewInvoicePeriod] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [newInvoiceDueDate, setNewInvoiceDueDate] = useState('');
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  const handleCreateInvoiceForClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvoiceSubtotal) return;
    setCreatingInvoice(true);
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.id,
          subtotal: Number(newInvoiceSubtotal),
          periodLabel: newInvoicePeriod || null,
          dueDate: newInvoiceDueDate || null,
          status: 'sent',
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setInvoices((prev) => [created, ...(prev || [])]);
        setNewInvoiceOpen(false);
      }
    } finally {
      setCreatingInvoice(false);
    }
  };

  const handleDeleteInvoice = async (id: string, number: string) => {
    if (!confirm(`Voulez-vous vraiment supprimer définitivement la facture ${number} ?`)) return;
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setInvoices((prev) => (prev || []).filter((i) => i.id !== id));
      } else {
        alert('Erreur lors de la suppression de la facture.');
      }
    } catch (err) {
      console.error('Failed to delete invoice:', err);
    }
  };

  const tabs: Array<{ id: Tab; label: string; hide?: boolean }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'content', label: 'Content' },
    { id: 'engagement', label: 'Engagement' },
    { id: 'partners', label: 'Partners' },
    { id: 'finance', label: 'Finance', hide: !isAdmin },
    { id: 'chat', label: 'Chat' },
  ];

  const published = deliverables.filter((d) => d.published || d.status === 'published');
  const totals = useMemo(() => {
    const acc = { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, reach: 0, followersGained: 0, posts: 0 };
    for (const d of published) {
      if (!d.latestMetrics) continue;
      acc.posts += 1;
      acc.views += d.latestMetrics.views;
      acc.likes += d.latestMetrics.likes;
      acc.comments += d.latestMetrics.comments;
      acc.shares += d.latestMetrics.shares;
      acc.saves += d.latestMetrics.saves;
      acc.reach += d.latestMetrics.reach;
      acc.followersGained += d.latestMetrics.followersGained;
    }
    const rate = acc.reach ? ((acc.likes + acc.comments + acc.shares + acc.saves) / acc.reach) * 100 : 0;
    return { ...acc, rate };
  }, [published]);

  const loadFinance = async () => {
    if (invoices) return;
    const res = await fetch(`/api/invoices?clientId=${client.id}`);
    if (res.ok) setInvoices(await res.json());
  };

  const genIdeas = async () => {
    setIdeasBusy(true);
    try {
      const res = await fetch('/api/ai/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id }),
      });
      const data = await res.json();
      setIdeas(data.ideas || []);
    } finally {
      setIdeasBusy(false);
    }
  };

  const genReport = async () => {
    const res = await fetch('/api/ai/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: client.id }),
    });
    const data = await res.json();
    setReport(data.content_md || data.error || '');
  };

  const addIdea = async (idea: any) => {
    const res = await fetch(`/api/clients/${client.id}/deliverables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idea: idea.title,
        hook: idea.hook,
        format: idea.format,
        platform: idea.platform,
        status: 'idea',
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setDeliverables((prev) => [created, ...prev]);
    }
  };

  return (
    <div>
      <ClientDetailHeader client={client} availableUsers={availableUsers} user={user} />

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {tabs
          .filter((t) => !t.hide)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setTab(t.id);
                if (t.id === 'finance') loadFinance();
              }}
            >
              {t.label}
            </button>
          ))}
      </div>

      {tab === 'overview' && (
        <div className="grid-split-wide">
          <div className="glass-card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Account brief</h3>
            <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.6 }}>
              {client.notes || 'No internal notes yet.'}
            </p>
            <div className="grid-responsive-2" style={{ marginTop: 16, gap: 8, fontSize: 12 }}>
              <div>Contact: {client.contactName || '—'} {client.contactEmail || ''}</div>
              <div>Phone: {client.contactPhone || '—'}</div>
              <div>Website: {client.website || '—'}</div>
              <div>Lead source: {client.leadSource || '—'}</div>
            </div>
            {(client.socialAccounts || []).length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {client.socialAccounts!.map((s) => (
                  <span key={s.id} style={{ fontSize: 11, background: '#f3f4f6', padding: '2px 8px', borderRadius: 4 }}>
                    {s.platform} {s.handle} {s.followers ? `· ${formatNumber(s.followers)}` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="glass-card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Health</h3>
            {client.health ? (
              <>
                <div style={{ fontSize: 28, fontWeight: 800 }}>{client.health.score}</div>
                <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'capitalize' }}>{client.health.risk} risk</div>
                <p style={{ fontSize: 13, marginTop: 10 }}>{client.health.aiSummary}</p>
              </>
            ) : (
              <p style={{ fontSize: 13, color: '#9ca3af' }}>No health snapshot yet.</p>
            )}
            <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={genReport}>
              Generate monthly report
            </button>
            {report && (
              <div style={{ marginTop: 12, fontSize: 13 }}>
                <Markdown>{report}</Markdown>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'content' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={genIdeas} disabled={ideasBusy}>
              <Sparkles size={13} /> {ideasBusy ? 'Generating…' : 'AI ideas & scripts'}
            </button>
          </div>
          {ideas && (
            <div className="glass-card grid-responsive-2" style={{ padding: 16, gap: 10 }}>
              {ideas.map((idea, i) => (
                <div key={i} style={{ border: '1px solid #eaedf0', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{idea.title}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', margin: '6px 0' }}>{idea.hook}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{idea.format} · {idea.platform}</div>
                  <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={() => addIdea(idea)}>
                    Add to tracker
                  </button>
                </div>
              ))}
            </div>
          )}
          <DeliverableTracker
            clientId={client.id}
            initialDeliverables={deliverables}
            availableCreators={availableCreators}
            onUpdate={() => {}}
          />
          <div className="glass-card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Update engagement</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {published.map((d) => (
                <button key={d.id} type="button" className="btn btn-secondary btn-sm" onClick={() => setMetricsFor(d)}>
                  {d.idea.slice(0, 40)} {d.latestMetrics ? `· ${formatNumber(d.latestMetrics.views)}` : ''}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'engagement' && (
        <div>
          <div className="grid-responsive-4" style={{ gap: 12, marginBottom: 16 }}>
            <Stat label="Views" value={formatNumber(totals.views)} />
            <Stat label="Reach" value={formatNumber(totals.reach)} />
            <Stat label="Eng. rate" value={formatPercent(totals.rate, 1)} />
            <Stat label="Followers +" value={formatNumber(totals.followersGained)} />
          </div>
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <div className="table-responsive-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: 140 }}>Post</th>
                    <th>Platform</th>
                    <th>Views</th>
                    <th>Likes</th>
                    <th>Comments</th>
                  </tr>
                </thead>
                <tbody>
                  {published
                    .slice()
                    .sort((a, b) => (b.latestMetrics?.views || 0) - (a.latestMetrics?.views || 0))
                    .map((d) => (
                      <tr key={d.id}>
                        <td>{d.idea}</td>
                        <td>{d.platform}</td>
                        <td>{formatNumber(d.latestMetrics?.views)}</td>
                        <td>{formatNumber(d.latestMetrics?.likes)}</td>
                        <td>{formatNumber(d.latestMetrics?.comments)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'partners' && (
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Booked talent</h3>
            <Link href="/partners" className="btn btn-secondary btn-sm">
              Browse partners
            </Link>
          </div>
          {(client.creatorAssignments ?? []).length === 0 ? (
            <p style={{ fontSize: 13, color: '#9ca3af' }}>No partners booked yet.</p>
          ) : (
            (client.creatorAssignments ?? []).map((ca) => (
              <div key={ca.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eaedf0' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{ca.creator.name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'capitalize' }}>{ca.creator.role}</div>
                </div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  {ca.scheduledDate ? new Date(ca.scheduledDate).toLocaleDateString() : 'Unscheduled'}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'finance' && isAdmin && (
        <div className="glass-card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>Factures & Règlements</h3>
              <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                Générez et imprimez les factures officielles avec les coordonnées de {client.name}.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setNewInvoiceOpen(!newInvoiceOpen)}
              >
                <Plus size={13} /> {newInvoiceOpen ? 'Fermer' : 'Nouvelle Facture'}
              </button>
              <Link href="/finance/invoices" className="btn btn-secondary btn-sm">
                Toutes les factures
              </Link>
            </div>
          </div>

          {newInvoiceOpen && (
            <form
              onSubmit={handleCreateInvoiceForClient}
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: 16,
                marginBottom: 18,
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr 1fr auto',
                gap: 10,
                alignItems: 'end',
              }}
            >
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: 4 }}>
                  Montant HT (TND) *
                </label>
                <input
                  className="input-field"
                  type="number"
                  step="0.001"
                  required
                  placeholder="ex: 4500"
                  value={newInvoiceSubtotal}
                  onChange={(e) => setNewInvoiceSubtotal(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: 4 }}>
                  Période (Mois)
                </label>
                <input
                  className="input-field"
                  placeholder="ex: 2026-09"
                  value={newInvoicePeriod}
                  onChange={(e) => setNewInvoicePeriod(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: 4 }}>
                  Échéance de paiement
                </label>
                <input
                  className="input-field"
                  type="date"
                  value={newInvoiceDueDate}
                  onChange={(e) => setNewInvoiceDueDate(e.target.value)}
                />
              </div>

              <button type="submit" disabled={creatingInvoice} className="btn btn-primary">
                {creatingInvoice ? 'Création…' : 'Émettre Facture'}
              </button>
            </form>
          )}

          {!invoices ? (
            <p style={{ fontSize: 13, color: '#9ca3af' }}>Chargement des factures…</p>
          ) : invoices.length === 0 ? (
            <p style={{ fontSize: 13, color: '#9ca3af' }}>Aucune facture émise pour ce client pour le moment.</p>
          ) : (
            <div className="table-responsive-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Numéro</th>
                    <th>Période</th>
                    <th>Total TTC</th>
                    <th>Encaissé</th>
                    <th>Statut</th>
                    <th style={{ textAlign: 'right', paddingRight: 16 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>
                        <Link href={`/finance/invoices/${inv.id}`} style={{ fontWeight: 700, color: '#4338ca' }}>
                          {inv.number}
                        </Link>
                      </td>
                      <td style={{ fontSize: 12, color: '#64748b' }}>{inv.periodLabel || inv.issueDate}</td>
                      <td style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {formatMoney(inv.total)}
                      </td>
                      <td style={{ fontVariantNumeric: 'tabular-nums', color: (inv.paidAmount || 0) > 0 ? '#059669' : undefined }}>
                        {formatMoney(inv.paidAmount || 0)}
                      </td>
                      <td>
                        <span
                          className={`status-badge-pill ${
                            inv.status === 'paid' ? 'paid' : inv.status === 'partially_paid' ? 'partially-paid' : 'pending'
                          }`}
                          style={{ fontSize: 10.5 }}
                        >
                          {inv.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', paddingRight: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
                          <Link
                            href={`/finance/invoices/${inv.id}/print`}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '3px 8px', fontSize: 11 }}
                            title="Imprimer / Télécharger la Facture"
                          >
                            <Printer size={12} /> Facture
                          </Link>
                          <Link
                            href={`/finance/invoices/${inv.id}`}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '3px 8px', fontSize: 11 }}
                          >
                            Détails
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDeleteInvoice(inv.id, inv.number)}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '4px 6px', color: '#e11d48' }}
                            title="Supprimer la facture"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'chat' && (
        <div className="grid-responsive-2" style={{ gap: 16 }}>
          <ChatThread clientId={client.id} initialMessages={messages} user={user} />
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <FileText size={14} />
              <strong>Notes</strong>
            </div>
            <p style={{ fontSize: 13, color: '#4b5563' }}>{client.notes || 'No notes.'}</p>
          </div>
        </div>
      )}

      {metricsFor && (
        <MetricsEntryModal
          deliverableId={metricsFor.id}
          idea={metricsFor.idea}
          onClose={() => setMetricsFor(null)}
          onSaved={() => window.location.reload()}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card" style={{ padding: 16 }}>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

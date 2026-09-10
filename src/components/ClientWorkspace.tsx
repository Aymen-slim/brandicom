'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ClientData, DeliverableData, MessageData, UserSummary } from '@/types';
import { ClientDetailHeader } from './ClientDetailHeader';
import { DeliverableTracker } from './DeliverableTracker';
import { ClientGoalsProgressBar } from './ClientGoalsProgressBar';
import { computeClientGoalsProgress } from '@/lib/clientGoals';
import { ChatThread } from './ChatThread';
import { ClientInspirationBoard } from './ClientInspirationBoard';
import { MetricsEntryModal } from './MetricsEntryModal';
import dynamic from 'next/dynamic';
import { formatMoney, formatNumber, formatPercent, cleanSocialHandle, parseFollowerInput } from '@/lib/format';
import { InstagramIcon, TikTokIcon } from './SocialIcons';
import { FileText, Sparkles, Plus, Printer, Trash2, RefreshCw, ExternalLink, TrendingUp, Users, Edit3, ArrowUpRight, AlertTriangle } from 'lucide-react';

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
  const [currentClient, setCurrentClient] = useState<ClientData>(client);
  const [tab, setTab] = useState<Tab>('overview');
  const [deliverables, setDeliverables] = useState(initialDeliverables);
  const [metricsFor, setMetricsFor] = useState<DeliverableData | null>(null);
  const [ideas, setIdeas] = useState<any[] | null>(null);
  const [ideasBusy, setIdeasBusy] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<any[] | null>(null);
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);
  const [newInvoiceSubtotal, setNewInvoiceSubtotal] = useState(
    currentClient.contract?.monthlyFee != null ? String(currentClient.contract.monthlyFee) : ''
  );
  const [newInvoicePeriod, setNewInvoicePeriod] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [newInvoiceDueDate, setNewInvoiceDueDate] = useState('');
  const [newInvoiceVatRate, setNewInvoiceVatRate] = useState<number>(0.19);
  const [newInvoiceIsCustomVat, setNewInvoiceIsCustomVat] = useState(false);
  const [newInvoiceCustomVat, setNewInvoiceCustomVat] = useState('');
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  // Active TVA calculations for new invoice
  const activeNewInvoiceVat = newInvoiceIsCustomVat
    ? (Number(newInvoiceCustomVat) || 0) / 100
    : newInvoiceVatRate;
  const newInvoiceSubtotalNum = Number(newInvoiceSubtotal) || 0;
  const newInvoiceVatAmount = Math.round(newInvoiceSubtotalNum * activeNewInvoiceVat * 1000) / 1000;
  const newInvoiceTotalTTC = Math.round((newInvoiceSubtotalNum + newInvoiceVatAmount) * 1000) / 1000;

  // Follower Growth State
  const [syncingSocialPlatform, setSyncingSocialPlatform] = useState<'instagram' | 'tiktok' | null>(null);
  const [socialSyncMessage, setSocialSyncMessage] = useState<string | null>(null);
  const [editingBaselines, setEditingBaselines] = useState(false);
  const [savingBaselines, setSavingBaselines] = useState(false);

  const existingIg = (currentClient.socialAccounts || []).find((s) => s.platform === 'instagram');
  const existingTt = (currentClient.socialAccounts || []).find((s) => s.platform === 'tiktok');

  const [igBaselineInput, setIgBaselineInput] = useState(
    existingIg?.initialFollowers != null ? String(existingIg.initialFollowers) : ''
  );
  const [ttBaselineInput, setTtBaselineInput] = useState(
    existingTt?.initialFollowers != null ? String(existingTt.initialFollowers) : ''
  );

  const handleSyncProfileFollowers = async (platform: 'instagram' | 'tiktok') => {
    const account = (currentClient.socialAccounts || []).find((s) => s.platform === platform);
    const raw = account?.handle || account?.url;
    const clean = cleanSocialHandle(raw);
    if (!clean) {
      alert(`No ${platform === 'instagram' ? 'Instagram' : 'TikTok'} account username found. Please configure it in Edit Account.`);
      return;
    }
    setSyncingSocialPlatform(platform);
    setSocialSyncMessage(null);
    try {
      const res = await fetch('/api/social/fetch-followers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urlOrHandle: clean, platform }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch followers');

      const currentSocials = currentClient.socialAccounts || [];
      const hasAccount = currentSocials.some((s) => s.platform === platform);
      const updatedSocials = hasAccount
        ? currentSocials.map((s) =>
            s.platform === platform
              ? {
                  platform: s.platform,
                  handle: data.handle ? cleanSocialHandle(data.handle) : clean,
                  url: s.url,
                  followers: data.followers,
                  initialFollowers: s.initialFollowers,
                }
              : s
          )
        : [
            ...currentSocials,
            {
              platform,
              handle: data.handle ? cleanSocialHandle(data.handle) : clean,
              url: null,
              followers: data.followers,
              initialFollowers: null,
            },
          ];

      const patchRes = await fetch(`/api/clients/${currentClient.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ socialAccounts: updatedSocials }),
      });
      if (!patchRes.ok) throw new Error('Failed to save updated follower count');
      const updatedClient = await patchRes.json();
      setCurrentClient((prev) => ({ ...prev, ...updatedClient }));
      setSocialSyncMessage(`Updated ${platform === 'instagram' ? 'Instagram' : 'TikTok'} followers: ${formatNumber(data.followers)}!`);
      setTimeout(() => setSocialSyncMessage(null), 4000);
    } catch (err: any) {
      alert(`Sync error: ${err.message}`);
    } finally {
      setSyncingSocialPlatform(null);
    }
  };

  const handleSaveBaselines = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBaselines(true);
    try {
      const currentSocials = currentClient.socialAccounts || [];
      const igAcc = currentSocials.find((s) => s.platform === 'instagram');
      const ttAcc = currentSocials.find((s) => s.platform === 'tiktok');

      const parsedIgInitial = parseFollowerInput(igBaselineInput);
      const parsedTtInitial = parseFollowerInput(ttBaselineInput);

      const updatedSocials = [
        {
          platform: 'instagram' as const,
          handle: igAcc?.handle ? cleanSocialHandle(igAcc.handle) : null,
          url: igAcc?.url || null,
          followers: igAcc?.followers ?? null,
          initialFollowers: parsedIgInitial,
        },
        {
          platform: 'tiktok' as const,
          handle: ttAcc?.handle ? cleanSocialHandle(ttAcc.handle) : null,
          url: ttAcc?.url || null,
          followers: ttAcc?.followers ?? null,
          initialFollowers: parsedTtInitial,
        },
      ].filter((s) => s.handle || s.followers != null || s.initialFollowers != null);

      const patchRes = await fetch(`/api/clients/${currentClient.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ socialAccounts: updatedSocials }),
      });
      if (!patchRes.ok) throw new Error('Failed to update baselines');
      const updatedClient = await patchRes.json();
      setCurrentClient((prev) => ({ ...prev, ...updatedClient }));
      setEditingBaselines(false);
      setSocialSyncMessage('Follower baselines saved successfully!');
      setTimeout(() => setSocialSyncMessage(null), 4000);
    } catch (err: any) {
      alert(`Failed to save baselines: ${err.message}`);
    } finally {
      setSavingBaselines(false);
    }
  };

  const handleCreateInvoiceForClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvoiceSubtotal) return;
    setCreatingInvoice(true);
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: currentClient.id,
          subtotal: Number(newInvoiceSubtotal),
          vatRate: activeNewInvoiceVat,
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
    { id: 'chat', label: 'Chat & Inspiration' },
  ];

  const published = deliverables.filter(
    (d) => d.published || d.status === 'published' || (d.latestMetrics && d.latestMetrics.views > 0)
  );

  const [syncingPostId, setSyncingPostId] = useState<string | null>(null);

  const refreshDeliverables = async () => {
    try {
      const res = await fetch(`/api/clients/${currentClient.id}/deliverables`);
      if (res.ok) {
        const data = await res.json();
        setDeliverables(data);
      }
    } catch (err) {
      console.error('Failed to refresh deliverables:', err);
    }
  };

  const handleSyncPost = async (id: string) => {
    setSyncingPostId(id);
    try {
      const res = await fetch(`/api/deliverables/${id}/sync-metrics`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to sync post stats via Apify');
        return;
      }
      await refreshDeliverables();
    } catch (err: any) {
      alert(err.message || 'Error syncing metrics');
    } finally {
      setSyncingPostId(null);
    }
  };

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
    const audienceBase = acc.reach > 0 ? acc.reach : acc.views;
    const rate = audienceBase ? ((acc.likes + acc.comments + acc.shares + acc.saves) / audienceBase) * 100 : 0;
    return { ...acc, rate };
  }, [published]);

  // Follower Growth Totals
  const igFollowers = existingIg?.followers ?? 0;
  const igInitial = existingIg?.initialFollowers ?? 0;
  const igDiff = igFollowers - igInitial;
  const igGrowthPct = igInitial > 0 ? (igDiff / igInitial) * 100 : 0;

  const ttFollowers = existingTt?.followers ?? 0;
  const ttInitial = existingTt?.initialFollowers ?? 0;
  const ttDiff = ttFollowers - ttInitial;
  const ttGrowthPct = ttInitial > 0 ? (ttDiff / ttInitial) * 100 : 0;

  const totalCurrentFollowers = (existingIg?.followers || 0) + (existingTt?.followers || 0);
  const totalInitialFollowers = (existingIg?.initialFollowers || 0) + (existingTt?.initialFollowers || 0);
  const totalFollowersDiff = totalCurrentFollowers - totalInitialFollowers;
  const totalGrowthPct = totalInitialFollowers > 0 ? (totalFollowersDiff / totalInitialFollowers) * 100 : 0;

  const loadFinance = async () => {
    if (invoices) return;
    const res = await fetch(`/api/invoices?clientId=${currentClient.id}`);
    if (res.ok) setInvoices(await res.json());
  };

  const genIdeas = async () => {
    setIdeasBusy(true);
    try {
      const res = await fetch('/api/ai/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: currentClient.id }),
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
      body: JSON.stringify({ clientId: currentClient.id }),
    });
    const data = await res.json();
    setReport(data.content_md || data.error || '');
  };

  const addIdea = async (idea: any) => {
    const res = await fetch(`/api/clients/${currentClient.id}/deliverables`, {
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

  const goalsProgress = useMemo(
    () => computeClientGoalsProgress(currentClient, deliverables),
    [currentClient, deliverables]
  );

  return (
    <div>
      <ClientDetailHeader
        client={currentClient}
        availableUsers={availableUsers}
        user={user}
        onClientUpdated={(updated) => setCurrentClient(updated)}
      />

      {/* Monthly Content Goals Progress Bar & End-of-Month Alert */}
      <ClientGoalsProgressBar
        client={currentClient}
        deliverables={deliverables}
        onClientUpdated={(updated) => setCurrentClient(updated)}
        onNewDeliverable={() => setTab('content')}
      />

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
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              {t.label}
              {t.id === 'content' && goalsProgress.alertNeeded && (
                <span
                  style={{
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: 10,
                    lineHeight: '1.2',
                  }}
                  title="End-of-month alert: Content delivery goals behind schedule"
                >
                  !
                </span>
              )}
            </button>
          ))}
      </div>

      {tab === 'overview' && (
        <div className="grid-split-wide">
          <div className="glass-card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Account brief</h3>
            <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.6 }}>
              {currentClient.notes || 'No internal notes yet.'}
            </p>
            <div className="grid-responsive-2" style={{ marginTop: 16, gap: 8, fontSize: 12 }}>
              <div>Contact: {currentClient.contactName || '—'} {currentClient.contactEmail || ''}</div>
              <div>Phone: {currentClient.contactPhone || '—'}</div>
              <div>Website: {currentClient.website || '—'}</div>
              <div>Lead source: {currentClient.leadSource || '—'}</div>
            </div>
            {(currentClient.socialAccounts || []).length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {currentClient.socialAccounts!.map((s) => (
                  <span
                    key={s.id}
                    style={{
                      fontSize: 11,
                      background: '#f3f4f6',
                      padding: '3px 8px',
                      borderRadius: 5,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    {s.platform === 'instagram' ? (
                      <InstagramIcon size={12} color="#be185d" />
                    ) : (
                      <TikTokIcon size={12} color="#0f172a" />
                    )}
                    <span>{cleanSocialHandle(s.handle) || s.platform}</span>
                    {s.followers ? <span>· {formatNumber(s.followers)}</span> : null}
                    {s.initialFollowers != null && s.followers != null && (
                      <strong style={{ color: s.followers >= s.initialFollowers ? '#059669' : '#dc2626' }}>
                        ({s.followers >= s.initialFollowers ? `+${formatNumber(s.followers - s.initialFollowers)}` : formatNumber(s.followers - s.initialFollowers)})
                      </strong>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="glass-card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Health</h3>
            {currentClient.health ? (
              <>
                <div style={{ fontSize: 28, fontWeight: 800 }}>{currentClient.health.score}</div>
                <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'capitalize' }}>{currentClient.health.risk} risk</div>
                <p style={{ fontSize: 13, marginTop: 10 }}>{currentClient.health.aiSummary}</p>
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
            clientId={currentClient.id}
            initialDeliverables={deliverables}
            availableCreators={availableCreators}
            onUpdate={refreshDeliverables}
          />
          <div className="glass-card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Update engagement</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {published.map((d) => (
                <button key={d.id} type="button" className="btn btn-secondary btn-sm" onClick={() => setMetricsFor(d)}>
                  {d.idea.slice(0, 40)} {d.latestMetrics ? `· ${formatNumber(d.latestMetrics.views)} views` : ''}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'engagement' && (
        <div>
          {/* Follower Growth & Baseline Comparison Card */}
          <div
            className="glass-card"
            style={{
              padding: '20px 22px',
              marginBottom: '20px',
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.95))',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)',
                  }}
                >
                  <TrendingUp size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Audience & Follower Growth
                  </h3>
                  <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>
                    Evolution since partnership start ({currentClient.startDate ? new Date(currentClient.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Start Date'}) to live current counts
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {socialSyncMessage && (
                  <span style={{ fontSize: 11.5, color: '#047857', background: '#ecfdf5', padding: '4px 10px', borderRadius: 6, fontWeight: 600, border: '1px solid #a7f3d0' }}>
                    ✓ {socialSyncMessage}
                  </span>
                )}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setIgBaselineInput(existingIg?.initialFollowers != null ? String(existingIg.initialFollowers) : '');
                    setTtBaselineInput(existingTt?.initialFollowers != null ? String(existingTt.initialFollowers) : '');
                    setEditingBaselines(!editingBaselines);
                  }}
                  style={{ fontSize: 11.5 }}
                >
                  <Edit3 size={12} />
                  {editingBaselines ? 'Close Baseline Editor' : 'Edit Starting Baselines'}
                </button>
              </div>
            </div>

            {/* Quick baseline edit drawer */}
            {editingBaselines && (
              <form
                onSubmit={handleSaveBaselines}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  padding: '12px 16px',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                    <InstagramIcon size={14} color="#be185d" />
                    <span>Instagram Starting Followers</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 10k, 15000"
                    className="input-field"
                    value={igBaselineInput}
                    onChange={(e) => setIgBaselineInput(e.target.value)}
                    style={{ width: 190, fontSize: 12 }}
                  />
                  {igBaselineInput && parseFollowerInput(igBaselineInput) != null && (
                    <div style={{ fontSize: 11, color: '#047857', fontWeight: 600, marginTop: 4 }}>
                      = {formatNumber(parseFollowerInput(igBaselineInput)!)} followers
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                    <TikTokIcon size={14} color="#0f172a" />
                    <span>TikTok Starting Followers</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 5k, 25000"
                    className="input-field"
                    value={ttBaselineInput}
                    onChange={(e) => setTtBaselineInput(e.target.value)}
                    style={{ width: 190, fontSize: 12 }}
                  />
                  {ttBaselineInput && parseFollowerInput(ttBaselineInput) != null && (
                    <div style={{ fontSize: 11, color: '#047857', fontWeight: 600, marginTop: 4 }}>
                      = {formatNumber(parseFollowerInput(ttBaselineInput)!)} followers
                    </div>
                  )}
                </div>
                <div style={{ alignSelf: 'flex-end', display: 'flex', gap: 8, marginBottom: 2 }}>
                  <button type="submit" disabled={savingBaselines} className="btn btn-primary btn-sm">
                    {savingBaselines ? 'Saving...' : 'Save Baselines'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingBaselines(false)}
                    className="btn btn-secondary btn-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Summary KPI Grid */}
            <div className="grid-responsive-4" style={{ gap: 12, marginBottom: 16 }}>
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>Starting Follower Base</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                  {totalInitialFollowers > 0 ? formatNumber(totalInitialFollowers) : '—'}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  {currentClient.startDate ? `At contract start (${currentClient.startDate})` : 'Baseline snapshot'}
                </div>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>Current Follower Base</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                  {totalCurrentFollowers > 0 ? formatNumber(totalCurrentFollowers) : '—'}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  Instagram + TikTok live
                </div>
              </div>

              <div
                style={{
                  background: totalFollowersDiff >= 0 ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${totalFollowersDiff >= 0 ? '#bbf7d0' : '#fecaca'}`,
                  borderRadius: 8,
                  padding: 14,
                }}
              >
                <div style={{ fontSize: 11.5, color: totalFollowersDiff >= 0 ? '#166534' : '#991b1b', fontWeight: 600 }}>
                  Net Audience Growth
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: totalFollowersDiff >= 0 ? '#15803d' : '#b91c1c',
                    marginTop: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {totalInitialFollowers > 0
                    ? `${totalFollowersDiff >= 0 ? '+' : ''}${formatNumber(totalFollowersDiff)}`
                    : totalCurrentFollowers > 0
                    ? formatNumber(totalCurrentFollowers)
                    : '—'}
                </div>
                <div style={{ fontSize: 11, color: totalFollowersDiff >= 0 ? '#15803d' : '#b91c1c', marginTop: 2, fontWeight: 600 }}>
                  {totalInitialFollowers > 0
                    ? `${totalFollowersDiff >= 0 ? '+' : ''}${totalGrowthPct.toFixed(1)}% total growth`
                    : 'Set baseline to see %'}
                </div>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>Content Yield</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                  {totals.posts > 0 && totalFollowersDiff > 0
                    ? `+${formatNumber(Math.round(totalFollowersDiff / totals.posts))}`
                    : '—'}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  Avg. followers gained / post
                </div>
              </div>
            </div>

            {/* Platform Breakdown: Instagram & TikTok */}
            <div className="grid-responsive-2" style={{ gap: 12 }}>
              {/* Instagram Profile Box */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #fbcfe8',
                  borderRadius: 8,
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <InstagramIcon size={16} color="#be185d" />
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#9d174d' }}>Instagram</span>
                      {existingIg?.handle && (
                        <a
                          href={existingIg.url || `https://instagram.com/${cleanSocialHandle(existingIg.handle).replace(/^@/, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: 11.5,
                            color: '#be185d',
                            backgroundColor: '#fdf2f8',
                            border: '1px solid #fbcfe8',
                            padding: '2px 7px',
                            borderRadius: '5px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            textDecoration: 'none',
                            fontWeight: 600,
                          }}
                        >
                          <span>{cleanSocialHandle(existingIg.handle)}</span>
                          <ExternalLink size={10} />
                        </a>
                      )}
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleSyncProfileFollowers('instagram')}
                      disabled={syncingSocialPlatform === 'instagram' || !existingIg?.handle}
                      style={{
                        fontSize: 11,
                        padding: '3px 8px',
                        backgroundColor: '#fdf2f8',
                        color: '#be185d',
                        borderColor: '#fbcfe8',
                      }}
                      title="Fetch live follower count via Apify"
                    >
                      <RefreshCw size={11} className={syncingSocialPlatform === 'instagram' ? 'animate-spin' : ''} />
                      <span>{syncingSocialPlatform === 'instagram' ? 'Syncing...' : 'Sync Live'}</span>
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 8, marginTop: 8 }}>
                    <div>
                      <span style={{ fontSize: 10.5, color: '#64748b', display: 'block' }}>Starting Baseline</span>
                      <strong style={{ fontSize: 14, color: '#1e293b' }}>
                        {existingIg?.initialFollowers != null ? formatNumber(existingIg.initialFollowers) : '—'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: 10.5, color: '#64748b', display: 'block' }}>Current Followers</span>
                      <strong style={{ fontSize: 14, color: '#9d174d' }}>
                        {existingIg?.followers != null ? formatNumber(existingIg.followers) : '—'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: 10.5, color: '#64748b', display: 'block' }}>Growth</span>
                      {existingIg?.initialFollowers != null && existingIg?.followers != null ? (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: igDiff >= 0 ? '#059669' : '#dc2626',
                          }}
                        >
                          {igDiff >= 0 ? `+${formatNumber(igDiff)}` : formatNumber(igDiff)} ({igDiff >= 0 ? `+${igGrowthPct.toFixed(1)}%` : `${igGrowthPct.toFixed(1)}%`})
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>—</span>
                      )}
                    </div>
                  </div>
                </div>
                {!existingIg?.handle && (
                  <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8' }}>
                    No Instagram handle set. Click "Edit Account" above to add it.
                  </div>
                )}
              </div>

              {/* TikTok Profile Box */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <TikTokIcon size={16} color="#0f172a" />
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>TikTok</span>
                      {existingTt?.handle && (
                        <a
                          href={existingTt.url || `https://tiktok.com/@${cleanSocialHandle(existingTt.handle).replace(/^@/, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: 11.5,
                            color: '#111827',
                            backgroundColor: '#f3f4f6',
                            border: '1px solid #e5e7eb',
                            padding: '2px 7px',
                            borderRadius: '5px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            textDecoration: 'none',
                            fontWeight: 600,
                          }}
                        >
                          <span>{cleanSocialHandle(existingTt.handle)}</span>
                          <ExternalLink size={10} />
                        </a>
                      )}
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleSyncProfileFollowers('tiktok')}
                      disabled={syncingSocialPlatform === 'tiktok' || !existingTt?.handle}
                      style={{
                        fontSize: 11,
                        padding: '3px 8px',
                        backgroundColor: '#f3f4f6',
                        color: '#111827',
                        borderColor: '#d1d5db',
                      }}
                      title="Fetch live follower count via Apify"
                    >
                      <RefreshCw size={11} className={syncingSocialPlatform === 'tiktok' ? 'animate-spin' : ''} />
                      <span>{syncingSocialPlatform === 'tiktok' ? 'Syncing...' : 'Sync Live'}</span>
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 8, marginTop: 8 }}>
                    <div>
                      <span style={{ fontSize: 10.5, color: '#64748b', display: 'block' }}>Starting Baseline</span>
                      <strong style={{ fontSize: 14, color: '#1e293b' }}>
                        {existingTt?.initialFollowers != null ? formatNumber(existingTt.initialFollowers) : '—'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: 10.5, color: '#64748b', display: 'block' }}>Current Followers</span>
                      <strong style={{ fontSize: 14, color: '#111827' }}>
                        {existingTt?.followers != null ? formatNumber(existingTt.followers) : '—'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: 10.5, color: '#64748b', display: 'block' }}>Growth</span>
                      {existingTt?.initialFollowers != null && existingTt?.followers != null ? (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: ttDiff >= 0 ? '#059669' : '#dc2626',
                          }}
                        >
                          {ttDiff >= 0 ? `+${formatNumber(ttDiff)}` : formatNumber(ttDiff)} ({ttDiff >= 0 ? `+${ttGrowthPct.toFixed(1)}%` : `${ttGrowthPct.toFixed(1)}%`})
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>—</span>
                      )}
                    </div>
                  </div>
                </div>
                {!existingTt?.handle && (
                  <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8' }}>
                    No TikTok handle set. Click "Edit Account" above to add it.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: 0 }}>
              Post Performance & Video Engagement
            </h4>
            <span style={{ fontSize: 11.5, color: '#64748b' }}>
              Sync stats per video link via Apify
            </span>
          </div>

          <div className="grid-responsive-4" style={{ gap: 12, marginBottom: 16 }}>
            <Stat label="Total Views" value={formatNumber(totals.views)} />
            <Stat label="Total Likes" value={formatNumber(totals.likes)} />
            <Stat label="Total Comments" value={formatNumber(totals.comments)} />
            <Stat label="Engagement Rate" value={formatPercent(totals.rate, 1)} />
          </div>
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <div className="table-responsive-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: 160 }}>Post Concept / Content</th>
                    <th>Platform</th>
                    <th>Views</th>
                    <th>Likes</th>
                    <th>Comments</th>
                    <th style={{ textAlign: 'right', paddingRight: 16 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {published.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '32px 16px', color: '#9ca3af' }}>
                        No published posts or engagement data tracked yet.
                        <div style={{ fontSize: 12, marginTop: 4 }}>
                          Add a deliverable with an Instagram or TikTok link in the Content tab to automatically sync numbers.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    published
                      .slice()
                      .sort((a, b) => (b.latestMetrics?.views || 0) - (a.latestMetrics?.views || 0))
                      .map((d) => (
                        <tr key={d.id}>
                          <td>
                            <div style={{ fontWeight: 600, color: '#111827' }}>{d.idea}</div>
                            {d.platform === 'both' || (d.instagramLink && d.tiktokLink) ? (
                              <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                                {d.instagramLink && (
                                  <a
                                    href={d.instagramLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      fontSize: 11,
                                      color: '#db2777',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3,
                                      textDecoration: 'none',
                                      backgroundColor: '#fdf2f8',
                                      padding: '1px 6px',
                                      borderRadius: 4,
                                    }}
                                  >
                                    <InstagramIcon size={11} color="#db2777" />
                                    IG Post
                                  </a>
                                )}
                                {d.tiktokLink && (
                                  <a
                                    href={d.tiktokLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      fontSize: 11,
                                      color: '#0891b2',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3,
                                      textDecoration: 'none',
                                      backgroundColor: '#ecfeff',
                                      padding: '1px 6px',
                                      borderRadius: 4,
                                    }}
                                  >
                                    <TikTokIcon size={11} color="#0891b2" />
                                    TikTok Post
                                  </a>
                                )}
                              </div>
                            ) : (
                              (d.instagramLink || d.tiktokLink || d.link) && (
                                <a
                                  href={d.instagramLink || d.tiktokLink || d.link || '#'}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    fontSize: 11,
                                    color: '#4f46e5',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                    marginTop: 2,
                                    textDecoration: 'none',
                                  }}
                                >
                                  {d.platform === 'instagram' ? (
                                    <InstagramIcon size={11} color="#db2777" />
                                  ) : d.platform === 'tiktok' ? (
                                    <TikTokIcon size={11} color="#0891b2" />
                                  ) : (
                                    <ExternalLink size={10} />
                                  )}
                                  View Live Post
                                </a>
                              )
                            )}
                          </td>
                          <td>
                            {d.platform === 'both' || (d.instagramLink && d.tiktokLink) ? (
                              <div style={{ display: 'inline-flex', gap: 4 }}>
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    backgroundColor: '#fdf2f8',
                                    color: '#be185d',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                  }}
                                >
                                  <InstagramIcon size={10} color="#be185d" /> IG
                                </span>
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    backgroundColor: '#f3f4f6',
                                    color: '#111827',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                  }}
                                >
                                  <TikTokIcon size={10} color="#111827" /> TikTok
                                </span>
                              </div>
                            ) : (
                              <span
                                style={{
                                  textTransform: 'capitalize',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                  backgroundColor: d.platform === 'instagram' ? '#fdf2f8' : d.platform === 'tiktok' ? '#f3f4f6' : '#eff6ff',
                                  color: d.platform === 'instagram' ? '#be185d' : '#1f2937',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                {d.platform === 'instagram' && <InstagramIcon size={11} color="#be185d" />}
                                {d.platform === 'tiktok' && <TikTokIcon size={11} color="#1f2937" />}
                                {d.platform || 'General'}
                              </span>
                            )}
                          </td>
                          <td style={{ fontWeight: 700, color: '#111827' }}>
                            {formatNumber(d.latestMetrics?.views) || '0'}
                          </td>
                          <td style={{ color: '#374151' }}>
                            {formatNumber(d.latestMetrics?.likes) || '0'}
                          </td>
                          <td style={{ color: '#374151' }}>
                            {formatNumber(d.latestMetrics?.comments) || '0'}
                          </td>
                          <td style={{ textAlign: 'right', paddingRight: 16 }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              {(d.link || d.instagramLink || d.tiktokLink) && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleSyncPost(d.id)}
                                  disabled={syncingPostId === d.id}
                                  style={{
                                    fontSize: 11,
                                    padding: '2px 8px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                  title={
                                    d.platform === 'both' || (d.instagramLink && d.tiktokLink)
                                      ? 'Fetch latest views & likes for both Instagram & TikTok'
                                      : 'Fetch latest views & likes via Apify'
                                  }
                                >
                                  <RefreshCw size={11} className={syncingPostId === d.id ? 'animate-spin' : ''} />
                                  <span>
                                    {syncingPostId === d.id
                                      ? 'Syncing...'
                                      : d.platform === 'both' || (d.instagramLink && d.tiktokLink)
                                      ? 'Sync Both'
                                      : 'Sync'}
                                  </span>
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => setMetricsFor(d)}
                                style={{ fontSize: 11, padding: '2px 6px' }}
                                title="Edit or log manual metrics"
                              >
                                Edit
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                  )}
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
          {(currentClient.creatorAssignments ?? []).length === 0 ? (
            <p style={{ fontSize: 13, color: '#9ca3af' }}>No partners booked yet.</p>
          ) : (
            (currentClient.creatorAssignments ?? []).map((ca) => (
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
                Générez et imprimez les factures officielles avec les coordonnées de {currentClient.name}.
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
                padding: 18,
                marginBottom: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: 10, alignItems: 'start' }}>
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
                    Option TVA
                  </label>
                  <select
                    className="input-field"
                    value={newInvoiceIsCustomVat ? 'custom' : String(newInvoiceVatRate)}
                    onChange={(e) => {
                      if (e.target.value === 'custom') {
                        setNewInvoiceIsCustomVat(true);
                      } else {
                        setNewInvoiceIsCustomVat(false);
                        setNewInvoiceVatRate(Number(e.target.value));
                      }
                    }}
                  >
                    <option value="0.19">19% (Standard)</option>
                    <option value="0.07">7% (Réduit)</option>
                    <option value="0">0% (Sans TVA / Exonéré)</option>
                    <option value="custom">Autre %</option>
                  </select>
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
              </div>

              {newInvoiceIsCustomVat && (
                <div style={{ maxWidth: 200 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: 4 }}>
                    Pourcentage TVA (%)
                  </label>
                  <input
                    className="input-field"
                    type="number"
                    step="0.1"
                    placeholder="ex: 13"
                    value={newInvoiceCustomVat}
                    onChange={(e) => setNewInvoiceCustomVat(e.target.value)}
                  />
                </div>
              )}

              {/* Real-time Invoice Calculation Summary Bar */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  padding: '8px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Montant HT: </span>
                    <strong style={{ color: '#1e293b' }}>{formatMoney(newInvoiceSubtotalNum)}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>TVA ({Math.round(activeNewInvoiceVat * 100)}%): </span>
                    <strong style={{ color: '#4f46e5' }}>+{formatMoney(newInvoiceVatAmount)}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Total TTC: </span>
                    <strong style={{ color: '#059669', fontSize: 13 }}>{formatMoney(newInvoiceTotalTTC)}</strong>
                  </div>
                </div>

                <button type="submit" disabled={creatingInvoice} className="btn btn-primary btn-sm">
                  {creatingInvoice ? 'Création…' : 'Émettre Facture'}
                </button>
              </div>
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
                        <div>{formatMoney(inv.total)}</div>
                        <div style={{ fontSize: 10, color: '#64748b', fontWeight: 500 }}>
                          {(inv.vatRate ?? 0.19) === 0 ? (
                            <span style={{ color: '#64748b' }}>Sans TVA (0%)</span>
                          ) : (
                            <span>TVA {Math.round((inv.vatRate ?? 0.19) * 100)}%</span>
                          )}
                        </div>
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
        <div className="grid-responsive-2" style={{ gap: 16, alignItems: 'start' }}>
          <ChatThread
            clientId={currentClient.id}
            initialMessages={messages}
            user={user}
            onSaveInspiration={async (savedUrl) => {
              try {
                const res = await fetch(`/api/clients/${currentClient.id}/inspirations`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ url: savedUrl }),
                });
                if (res.ok) {
                  const data = await res.json();
                  setCurrentClient((prev) => ({
                    ...prev,
                    tags: data.tags || prev.tags,
                    inspirations: data.inspirations,
                  }));
                  alert('Saved reel/video link to Inspiration Ideas!');
                }
              } catch (err) {
                console.error('Failed to save inspiration from chat:', err);
              }
            }}
          />
          <ClientInspirationBoard
            client={currentClient}
            user={user}
            onClientUpdated={(updated) => setCurrentClient(updated)}
            onDeliverableAdded={refreshDeliverables}
          />
        </div>
      )}

      {metricsFor && (
        <MetricsEntryModal
          deliverableId={metricsFor.id}
          idea={metricsFor.idea}
          onClose={() => setMetricsFor(null)}
          onSaved={() => refreshDeliverables()}
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

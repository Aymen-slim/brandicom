'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClientData, ClientStatus, UserSummary } from '@/types';
import { StatusBadge } from './StatusBadge';
import { formatMoney, formatTenure, formatNumber, formatPercent, cleanSocialHandle, parseFollowerInput } from '@/lib/format';
import { InstagramIcon, TikTokIcon } from './SocialIcons';
import {
  MapPin,
  Edit,
  Trash2,
  Users,
  Calendar,
  X,
  TrendingUp,
  ExternalLink,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface ClientDetailHeaderProps {
  client: ClientData;
  availableUsers: UserSummary[];
  user?: UserSummary | null;
  onClientUpdated?: (updated: ClientData) => void;
}

export function ClientDetailHeader({
  client: initialClient,
  availableUsers,
  user,
  onClientUpdated,
}: ClientDetailHeaderProps) {
  const router = useRouter();
  const isAdmin = user?.role === 'admin';

  const [client, setClient] = useState<ClientData>(initialClient);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Existing socials from client
  const existingIg = (client.socialAccounts || []).find((s) => s.platform === 'instagram');
  const existingTt = (client.socialAccounts || []).find((s) => s.platform === 'tiktok');

  // Form edit state
  const [name, setName] = useState(client.name);
  const [location, setLocation] = useState(client.location || '');
  const [status, setStatus] = useState<ClientStatus>(client.status);
  const [monthlyFee, setMonthlyFee] = useState(client.contract?.monthlyFee != null ? String(client.contract.monthlyFee) : '');
  const [industry, setIndustry] = useState(client.industry || '');
  const [contactName, setContactName] = useState(client.contactName || '');
  const [contactEmail, setContactEmail] = useState(client.contactEmail || '');
  const [contactPhone, setContactPhone] = useState(client.contactPhone || '');
  const [startDate, setStartDate] = useState(client.startDate || '');
  const [services, setServices] = useState((client.services || []).join(', '));
  const [notes, setNotes] = useState(client.notes || '');
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>(
    (client.assignments || []).map((a) => a.userId)
  );

  // Social account inputs (stored as clean handle e.g. @brand)
  const [igHandle, setIgHandle] = useState(cleanSocialHandle(existingIg?.handle || existingIg?.url));
  const [igFollowers, setIgFollowers] = useState(existingIg?.followers != null ? String(existingIg.followers) : '');
  const [igInitialFollowers, setIgInitialFollowers] = useState(
    existingIg?.initialFollowers != null ? String(existingIg.initialFollowers) : ''
  );

  const [ttHandle, setTtHandle] = useState(cleanSocialHandle(existingTt?.handle || existingTt?.url));
  const [ttFollowers, setTtFollowers] = useState(existingTt?.followers != null ? String(existingTt.followers) : '');
  const [ttInitialFollowers, setTtInitialFollowers] = useState(
    existingTt?.initialFollowers != null ? String(existingTt.initialFollowers) : ''
  );

  const [fetchingSocial, setFetchingSocial] = useState<'instagram' | 'tiktok' | null>(null);

  // Sync / fetch live followers for a platform using Apify
  const handleAutoFetchFollowers = async (platform: 'instagram' | 'tiktok') => {
    const raw = platform === 'instagram' ? igHandle : ttHandle;
    const clean = cleanSocialHandle(raw);
    if (!clean) {
      alert(`Please enter an ${platform === 'instagram' ? 'Instagram' : 'TikTok'} username first.`);
      return;
    }
    setFetchingSocial(platform);
    try {
      const res = await fetch('/api/social/fetch-followers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urlOrHandle: clean, platform }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch followers');
      if (platform === 'instagram') {
        setIgFollowers(String(data.followers));
        if (data.handle) setIgHandle(cleanSocialHandle(data.handle));
        if (!igInitialFollowers) setIgInitialFollowers(String(data.followers));
      } else {
        setTtFollowers(String(data.followers));
        if (data.handle) setTtHandle(cleanSocialHandle(data.handle));
        if (!ttInitialFollowers) setTtInitialFollowers(String(data.followers));
      }
    } catch (err: any) {
      alert(`Auto-fetch error: ${err.message}`);
    } finally {
      setFetchingSocial(null);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const parsedIgFollowers = parseFollowerInput(igFollowers);
      const parsedIgInitial = parseFollowerInput(igInitialFollowers);
      const cleanIg = cleanSocialHandle(igHandle);

      const parsedTtFollowers = parseFollowerInput(ttFollowers);
      const parsedTtInitial = parseFollowerInput(ttInitialFollowers);
      const cleanTt = cleanSocialHandle(ttHandle);

      const socialAccountsPayload = [
        {
          platform: 'instagram' as const,
          handle: cleanIg || null,
          url: cleanIg ? `https://instagram.com/${cleanIg.replace(/^@/, '')}` : null,
          followers: parsedIgFollowers,
          initialFollowers: parsedIgInitial,
        },
        {
          platform: 'tiktok' as const,
          handle: cleanTt || null,
          url: cleanTt ? `https://tiktok.com/@${cleanTt.replace(/^@/, '')}` : null,
          followers: parsedTtFollowers,
          initialFollowers: parsedTtInitial,
        },
      ].filter((s) => s.handle || s.followers != null || s.initialFollowers != null);

      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          location: location.trim() || null,
          status,
          services: services.split(',').map((s) => s.trim()).filter(Boolean),
          notes: notes.trim() || null,
          assignedUserIds,
          industry: industry.trim() || null,
          contactName: contactName.trim() || null,
          contactEmail: contactEmail.trim() || null,
          contactPhone: contactPhone.trim() || null,
          startDate: startDate || null,
          socialAccounts: socialAccountsPayload,
          contract: isAdmin
            ? { monthlyFee: monthlyFee ? parseFloat(monthlyFee) : null, contractType: 'retainer' }
            : undefined,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setClient((prev) => ({ ...prev, ...updated }));
        setShowEditModal(false);
        if (onClientUpdated) onClientUpdated(updated);
        router.refresh();
      }
    } catch (err) {
      console.error('Failed to update client:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to permanently remove "${client.name}" and all its deliverables?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        router.push('/clients');
      }
    } catch (err) {
      console.error('Failed to delete client:', err);
    }
  };

  const toggleUserAssignment = (uid: string) => {
    setAssignedUserIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleHeaderStageChange = async (newStatus: ClientStatus) => {
    setStatus(newStatus);
    setClient((prev) => ({ ...prev, status: newStatus }));

    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setClient((prev) => ({ ...prev, ...updated }));
        if (onClientUpdated) onClientUpdated(updated);
        router.refresh();
      }
    } catch (err) {
      console.error('Failed to update stage:', err);
    }
  };

  return (
    <div
      className="glass-card"
      style={{
        padding: '20px 24px',
        marginBottom: '18px',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        {/* Left Info: Name, location, status, services */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' }}>
              {client.name}
            </h1>
            <select
              value={client.status}
              onChange={(e) => handleHeaderStageChange(e.target.value as ClientStatus)}
              style={{
                fontSize: '11.5px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                backgroundColor:
                  client.status === 'active'
                    ? '#ecfdf5'
                    : client.status === 'starting'
                    ? '#e0f2fe'
                    : client.status === 'potential'
                    ? '#f3e8ff'
                    : client.status === 'paused'
                    ? '#fffbeb'
                    : '#ffe4e6',
                color:
                  client.status === 'active'
                    ? '#047857'
                    : client.status === 'starting'
                    ? '#0284c7'
                    : client.status === 'potential'
                    ? '#7e22ce'
                    : client.status === 'paused'
                    ? '#b45309'
                    : '#be123c',
                cursor: 'pointer',
              }}
              title="Change Client Stage"
            >
              <option value="potential">Potential</option>
              <option value="starting">Starting</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="churned">Churned</option>
            </select>
            {client.health && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: client.health.risk === 'high' ? '#ffe4e6' : client.health.risk === 'medium' ? '#fffbeb' : '#ecfdf5',
                  color: client.health.risk === 'high' ? '#e11d48' : client.health.risk === 'medium' ? '#d97706' : '#059669',
                }}
              >
                Health {client.health.score}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px', color: '#6b7280', fontSize: '12.5px' }}>
            {client.location && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <MapPin size={13} color="#9ca3af" />
                <span>{client.location}</span>
              </div>
            )}
            {client.industry && <span>{client.industry}</span>}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4338ca', fontWeight: 600 }}>
              <Calendar size={13} color="#6366f1" />
              <span>{formatTenure(client.startDate)}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={13} color="#9ca3af" />
              <span>Team:</span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                {client.assignments && client.assignments.length > 0 ? (
                  client.assignments.map((a, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 500,
                        backgroundColor: '#f3f4f6',
                        color: '#374151',
                      }}
                    >
                      {a.user.name}
                    </span>
                  ))
                ) : (
                  <span style={{ color: '#9ca3af' }}>None</span>
                )}
              </div>
            </div>
            {/* Social Accounts & Follower Growth Badges */}
            {(existingIg?.handle || existingTt?.handle) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                {existingIg && (existingIg.handle || existingIg.url) && (
                  <a
                    href={existingIg.url || `https://instagram.com/${cleanSocialHandle(existingIg.handle).replace(/^@/, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '3px 10px',
                      borderRadius: 6,
                      backgroundColor: '#fdf2f8',
                      color: '#9d174d',
                      border: '1px solid #fbcfe8',
                      textDecoration: 'none',
                    }}
                    title="Open Instagram Profile"
                  >
                    <InstagramIcon size={13} color="#be185d" />
                    <span>{cleanSocialHandle(existingIg.handle) || 'Instagram'}</span>
                    {existingIg.followers != null && (
                      <span style={{ color: '#be185d', fontWeight: 700 }}>
                        · {formatNumber(existingIg.followers)}
                      </span>
                    )}
                  </a>
                )}

                {existingTt && (existingTt.handle || existingTt.url) && (
                  <a
                    href={existingTt.url || `https://tiktok.com/@${cleanSocialHandle(existingTt.handle).replace(/^@/, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '3px 10px',
                      borderRadius: 6,
                      backgroundColor: '#f8fafc',
                      color: '#0f172a',
                      border: '1px solid #e2e8f0',
                      textDecoration: 'none',
                    }}
                    title="Open TikTok Profile"
                  >
                    <TikTokIcon size={13} color="#0f172a" />
                    <span>{cleanSocialHandle(existingTt.handle) || 'TikTok'}</span>
                    {existingTt.followers != null && (
                      <span style={{ color: '#0f172a', fontWeight: 700 }}>
                        · {formatNumber(existingTt.followers)}
                      </span>
                    )}
                  </a>
                )}

                {/* Follower Growth Comparison Pill */}
                {(() => {
                  const cur = (existingIg?.followers || 0) + (existingTt?.followers || 0);
                  const base = (existingIg?.initialFollowers || 0) + (existingTt?.initialFollowers || 0);
                  if (base > 0 && cur > 0) {
                    const diff = cur - base;
                    const pct = (diff / base) * 100;
                    return (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: 6,
                          backgroundColor: diff >= 0 ? '#ecfdf5' : '#fef2f2',
                          color: diff >= 0 ? '#047857' : '#b91c1c',
                          border: `1px solid ${diff >= 0 ? '#a7f3d0' : '#fecaca'}`,
                        }}
                        title={`Started with ${formatNumber(base)} followers on ${client.startDate || 'start date'} → Currently ${formatNumber(cur)}`}
                      >
                        <TrendingUp size={13} />
                        <span>
                          {diff >= 0 ? `+${formatNumber(diff)}` : formatNumber(diff)} followers ({diff >= 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`})
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
          </div>

          {/* Services Pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '12px' }}>
            {(client.services || []).map((service, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: '#f3f4f6',
                  color: '#4b5563',
                  fontWeight: 500,
                }}
              >
                {service}
              </span>
            ))}
          </div>
        </div>

        {/* Right Info: Retainer & Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px', minWidth: '120px' }}>
          {isAdmin && (
          <div style={{ textAlign: 'left' }}>
            <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>
              Monthly fee
            </span>
            <div
              style={{
                fontSize: '22px',
                fontWeight: 800,
                color: '#111827',
                fontVariantNumeric: 'tabular-nums',
                marginTop: '1px',
              }}
            >
              {client.contract?.monthlyFee != null ? formatMoney(client.contract.monthlyFee) : '—'}
            </div>
          </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowEditModal(true)}
              className="btn btn-secondary btn-sm"
            >
              <Edit size={13} />
              Edit Account
            </button>
            {isAdmin && (
              <button
                onClick={handleDelete}
                className="btn btn-danger btn-sm"
                title="Delete Account"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Edit Client Modal */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal-container" style={{ padding: '24px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '18px',
              }}
            >
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>
                Edit Client: {client.name}
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="btn btn-ghost btn-sm"
                style={{ padding: '4px' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="grid-responsive-2" style={{ gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                    Client Brand Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-field"
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                    Client Stage *
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ClientStatus)}
                    className="input-field"
                    style={{
                      fontWeight: 600,
                      backgroundColor:
                        status === 'active'
                          ? '#ecfdf5'
                          : status === 'starting'
                          ? '#e0f2fe'
                          : status === 'potential'
                          ? '#f3e8ff'
                          : status === 'paused'
                          ? '#fffbeb'
                          : '#ffe4e6',
                    }}
                  >
                    <option value="potential">Potential (Lead / Proposal)</option>
                    <option value="starting">Starting (Onboarding)</option>
                    <option value="active">Active (Ongoing Retainer)</option>
                    <option value="paused">Paused (On Hold)</option>
                    <option value="churned">Churned (Inactive)</option>
                  </select>
                </div>
              </div>

              <div className="grid-responsive-2" style={{ gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                    Location
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="input-field"
                  />
                </div>

                {isAdmin && (
                <div>
                  <label style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                    Monthly fee (TND)
                  </label>
                  <input
                    type="number"
                    value={monthlyFee}
                    onChange={(e) => setMonthlyFee(e.target.value)}
                    className="input-field"
                  />
                </div>
                )}
              </div>

              <div className="grid-responsive-3" style={{ gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>Industry</label>
                  <input className="input-field" value={industry} onChange={(e) => setIndustry(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>Client Start date</label>
                  <input type="date" className="input-field" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  {startDate && (
                    <div style={{ marginTop: 3, fontSize: 10.5, color: '#4338ca', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Calendar size={11} /> {formatTenure(startDate)}
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>Contact</label>
                  <input className="input-field" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Name" />
                </div>
              </div>
              <div className="grid-responsive-2" style={{ gap: 12 }}>
                <input className="input-field" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Email" />
                <input className="input-field" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Phone" />
              </div>

              {/* Social Channels & Follower Tracking Section */}
              <div
                style={{
                  padding: '16px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <TrendingUp size={15} color="#4f46e5" />
                    <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                      Social Channels & Audience Growth
                    </strong>
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Track before (starting baseline) vs after (current count)
                  </span>
                </div>

                {/* Instagram Section */}
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    padding: '14px',
                    borderRadius: '8px',
                    border: '1px solid #fbcfe8',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <InstagramIcon size={15} color="#be185d" />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#9d174d' }}>
                        Instagram
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAutoFetchFollowers('instagram')}
                      disabled={fetchingSocial === 'instagram' || !igHandle.trim()}
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '3px 9px',
                        borderRadius: '4px',
                        backgroundColor: '#fdf2f8',
                        color: '#be185d',
                        border: '1px solid #fbcfe8',
                        cursor: fetchingSocial === 'instagram' || !igHandle.trim() ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      title="Fetch live follower count via Apify"
                    >
                      <RefreshCw size={11} className={fetchingSocial === 'instagram' ? 'animate-spin' : ''} />
                      {fetchingSocial === 'instagram' ? 'Fetching...' : 'Auto-fetch live'}
                    </button>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: '11px', color: '#475569', display: 'block', marginBottom: 4, fontWeight: 600 }}>
                      Account Username
                    </label>
                    <input
                      type="text"
                      placeholder="@username"
                      value={igHandle}
                      onChange={(e) => setIgHandle(cleanSocialHandle(e.target.value))}
                      className="input-field"
                      style={{ fontSize: '12.5px' }}
                    />
                  </div>

                  {/* Before & After Follower Inputs */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>
                          Before (Starting Baseline)
                        </span>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>
                          {startDate ? startDate : 'Contract start'}
                        </span>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. 10k or 10,000"
                        value={igInitialFollowers}
                        onChange={(e) => setIgInitialFollowers(e.target.value)}
                        className="input-field"
                        style={{ fontSize: '13px', fontWeight: 600 }}
                      />
                      <div style={{ marginTop: 4, fontSize: '10.5px', color: '#64748b' }}>
                        {parseFollowerInput(igInitialFollowers) != null
                          ? `= ${formatNumber(parseFollowerInput(igInitialFollowers))} followers`
                          : 'Enter starting baseline'}
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>
                          After (Current Live)
                        </span>
                        <span style={{ fontSize: '10px', color: '#047857', fontWeight: 600 }}>
                          Live count
                        </span>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. 18.5k or 18,500"
                        value={igFollowers}
                        onChange={(e) => setIgFollowers(e.target.value)}
                        className="input-field"
                        style={{ fontSize: '13px', fontWeight: 700, color: '#9d174d' }}
                      />
                      <div style={{ marginTop: 4, fontSize: '10.5px', color: '#64748b' }}>
                        {parseFollowerInput(igFollowers) != null
                          ? `= ${formatNumber(parseFollowerInput(igFollowers))} followers`
                          : 'Enter current count or auto-fetch'}
                      </div>
                    </div>
                  </div>

                  {/* Growth Pill for Instagram */}
                  {(() => {
                    const cur = parseFollowerInput(igFollowers);
                    const base = parseFollowerInput(igInitialFollowers);
                    if (base != null && cur != null) {
                      const diff = cur - base;
                      const pct = base > 0 ? (diff / base) * 100 : 0;
                      return (
                        <div
                          style={{
                            marginTop: 10,
                            padding: '6px 10px',
                            borderRadius: '5px',
                            backgroundColor: diff >= 0 ? '#ecfdf5' : '#fef2f2',
                            border: `1px solid ${diff >= 0 ? '#a7f3d0' : '#fecaca'}`,
                            fontSize: '11.5px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span style={{ color: diff >= 0 ? '#065f46' : '#991b1b', fontWeight: 600 }}>
                            Net Instagram Growth:
                          </span>
                          <span style={{ fontWeight: 800, color: diff >= 0 ? '#047857' : '#b91c1c' }}>
                            {diff >= 0 ? `+${formatNumber(diff)}` : formatNumber(diff)} ({diff >= 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`})
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* TikTok Section */}
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    padding: '14px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <TikTokIcon size={15} color="#0f172a" />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                        TikTok
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAutoFetchFollowers('tiktok')}
                      disabled={fetchingSocial === 'tiktok' || !ttHandle.trim()}
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '3px 9px',
                        borderRadius: '4px',
                        backgroundColor: '#f8fafc',
                        color: '#0f172a',
                        border: '1px solid #cbd5e1',
                        cursor: fetchingSocial === 'tiktok' || !ttHandle.trim() ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      title="Fetch live follower count via Apify"
                    >
                      <RefreshCw size={11} className={fetchingSocial === 'tiktok' ? 'animate-spin' : ''} />
                      {fetchingSocial === 'tiktok' ? 'Fetching...' : 'Auto-fetch live'}
                    </button>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: '11px', color: '#475569', display: 'block', marginBottom: 4, fontWeight: 600 }}>
                      Account Username
                    </label>
                    <input
                      type="text"
                      placeholder="@username"
                      value={ttHandle}
                      onChange={(e) => setTtHandle(cleanSocialHandle(e.target.value))}
                      className="input-field"
                      style={{ fontSize: '12.5px' }}
                    />
                  </div>

                  {/* Before & After Follower Inputs */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>
                          Before (Starting Baseline)
                        </span>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>
                          {startDate ? startDate : 'Contract start'}
                        </span>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. 5k or 5,000"
                        value={ttInitialFollowers}
                        onChange={(e) => setTtInitialFollowers(e.target.value)}
                        className="input-field"
                        style={{ fontSize: '13px', fontWeight: 600 }}
                      />
                      <div style={{ marginTop: 4, fontSize: '10.5px', color: '#64748b' }}>
                        {parseFollowerInput(ttInitialFollowers) != null
                          ? `= ${formatNumber(parseFollowerInput(ttInitialFollowers))} followers`
                          : 'Enter starting baseline'}
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>
                          After (Current Live)
                        </span>
                        <span style={{ fontSize: '10px', color: '#047857', fontWeight: 600 }}>
                          Live count
                        </span>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. 15k or 15,000"
                        value={ttFollowers}
                        onChange={(e) => setTtFollowers(e.target.value)}
                        className="input-field"
                        style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}
                      />
                      <div style={{ marginTop: 4, fontSize: '10.5px', color: '#64748b' }}>
                        {parseFollowerInput(ttFollowers) != null
                          ? `= ${formatNumber(parseFollowerInput(ttFollowers))} followers`
                          : 'Enter current count or auto-fetch'}
                      </div>
                    </div>
                  </div>

                  {/* Growth Pill for TikTok */}
                  {(() => {
                    const cur = parseFollowerInput(ttFollowers);
                    const base = parseFollowerInput(ttInitialFollowers);
                    if (base != null && cur != null) {
                      const diff = cur - base;
                      const pct = base > 0 ? (diff / base) * 100 : 0;
                      return (
                        <div
                          style={{
                            marginTop: 10,
                            padding: '6px 10px',
                            borderRadius: '5px',
                            backgroundColor: diff >= 0 ? '#ecfdf5' : '#fef2f2',
                            border: `1px solid ${diff >= 0 ? '#a7f3d0' : '#fecaca'}`,
                            fontSize: '11.5px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span style={{ color: diff >= 0 ? '#065f46' : '#991b1b', fontWeight: 600 }}>
                            Net TikTok Growth:
                          </span>
                          <span style={{ fontWeight: 800, color: diff >= 0 ? '#047857' : '#b91c1c' }}>
                            {diff >= 0 ? `+${formatNumber(diff)}` : formatNumber(diff)} ({diff >= 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`})
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* Overall Audience Growth Comparison Banner */}
                {(() => {
                  const curIg = parseFollowerInput(igFollowers) || 0;
                  const curTt = parseFollowerInput(ttFollowers) || 0;
                  const curTotal = curIg + curTt;

                  const baseIg = parseFollowerInput(igInitialFollowers) || 0;
                  const baseTt = parseFollowerInput(ttInitialFollowers) || 0;
                  const baseTotal = baseIg + baseTt;

                  if (baseTotal > 0 && curTotal > 0) {
                    const diff = curTotal - baseTotal;
                    const pct = (diff / baseTotal) * 100;
                    return (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          backgroundColor: diff >= 0 ? '#ecfdf5' : '#fef2f2',
                          border: `1px solid ${diff >= 0 ? '#a7f3d0' : '#fecaca'}`,
                          fontSize: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: diff >= 0 ? '#065f46' : '#991b1b' }}>
                          <TrendingUp size={14} />
                          <span>
                            <strong>Combined Audience:</strong> Started with {formatNumber(baseTotal)} → Currently {formatNumber(curTotal)}
                          </span>
                        </div>
                        <span style={{ fontWeight: 800, color: diff >= 0 ? '#047857' : '#b91c1c' }}>
                          {diff >= 0 ? `+${formatNumber(diff)}` : formatNumber(diff)} ({diff >= 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`})
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Services (comma separated)
                </label>
                <input
                  type="text"
                  value={services}
                  onChange={(e) => setServices(e.target.value)}
                  className="input-field"
                />
              </div>

              {/* Assign team members */}
              <div>
                <label style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                  Assigned Team Members
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {(availableUsers || []).map((u) => {
                    const isSelected = assignedUserIds.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleUserAssignment(u.id)}
                        className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '11px' }}
                      >
                        {isSelected ? '✓ ' : '+ '}
                        {u.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Account Strategy & Notes
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input-field"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

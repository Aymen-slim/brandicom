'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClientData, ClientStatus, UserSummary } from '@/types';
import { StatusBadge } from './StatusBadge';
import { formatMoney, formatTenure, formatNumber } from '@/lib/format';
import {
  Search,
  Plus,
  Download,
  ArrowRight,
  MessageSquare,
  Video,
  X,
  MapPin,
  Clock,
  Sparkles,
} from 'lucide-react';

interface ClientTableProps {
  initialClients: ClientData[];
  availableUsers: UserSummary[];
  user?: UserSummary | null;
}

export function ClientTable({ initialClients, availableUsers, user }: ClientTableProps) {
  const router = useRouter();
  const isAdmin = user?.role === 'admin';

  const [clients, setClients] = useState<ClientData[]>(initialClients);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [assignedFilter, setAssignedFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // New Client Modal
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    status: 'potential' as ClientStatus,
    monthlyFee: '',
    startDate: '',
    services: '',
    notes: '',
    assignedUserIds: [] as string[],
    monthlyReels: '',
    monthlyPosts: '',
    monthlyStories: '',
    monthlyOther: '',
    monthlyOtherLabel: '',
  });

  // Filter clients
  const filteredClients = clients.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (assignedFilter !== 'all') {
      const isAssigned = c.assignments?.some((a) => a.userId === assignedFilter);
      if (!isAssigned) return false;
    }
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchName = c.name.toLowerCase().includes(q);
      const matchLocation = (c.location || '').toLowerCase().includes(q);
      const matchServices = c.services.some((s) => s.toLowerCase().includes(q));
      if (!matchName && !matchLocation && !matchServices) return false;
    }
    return true;
  });

  // CSV Export
  const handleExportCSV = () => {
    const headers = isAdmin
      ? ['Client Name', 'Status', 'Location', 'Monthly Fee (TND)', 'Services', 'Assigned Team']
      : ['Client Name', 'Status', 'Location', 'Services', 'Assigned Team'];
    const rows = filteredClients.map((c) => {
      const base = [
        `"${c.name.replace(/"/g, '""')}"`,
        c.status,
        `"${(c.location || '').replace(/"/g, '""')}"`,
      ];
      if (isAdmin) base.push(String(c.contract?.monthlyFee || 0));
      base.push(`"${c.services.join('; ').replace(/"/g, '""')}"`);
      base.push(`"${(c.assignments || []).map((a) => a.user.name).join(', ').replace(/"/g, '""')}"`);
      return base;
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `clients_roster_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Quick stage change directly from table
  const handleStageChange = async (clientId: string, newStatus: ClientStatus) => {
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, status: newStatus } : c))
    );

    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        console.error('Failed to update client stage');
      } else {
        const updated = await res.json();
        setClients((prev) =>
          prev.map((c) => (c.id === clientId ? { ...c, ...updated } : c))
        );
      }
    } catch (err) {
      console.error('Error changing client stage:', err);
    }
  };

  // Create Client
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          location: formData.location.trim() || null,
          status: formData.status,
          startDate: formData.startDate || null,
          monthlyFee: isAdmin && formData.monthlyFee ? parseFloat(formData.monthlyFee) : null,
          services: formData.services.split(',').map((s) => s.trim()).filter(Boolean),
          notes: formData.notes.trim() || null,
          assignedUserIds: formData.assignedUserIds,
          monthlyGoals: {
            selectedFormats: [
              parseInt(formData.monthlyReels, 10) > 0 ? 'reels' : null,
              parseInt(formData.monthlyPosts, 10) > 0 ? 'posts' : null,
              parseInt(formData.monthlyStories, 10) > 0 ? 'stories' : null,
              parseInt(formData.monthlyOther, 10) > 0 ? 'other' : null,
            ].filter(Boolean) as string[],
            reels: Math.max(0, parseInt(formData.monthlyReels, 10) || 0),
            posts: Math.max(0, parseInt(formData.monthlyPosts, 10) || 0),
            stories: Math.max(0, parseInt(formData.monthlyStories, 10) || 0),
            other: Math.max(0, parseInt(formData.monthlyOther, 10) || 0),
            otherLabel: formData.monthlyOtherLabel.trim() || 'Other Content',
          },
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setClients((prev) => [created, ...prev]);
        setShowModal(false);
        setFormData({
          name: '',
          location: '',
          status: 'potential',
          monthlyFee: '',
          startDate: '',
          services: '',
          notes: '',
          assignedUserIds: [],
          monthlyReels: '',
          monthlyPosts: '',
          monthlyStories: '',
          monthlyOther: '',
          monthlyOtherLabel: '',
        });
        router.refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to create client account');
      }
    } catch (err) {
      console.error('Failed to create client:', err);
      alert('Network error while creating client');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleUserAssignment = (userId: string) => {
    setFormData((prev) => {
      const exists = prev.assignedUserIds.includes(userId);
      return {
        ...prev,
        assignedUserIds: exists
          ? prev.assignedUserIds.filter((id) => id !== userId)
          : [...prev.assignedUserIds, userId],
      };
    });
  };

  return (
    <div>
      {/* Controls: Search, Filters & Actions */}
      <div
        className="glass-card"
        style={{
          padding: '14px 18px',
          marginBottom: '18px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', flex: 1, minWidth: 'min(100%, 260px)' }}>
          {/* Search bar */}
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '180px' }}>
            <Search
              size={14}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              placeholder="Filter by account or service..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '32px' }}
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field"
            style={{ flex: '1 1 130px', minWidth: '120px' }}
          >
            <option value="all">All Stages</option>
            <option value="active">Active</option>
            <option value="starting">Starting</option>
            <option value="potential">Potential</option>
            <option value="paused">Paused</option>
            <option value="churned">Churned</option>
          </select>

          {/* Assigned filter (for admin) */}
          {isAdmin && (
            <select
              value={assignedFilter}
              onChange={(e) => setAssignedFilter(e.target.value)}
              className="input-field"
              style={{ flex: '1 1 140px', minWidth: '130px' }}
            >
              <option value="all">All Team Leads</option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Right side buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={handleExportCSV} className="btn btn-secondary btn-sm">
            <Download size={13} />
            Export CSV
          </button>
          <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm">
            <Plus size={13} />
            New Client
          </button>
        </div>
      </div>

      {/* Roster Table */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div className="table-responsive-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '28px', paddingLeft: '14px' }}>
                  <input type="checkbox" style={{ accentColor: '#111827' }} />
                </th>
                <th style={{ minWidth: '140px' }}>Brand / Account</th>
                <th>Stage</th>
                {isAdmin && <th style={{ minWidth: '100px' }}>Monthly Fee</th>}
                <th style={{ minWidth: '80px' }}>Together</th>
                <th>Contracted Services</th>
                <th>Lead & Team</th>
                <th>Content Pacing</th>
                <th style={{ textAlign: 'right', paddingRight: '18px' }}>Manage</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                    No client accounts match the current filter.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const numDeliverables = client._count?.deliverables ?? client.deliverables?.length ?? 0;
                  const numMessages = client._count?.messages ?? client.messages?.length ?? 0;

                  return (
                    <tr
                      key={client.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => router.push(`/clients/${client.id}`)}
                    >
                      <td style={{ paddingLeft: '14px' }} onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" style={{ accentColor: '#111827' }} />
                      </td>

                      {/* Name & Location */}
                      <td>
                        <div style={{ fontWeight: 600, color: '#111827', fontSize: '13.5px' }}>
                          {client.name}
                        </div>
                        {client.location && (
                          <div
                            style={{
                              fontSize: '11px',
                              color: '#6b7280',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              marginTop: '1px',
                            }}
                          >
                            <MapPin size={10} color="#9ca3af" />
                            <span>{client.location}</span>
                          </div>
                        )}
                        {(() => {
                          const socials = client.socialAccounts || [];
                          const cur = socials.reduce((acc, s) => acc + (s.followers || 0), 0);
                          const base = socials.reduce((acc, s) => acc + (s.initialFollowers || 0), 0);
                          if (cur > 0) {
                            const diff = cur - base;
                            return (
                              <div
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  marginTop: 3,
                                  fontSize: 11,
                                  color: '#4b5563',
                                }}
                              >
                                <span style={{ fontWeight: 600 }}>{formatNumber(cur)} followers</span>
                                {base > 0 && diff !== 0 && (
                                  <span
                                    style={{
                                      color: diff > 0 ? '#059669' : '#dc2626',
                                      fontWeight: 700,
                                      fontSize: 10.5,
                                    }}
                                    title={`Started with ${formatNumber(base)} on ${client.startDate || 'start date'}`}
                                  >
                                    ({diff > 0 ? `+${formatNumber(diff)}` : formatNumber(diff)})
                                  </span>
                                )}
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </td>

                      {/* Status / Stage */}
                      <td onClick={(e) => e.stopPropagation()}>
                        <select
                          value={client.status}
                          onChange={(e) => handleStageChange(client.id, e.target.value as ClientStatus)}
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: '5px',
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
                      </td>

                      {isAdmin && (
                        <td>
                          <div style={{ fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                            {client.contract?.monthlyFee != null ? formatMoney(client.contract.monthlyFee) : '—'}
                          </div>
                        </td>
                      )}
                      <td style={{ fontSize: 12, color: '#6b7280' }}>{formatTenure(client.startDate)}</td>

                      {/* Services */}
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '280px' }}>
                          {client.services.slice(0, 3).map((service, sIdx) => (
                            <span
                              key={sIdx}
                              style={{
                                fontSize: '11px',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: '#f3f4f6',
                                color: '#4b5563',
                              }}
                            >
                              {service}
                            </span>
                          ))}
                          {client.services.length > 3 && (
                            <span style={{ fontSize: '10px', color: '#9ca3af' }}>
                              +{client.services.length - 3}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Assigned Team */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {client.assignments && client.assignments.length > 0 ? (
                            client.assignments.map((a, aIdx) => (
                              <div
                                key={aIdx}
                                className="avatar"
                                title={a.user.name}
                                style={{
                                  width: '24px',
                                  height: '24px',
                                  fontSize: '10px',
                                  borderRadius: '50%',
                                }}
                              >
                                {a.user.name.slice(0, 2).toUpperCase()}
                              </div>
                            ))
                          ) : (
                            <span style={{ fontSize: '11.5px', color: '#9ca3af' }}>Unassigned</span>
                          )}
                        </div>
                      </td>

                      {/* Content Activity & Goals */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11.5px', color: '#4b5563' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }} title="Logged deliverables">
                              <Video size={12} color="#6366f1" />
                              <strong>{numDeliverables}</strong>
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }} title="Chat messages">
                              <MessageSquare size={12} color="#10b981" />
                              <strong>{numMessages}</strong>
                            </span>
                          </div>

                          {(() => {
                            const g = client.monthlyGoals;
                            if (!g) return null;
                            const items: string[] = [];
                            if ((!g.selectedFormats || g.selectedFormats.includes('reels')) && (g.reels ?? 0) > 0) {
                              items.push(`${g.reels}R`);
                            }
                            if ((!g.selectedFormats || g.selectedFormats.includes('posts')) && (g.posts ?? 0) > 0) {
                              items.push(`${g.posts}P`);
                            }
                            if ((!g.selectedFormats || g.selectedFormats.includes('stories')) && (g.stories ?? 0) > 0) {
                              items.push(`${g.stories}S`);
                            }
                            if ((!g.selectedFormats || g.selectedFormats.includes('other')) && (g.other ?? 0) > 0) {
                              items.push(`${g.other} ${g.otherLabel ? g.otherLabel.slice(0, 8) : 'Other'}`);
                            }
                            if (items.length === 0) return null;

                            return (
                              <div
                                style={{
                                  fontSize: '10px',
                                  color: '#4338ca',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  backgroundColor: '#f5f3ff',
                                  border: '1px solid #e0e7ff',
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                  width: 'fit-content',
                                }}
                                title="Guaranteed monthly content targets"
                              >
                                <Sparkles size={10} color="#7c3aed" />
                                <span>{items.join(' · ')}</span>
                              </div>
                            );
                          })()}
                        </div>
                      </td>

                      {/* Detail Link */}
                      <td style={{ textAlign: 'right', paddingRight: '18px' }}>
                        <Link
                          href={`/clients/${client.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="btn btn-ghost btn-sm"
                          style={{ color: '#4b5563', padding: '3px 6px' }}
                        >
                          <ArrowRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Client Modal */}
      {showModal && (
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
                Onboard New Client Account
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="btn btn-ghost btn-sm"
                style={{ padding: '4px' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateClient} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="grid-responsive-2" style={{ gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                    Client Brand Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Acme Studio"
                    className="input-field"
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                    Client Stage *
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as ClientStatus })}
                    className="input-field"
                    style={{
                      fontWeight: 600,
                      backgroundColor:
                        formData.status === 'active'
                          ? '#ecfdf5'
                          : formData.status === 'starting'
                          ? '#e0f2fe'
                          : formData.status === 'potential'
                          ? '#f3e8ff'
                          : formData.status === 'paused'
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
                    HQ Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g. London, UK"
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
                    value={formData.monthlyFee}
                    onChange={(e) => setFormData({ ...formData, monthlyFee: e.target.value })}
                    placeholder="e.g. 4500"
                    className="input-field"
                  />
                </div>
                )}
              </div>

              <div className="grid-responsive-2" style={{ gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                    Client Start Date / Date de Début
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="input-field"
                  />
                  {formData.startDate && (
                    <div style={{ marginTop: 4, fontSize: 11, color: '#4338ca', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={11} />
                      <span>Ensemble depuis :</span>
                      <span className="badge badge-active" style={{ fontSize: 10.5, padding: '1px 6px' }}>
                        {formatTenure(formData.startDate)}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                    Services (comma separated)
                  </label>
                  <input
                    type="text"
                    value={formData.services}
                    onChange={(e) => setFormData({ ...formData, services: e.target.value })}
                    placeholder="e.g. TikTok UGC, Instagram Reels, Creator Seeding"
                    className="input-field"
                  />
                </div>
              </div>

              {/* Monthly Content Deliverables Section */}
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={13} color="#6366f1" />
                    Monthly Content Deliverables (Optional)
                  </div>
                  <span style={{ fontSize: '10px', color: '#64748b' }}>Leave 0 or blank to hide from tracker</span>
                </div>
                <div className="grid-responsive-3" style={{ gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '10.5px', color: '#64748b', display: 'block', marginBottom: 2 }}>🎬 Reels / month</label>
                    <input
                      type="number"
                      min="0"
                      className="input-field"
                      placeholder="e.g. 12"
                      value={formData.monthlyReels}
                      onChange={(e) => setFormData({ ...formData, monthlyReels: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10.5px', color: '#64748b', display: 'block', marginBottom: 2 }}>📸 Posts / month</label>
                    <input
                      type="number"
                      min="0"
                      className="input-field"
                      placeholder="e.g. 4"
                      value={formData.monthlyPosts}
                      onChange={(e) => setFormData({ ...formData, monthlyPosts: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10.5px', color: '#64748b', display: 'block', marginBottom: 2 }}>📱 Stories / month</label>
                    <input
                      type="number"
                      min="0"
                      className="input-field"
                      placeholder="e.g. 20"
                      value={formData.monthlyStories}
                      onChange={(e) => setFormData({ ...formData, monthlyStories: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '10.5px', color: '#64748b', display: 'block', marginBottom: 2 }}>⚡ Custom Format Name (Optional)</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. TikToks, UGC Videos, Graphics"
                      value={formData.monthlyOtherLabel}
                      onChange={(e) => setFormData({ ...formData, monthlyOtherLabel: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10.5px', color: '#64748b', display: 'block', marginBottom: 2 }}>Custom Target / month</label>
                    <input
                      type="number"
                      min="0"
                      className="input-field"
                      placeholder="e.g. 8"
                      value={formData.monthlyOther}
                      onChange={(e) => setFormData({ ...formData, monthlyOther: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Assign team members */}
              <div>
                <label style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                  Assign Team Members
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {availableUsers.map((u) => {
                    const isSelected = formData.assignedUserIds.includes(u.id);
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
                  Account Brief
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Goals, target audience, brand aesthetic..."
                  className="input-field"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                >
                  {submitting ? 'Saving...' : 'Add Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

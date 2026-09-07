'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClientData, ClientStatus, UserSummary } from '@/types';
import { StatusBadge } from './StatusBadge';
import { formatMoney, formatTenure } from '@/lib/format';
import {
  MapPin,
  Edit,
  Trash2,
  Users,
  X,
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

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
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
            <StatusBadge status={client.status} />
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
            <span>{formatTenure(client.startDate)}</span>

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
                    Stage
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ClientStatus)}
                    className="input-field"
                  >
                    <option value="potential">Potential</option>
                    <option value="starting">Starting</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="churned">Churned</option>
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
                  <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>Start date</label>
                  <input type="date" className="input-field" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
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

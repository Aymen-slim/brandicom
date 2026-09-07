'use client';

import React, { useState, useMemo } from 'react';
import { CreatorData, CreatorRole } from '@/types';
import { CreatorCard } from './CreatorCard';
import { Search, Plus, X } from 'lucide-react';

interface CreatorGridProps {
  initialCreators: CreatorData[];
  isAdmin?: boolean;
}

export function CreatorGrid({ initialCreators, isAdmin = false }: CreatorGridProps) {
  const [creators, setCreators] = useState<CreatorData[]>(initialCreators);
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [onlyAvailable, setOnlyAvailable] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingCreator, setEditingCreator] = useState<CreatorData | null>(null);

  // Form fields
  const [formData, setFormData] = useState({
    name: '',
    role: 'videographer' as CreatorRole,
    styleTags: '',
    instagramHandle: '',
    followers: '',
    dayRate: '',
    rateUnit: 'day',
    available: true,
    phone: '',
    email: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const roles: Array<{ key: string; label: string }> = [
    { key: 'all', label: 'All Roles' },
    { key: 'videographer', label: 'Videographers' },
    { key: 'photographer', label: 'Photographers' },
    { key: 'ugc', label: 'UGC Creators' },
    { key: 'presenter', label: 'Presenters' },
    { key: 'influencer', label: 'Influencers' },
    { key: 'agency', label: 'Agencies' },
    { key: 'editor', label: 'Editors' },
    { key: 'designer', label: 'Designers' },
    { key: 'model', label: 'Models' },
  ];

  // Filtering
  const filteredCreators = useMemo(() => {
    return creators.filter((c) => {
      if (selectedRole !== 'all' && c.role !== selectedRole) return false;
      if (onlyAvailable && !c.available) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchName = c.name.toLowerCase().includes(q);
        const matchHandle = (c.instagramHandle || '').toLowerCase().includes(q);
        const matchTag = c.styleTags.some((tag) => tag.toLowerCase().includes(q));
        if (!matchName && !matchHandle && !matchTag) return false;
      }
      return true;
    });
  }, [creators, selectedRole, onlyAvailable, searchQuery]);

  const openCreateModal = () => {
    setEditingCreator(null);
    setFormData({
      name: '',
      role: 'videographer',
      styleTags: '',
      instagramHandle: '',
      followers: '',
      dayRate: '',
      rateUnit: 'day',
      available: true,
      phone: '',
      email: '',
      notes: '',
    });
    setShowAddModal(true);
  };

  const openEditModal = (creator: CreatorData) => {
    setEditingCreator(creator);
    setFormData({
      name: creator.name,
      role: creator.role,
      styleTags: creator.styleTags.join(', '),
      instagramHandle: creator.instagramHandle || '',
      followers: creator.followers ? creator.followers.toString() : '',
      dayRate: creator.dayRate ? creator.dayRate.toString() : '',
      rateUnit: creator.rateUnit || 'day',
      available: creator.available,
      phone: creator.phone || '',
      email: creator.email || '',
      notes: creator.notes || '',
    });
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        role: formData.role,
        styleTags: formData.styleTags.split(',').map((s) => s.trim()).filter(Boolean),
        instagramHandle: formData.instagramHandle.trim() || null,
        followers: formData.followers ? parseInt(formData.followers, 10) : null,
        dayRate: formData.dayRate ? parseFloat(formData.dayRate) : null,
        rateUnit: formData.rateUnit || 'day',
        available: formData.available,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        notes: formData.notes.trim() || null,
      };

      if (editingCreator) {
        const res = await fetch(`/api/creators/${editingCreator.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const updated = await res.json();
          setCreators((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
          setShowAddModal(false);
        } else {
          const errData = await res.json().catch(() => ({}));
          alert(errData.error || 'Failed to update partner');
        }
      } else {
        const res = await fetch('/api/creators', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const created = await res.json();
          setCreators((prev) => [created, ...prev]);
          setShowAddModal(false);
        } else {
          const errData = await res.json().catch(() => ({}));
          alert(errData.error || 'Failed to add partner. Only admins can add partners.');
        }
      }
    } catch (err) {
      console.error('Error saving creator:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Control Bar: Search & Role Filter Tabs */}
      <div
        className="glass-card"
        style={{
          padding: '12px 18px',
          marginBottom: '18px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '180px' }}>
          <Search
            size={14}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Search by name, handle, or style..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field"
            style={{ paddingLeft: '32px' }}
          />
        </div>

        {/* Role Tabs */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {roles.map((r) => {
            const isActive = selectedRole === r.key;
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => setSelectedRole(r.key)}
                className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        {/* Right side: Available toggle + Add button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: '#4b5563',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={(e) => setOnlyAvailable(e.target.checked)}
              style={{ accentColor: '#111827' }}
            />
            Available Only
          </label>

          {isAdmin && (
            <button onClick={openCreateModal} className="btn btn-primary btn-sm">
              <Plus size={13} />
              Add Partner
            </button>
          )}
        </div>
      </div>

      {/* Grid of Creators */}
      {filteredCreators.length === 0 ? (
        <div
          className="glass-card"
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: 'var(--text-muted)',
          }}
        >
          No creators found matching your selected filters.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
            gap: '16px',
          }}
        >
          {filteredCreators.map((creator) => (
            <CreatorCard
              key={creator.id}
              creator={creator}
              onEdit={isAdmin ? openEditModal : undefined}
            />
          ))}
        </div>
      )}

      {/* Add / Edit Creator Modal */}
      {showAddModal && (
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
                {editingCreator ? 'Edit Creator Profile' : 'Add Talent to Directory'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="btn btn-ghost btn-sm"
                style={{ padding: '4px' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Kai Thorne"
                    className="input-field"
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                    Primary Role *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as CreatorRole })}
                    className="input-field"
                  >
                    <option value="videographer">Videographer</option>
                    <option value="photographer">Photographer</option>
                    <option value="ugc">UGC Creator</option>
                    <option value="presenter">Presenter / Host</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Style Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={formData.styleTags}
                  onChange={(e) => setFormData({ ...formData, styleTags: e.target.value })}
                  placeholder="e.g. Cinematic 4K, Macro Focus, Editorial Fashion"
                  className="input-field"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                    Instagram Handle
                  </label>
                  <input
                    type="text"
                    value={formData.instagramHandle}
                    onChange={(e) => setFormData({ ...formData, instagramHandle: e.target.value })}
                    placeholder="@username"
                    className="input-field"
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                    Followers Count
                  </label>
                  <input
                    type="number"
                    value={formData.followers}
                    onChange={(e) => setFormData({ ...formData, followers: e.target.value })}
                    placeholder="e.g. 145000"
                    className="input-field"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                    Day Rate ($ USD)
                  </label>
                  <input
                    type="number"
                    value={formData.dayRate}
                    onChange={(e) => setFormData({ ...formData, dayRate: e.target.value })}
                    placeholder="e.g. 1200"
                    className="input-field"
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                    Rate Unit
                  </label>
                  <select
                    value={formData.rateUnit}
                    onChange={(e) => setFormData({ ...formData, rateUnit: e.target.value })}
                    className="input-field"
                  >
                    <option value="day">per day</option>
                    <option value="half-day">per half-day</option>
                    <option value="deliverable">per video/asset</option>
                    <option value="hour">per hour</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="talent@domain.com"
                    className="input-field"
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                    Phone
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Booking Notes & Camera Rig Details
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Red V-Raptor package, specialty gimbal rigger..."
                  className="input-field"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="available-check"
                  checked={formData.available}
                  onChange={(e) => setFormData({ ...formData, available: e.target.checked })}
                  style={{ accentColor: '#111827' }}
                />
                <label htmlFor="available-check" style={{ fontSize: '12.5px', color: '#111827', cursor: 'pointer' }}>
                  Currently Available for Bookings
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                >
                  {submitting ? 'Saving...' : editingCreator ? 'Update Creator' : 'Add Creator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

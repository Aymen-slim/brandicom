'use client';

import React, { useState } from 'react';
import { UserSummary } from '@/types';
import {
  Users,
  Target,
  Shield,
  UserCheck,
  Plus,
  Save,
  CheckCircle,
  Pencil,
  Trash2,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertTriangle,
  X,
  KeyRound,
} from 'lucide-react';

interface SettingsManagerProps {
  initialUsers: Array<UserSummary & { _count?: { assignments: number; deliverables: number } }>;
  initialGoals: Array<{
    periodType: string;
    periodValue: string;
    metric: string;
    target: number;
  }>;
  user?: UserSummary | null;
}

export function SettingsManager({ initialUsers, initialGoals, user }: SettingsManagerProps) {
  const isAdmin = user?.role === 'admin';

  const [activeTab, setActiveTab] = useState<'team' | 'goals'>('team');
  const [users, setUsers] = useState(initialUsers || []);

  // New user form state
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('agency2026');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'member'>('member');
  const [creatingUser, setCreatingUser] = useState(false);
  const [userMsg, setUserMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit user modal state
  const [editingUser, setEditingUser] = useState<(UserSummary & { _count?: { assignments: number; deliverables: number } }) | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'member'>('member');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete user modal state
  const [deletingUser, setDeletingUser] = useState<(UserSummary & { _count?: { assignments: number; deliverables: number } }) | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Goals targets state
  const [selectedPeriod, setSelectedPeriod] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );

  const getTarget = (metric: string, period: string) => {
    const found = (initialGoals || []).find((g) => g.metric === metric && g.periodValue === period);
    return found ? found.target : 0;
  };

  const [targets, setTargets] = useState<Record<string, number>>({});
  const targetVal = (metric: string) =>
    targets[`${selectedPeriod}_${metric}`] ?? getTarget(metric, selectedPeriod);

  const [savingGoals, setSavingGoals] = useState(false);
  const [goalSavedMsg, setGoalSavedMsg] = useState<string | null>(null);

  // Add user submit
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail) return;

    setCreatingUser(true);
    setUserMsg(null);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newUserName.trim(),
          email: newUserEmail.trim(),
          password: newUserPassword,
          role: newUserRole,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setUsers((prev) => [...prev, created]);
        setUserMsg({ type: 'success', text: `User ${created.name} added successfully.` });
        setNewUserName('');
        setNewUserEmail('');
        setShowAddUser(false);
      } else {
        const err = await res.json();
        setUserMsg({ type: 'error', text: err.error || 'Failed to create user.' });
      }
    } catch {
      setUserMsg({ type: 'error', text: 'Network error occurred.' });
    } finally {
      setCreatingUser(false);
    }
  };

  // Open Edit User modal
  const openEditUser = (u: UserSummary & { _count?: { assignments: number; deliverables: number } }) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditPassword('');
    setEditRole(u.role);
    setShowEditPassword(false);
    setEditError(null);
  };

  // Save edited user (Email, Password, Name, Role)
  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editName.trim()) {
      setEditError('Name is required');
      return;
    }
    if (!editEmail.trim()) {
      setEditError('Email is required');
      return;
    }
    if (editPassword && editPassword.length < 8) {
      setEditError('Password must be at least 8 characters long');
      return;
    }

    setSavingEdit(true);
    setEditError(null);

    try {
      const payload: any = {
        name: editName.trim(),
        email: editEmail.trim(),
        role: editRole,
      };
      if (editPassword) {
        payload.password = editPassword;
      }

      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const updated = await res.json();
        setUsers((prev) =>
          prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u))
        );
        setUserMsg({
          type: 'success',
          text: `Account for ${updated.name} updated successfully${editPassword ? ' (including new password)' : ''}.`,
        });
        setEditingUser(null);
      } else {
        const err = await res.json();
        setEditError(err.error || 'Failed to update member.');
      }
    } catch {
      setEditError('Network error occurred.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Confirm delete user
  const handleConfirmDeleteUser = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/users/${deletingUser.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== deletingUser.id));
        setUserMsg({
          type: 'success',
          text: `Member ${deletingUser.name} (${deletingUser.email}) has been permanently deleted.`,
        });
        setDeletingUser(null);
      } else {
        const err = await res.json();
        setDeleteError(err.error || 'Failed to delete member.');
      }
    } catch {
      setDeleteError('Network error occurred.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Save goal targets
  const handleSaveGoals = async () => {
    setSavingGoals(true);
    setGoalSavedMsg(null);

    const periodType = selectedPeriod.length === 4 ? 'year' : 'month';
    const metricsToSave = isAdmin
      ? ['revenue', 'profit', 'deliverables', 'new_clients', 'retention', 'views']
      : ['deliverables', 'new_clients', 'retention', 'views'];

    try {
      for (const metric of metricsToSave) {
        const val = targetVal(metric);

        await fetch('/api/goals', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            periodType,
            periodValue: selectedPeriod,
            metric,
            target: val,
          }),
        });
      }
      setGoalSavedMsg('Goal targets updated successfully!');
      setTimeout(() => setGoalSavedMsg(null), 3000);
    } catch (err) {
      console.error('Error saving goals:', err);
    } finally {
      setSavingGoals(false);
    }
  };

  return (
    <div>
      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '20px',
          gap: '8px',
        }}
      >
        <button
          onClick={() => setActiveTab('team')}
          className={`tab-button ${activeTab === 'team' ? 'active' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '10px' }}
        >
          <Users size={15} />
          <span>Agency Team ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('goals')}
          className={`tab-button ${activeTab === 'goals' ? 'active' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '10px' }}
        >
          <Target size={15} />
          <span>Agency Goal Targets</span>
        </button>
      </div>

      {userMsg && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: userMsg.type === 'success' ? '#ecfdf5' : '#fff1f2',
            border: `1px solid ${userMsg.type === 'success' ? '#a7f3d0' : '#fecdd3'}`,
            color: userMsg.type === 'success' ? '#047857' : '#be123c',
            fontSize: '12.5px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{userMsg.text}</span>
          <button
            onClick={() => setUserMsg(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '2px' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* TEAM TAB */}
      {activeTab === 'team' && (
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>
                Team Members & Access Roles
              </h3>
              <p style={{ fontSize: '12px', color: '#6b7280' }}>
                Admins can change member credentials, update roles, and manage team roster.
              </p>
            </div>

            {isAdmin && (
              <button
                onClick={() => setShowAddUser(!showAddUser)}
                className="btn btn-primary btn-sm"
              >
                <Plus size={13} />
                {showAddUser ? 'Cancel' : 'Add Team Member'}
              </button>
            )}
          </div>

          {/* Add user form */}
          {showAddUser && (
            <form
              onSubmit={handleAddUser}
              className="grid-responsive-3"
              style={{
                padding: '16px 20px',
                backgroundColor: '#fafafa',
                borderBottom: '1px solid var(--border-subtle)',
                gap: '10px',
                alignItems: 'flex-end',
              }}
            >
              <div>
                <label style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginBottom: '3px', fontWeight: 600 }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Liam Parker"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginBottom: '3px', fontWeight: 600 }}>
                  Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="liam@agency.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginBottom: '3px', fontWeight: 600 }}>
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginBottom: '3px', fontWeight: 600 }}>
                  Role
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as any)}
                  className="input-field"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="btn btn-primary btn-sm"
                  style={{ height: '36px', width: '100%' }}
                >
                  {creatingUser ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          )}

          <div className="table-responsive-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 150 }}>Team Member</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Assigned Accounts</th>
                  {isAdmin && <th style={{ textAlign: 'right', minWidth: 120 }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          className="avatar"
                          style={{
                            width: '28px',
                            height: '28px',
                            fontSize: '11px',
                            backgroundColor: '#e0e7ff',
                            color: '#4338ca',
                            fontWeight: 700,
                            borderRadius: '50%',
                          }}
                        >
                          {u.name ? u.name.slice(0, 2).toUpperCase() : 'AG'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#111827' }}>{u.name}</div>
                          {u.id === user?.id && (
                            <span style={{ fontSize: '10px', color: '#4f46e5', fontWeight: 600 }}>
                              You (Current Account)
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ color: '#4b5563', fontSize: '12.5px' }}>{u.email}</td>
                    <td>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: '4px',
                          backgroundColor: u.role === 'admin' ? '#f5f3ff' : '#ecfdf5',
                          color: u.role === 'admin' ? '#7c3aed' : '#059669',
                          textTransform: 'capitalize',
                        }}
                      >
                        {u.role === 'admin' ? <Shield size={11} /> : <UserCheck size={11} />}
                        {u.role}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: '#6b7280' }}>
                      {u._count?.assignments ?? 0} active client accounts
                    </td>
                    {isAdmin && (
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => openEditUser(u)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 8px', fontSize: '11.5px', height: '28px' }}
                            title="Edit email, password, role & details"
                          >
                            <Pencil size={12} />
                            <span>Edit</span>
                          </button>
                          {u.id !== user?.id && (
                            <button
                              type="button"
                              onClick={() => {
                                setDeletingUser(u);
                                setDeleteError(null);
                              }}
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '4px 8px', fontSize: '11.5px', height: '28px', color: '#ef4444' }}
                              title="Delete member account"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PERFORMANCE GOALS */}
      {activeTab === 'goals' && (
        <div className="glass-card" style={{ padding: '24px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: '14px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>
                Agency Pacing & Target Calibration
              </h3>
              <p style={{ fontSize: '12px', color: '#6b7280' }}>
                Set official agency targets. The dashboard dynamically compares actuals against these numbers.
              </p>
            </div>

            {/* Period switcher */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                type="month"
                className="input-field"
                value={selectedPeriod.length === 7 ? selectedPeriod : new Date().toISOString().slice(0, 7)}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                style={{ width: 160 }}
              />
              <button
                type="button"
                onClick={() => setSelectedPeriod(String(new Date().getFullYear()))}
                className={`btn btn-sm ${selectedPeriod.length === 4 ? 'btn-primary' : 'btn-secondary'}`}
              >
                This year
              </button>
            </div>
          </div>

          {goalSavedMsg && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#ecfdf5',
                color: '#047857',
                border: '1px solid #a7f3d0',
                fontSize: '12.5px',
                marginBottom: '16px',
              }}
            >
              <CheckCircle size={14} />
              {goalSavedMsg}
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              marginBottom: '24px',
            }}
          >
            {isAdmin && (
            <div
              style={{
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#fafafa',
                border: '1px solid #eaedf0',
              }}
            >
              <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '4px' }}>
                Revenue received target (TND)
              </label>
              <input
                type="number"
                disabled={!isAdmin}
                value={targetVal('revenue')}
                onChange={(e) =>
                  setTargets({
                    ...targets,
                    [`${selectedPeriod}_revenue`]: parseFloat(e.target.value) || 0,
                  })
                }
                className="input-field"
                style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}
              />
            </div>
            )}

            {/* Deliverables Target */}
            <div
              style={{
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#fafafa',
                border: '1px solid #eaedf0',
              }}
            >
              <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '4px' }}>
                Published Content Deliverables Target
              </label>
              <input
                type="number"
                disabled={!isAdmin}
                value={targetVal('deliverables')}
                onChange={(e) =>
                  setTargets({
                    ...targets,
                    [`${selectedPeriod}_deliverables`]: parseInt(e.target.value, 10) || 0,
                  })
                }
                className="input-field"
                style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}
              />
            </div>

            {/* New Clients Target */}
            <div
              style={{
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#fafafa',
                border: '1px solid #eaedf0',
              }}
            >
              <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '4px' }}>
                New Clients Onboarded Target
              </label>
              <input
                type="number"
                disabled={!isAdmin}
                value={targetVal('new_clients')}
                onChange={(e) =>
                  setTargets({
                    ...targets,
                    [`${selectedPeriod}_new_clients`]: parseInt(e.target.value, 10) || 0,
                  })
                }
                className="input-field"
                style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}
              />
            </div>

            {/* Retention Target */}
            <div
              style={{
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#fafafa',
                border: '1px solid #eaedf0',
              }}
            >
              <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#4b5563', display: 'block', marginBottom: '4px' }}>
                Client Retention Rate Target (%)
              </label>
              <input
                type="number"
                disabled={!isAdmin}
                value={targetVal('retention')}
                onChange={(e) =>
                  setTargets({
                    ...targets,
                    [`${selectedPeriod}_retention`]: parseInt(e.target.value, 10) || 0,
                  })
                }
                className="input-field"
                style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}
              />
            </div>
          </div>

          {isAdmin ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleSaveGoals}
                disabled={savingGoals}
                className="btn btn-primary btn-sm"
              >
                <Save size={13} />
                {savingGoals ? 'Saving Targets...' : 'Save Targets'}
              </button>
            </div>
          ) : (
            <p style={{ fontSize: '11.5px', color: '#9ca3af', textAlign: 'right' }}>
              Only agency administrators can modify target goals.
            </p>
          )}
        </div>
      )}

      {/* EDIT MEMBER MODAL */}
      {editingUser && (
        <div className="modal-overlay" style={{ zIndex: 100 }}>
          <div
            className="modal-container glass-card"
            style={{
              maxWidth: '460px',
              width: '100%',
              backgroundColor: '#ffffff',
              padding: '24px',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.16)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
                borderBottom: '1px solid #eaedf0',
                paddingBottom: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: '#eff6ff',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Pencil size={15} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: 0 }}>
                    Edit Member Account
                  </h3>
                  <span style={{ fontSize: '11.5px', color: '#6b7280' }}>
                    {editingUser.name}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingUser(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {editError && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#fff1f2',
                  border: '1px solid #fecdd3',
                  color: '#be123c',
                  fontSize: '12px',
                  marginBottom: '14px',
                }}
              >
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEditUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="input-field"
                  placeholder="e.g. Alex Vance"
                />
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>
                  Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail
                    size={14}
                    color="#9ca3af"
                    style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
                  />
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="input-field"
                    style={{ paddingLeft: '32px' }}
                    placeholder="user@agency.com"
                  />
                </div>
                <span style={{ fontSize: '10.5px', color: '#9ca3af', marginTop: '3px', display: 'block' }}>
                  Updating email will change their login username.
                </span>
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>
                  New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock
                    size={14}
                    color="#9ca3af"
                    style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
                  />
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="input-field"
                    style={{ paddingLeft: '32px', paddingRight: '36px' }}
                    placeholder="Leave blank to keep unchanged"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#9ca3af',
                      padding: '4px',
                      display: 'inline-flex',
                    }}
                  >
                    {showEditPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <span style={{ fontSize: '10.5px', color: '#9ca3af', marginTop: '3px', display: 'block' }}>
                  Enter at least 8 characters to reset their login password.
                </span>
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>
                  Access Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as 'admin' | 'member')}
                  className="input-field"
                >
                  <option value="member">Member (Assigned clients only)</option>
                  <option value="admin">Admin (Full agency access & settings)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="btn btn-primary btn-sm"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MEMBER CONFIRMATION MODAL */}
      {deletingUser && (
        <div className="modal-overlay" style={{ zIndex: 100 }}>
          <div
            className="modal-container glass-card"
            style={{
              maxWidth: '420px',
              width: '100%',
              backgroundColor: '#ffffff',
              padding: '24px',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.16)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: '#fef2f2',
                  color: '#ef4444',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '12px',
                }}
              >
                <AlertTriangle size={22} />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: 0 }}>
                Delete Member Account?
              </h3>
              <p style={{ fontSize: '12.5px', color: '#6b7280', marginTop: '6px', lineHeight: 1.4 }}>
                Are you sure you want to delete <strong>{deletingUser.name}</strong> (<code>{deletingUser.email}</code>)?
                Their user account will be permanently removed and access to Brandicom CRM revoked.
              </p>
            </div>

            {deleteError && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#fff1f2',
                  border: '1px solid #fecdd3',
                  color: '#be123c',
                  fontSize: '12px',
                  marginBottom: '14px',
                }}
              >
                {deleteError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="btn btn-secondary"
                style={{ height: '36px', fontSize: '13px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                disabled={isDeleting}
                className="btn btn-primary"
                style={{
                  height: '36px',
                  fontSize: '13px',
                  backgroundColor: '#dc2626',
                  borderColor: '#dc2626',
                }}
              >
                {isDeleting ? 'Deleting...' : 'Delete Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

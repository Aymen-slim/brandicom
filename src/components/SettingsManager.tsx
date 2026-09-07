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
          }}
        >
          {userMsg.text}
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
            }}
          >
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>
                Team Members & Access Roles
              </h3>
              <p style={{ fontSize: '12px', color: '#6b7280' }}>
                Admins manage all client accounts; members access only assigned client accounts.
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
                  <th style={{ minWidth: 140 }}>Team Member</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Assigned Accounts</th>
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
                            width: '26px',
                            height: '26px',
                            fontSize: '11px',
                            backgroundColor: '#f3f4f6',
                            color: '#374151',
                            fontWeight: 700,
                          }}
                        >
                          {u.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600 }}>{u.name}</span>
                      </div>
                    </td>
                    <td style={{ color: '#6b7280', fontSize: '12px' }}>{u.email}</td>
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
    </div>
  );
}

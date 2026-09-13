'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ClientData, ClientStatus, DeliverableData, UserSummary } from '@/types';
import { StatusBadge } from './StatusBadge';
import { formatMoney, formatTenure, formatNumber, formatPercent, cleanSocialHandle, parseFollowerInput, getProxiedImageUrl } from '@/lib/format';
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
  Camera,
  Upload,
  AlertTriangle,
  Image as ImageIcon,
  Check,
  Clock,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

interface ClientDetailHeaderProps {
  client: ClientData;
  availableUsers: UserSummary[];
  user?: UserSummary | null;
  onClientUpdated?: (updated: ClientData) => void;
  deliverables?: DeliverableData[];
  onDeliverablesUpdated?: (updated: DeliverableData[]) => void;
}

export function ClientDetailHeader({
  client: initialClient,
  availableUsers,
  user,
  onClientUpdated,
  deliverables = [],
  onDeliverablesUpdated,
}: ClientDetailHeaderProps) {
  const router = useRouter();
  const isAdmin = user?.role === 'admin';

  const [client, setClient] = useState<ClientData>(initialClient);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Profile picture / logo state
  const [logoUrl, setLogoUrl] = useState(client.logoUrl || '');
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [avatarInputUrl, setAvatarInputUrl] = useState(client.logoUrl || '');
  const [fetchingAvatarPlatform, setFetchingAvatarPlatform] = useState<'instagram' | 'tiktok' | null>(null);
  const [logoLoadError, setLogoLoadError] = useState(false);

  useEffect(() => {
    setLogoLoadError(false);
  }, [client.logoUrl]);

  // Monthly sync state & countdown timer
  const [syncingMonth, setSyncingMonth] = useState(false);
  const [syncMonthPeriod, setSyncMonthPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [syncSummaryModal, setSyncSummaryModal] = useState<any | null>(null);
  const [syncElapsedTime, setSyncElapsedTime] = useState(0);
  const [syncCountdown, setSyncCountdown] = useState(16);
  const [syncStage, setSyncStage] = useState(1);
  const [syncIsSuccessTransition, setSyncIsSuccessTransition] = useState(false);
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    };
  }, []);

  // Avatar file upload handler (resizes in canvas to WebP/JPEG data URL, ~30KB)
  const handleAvatarFileUpload = (file: File) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      alert('Image file size must be less than 8MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 320;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          }
        } else {
          if (h > maxDim) {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        setLogoUrl(dataUrl);
        setAvatarInputUrl(dataUrl);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Fetch social avatar
  const handleFetchSocialAvatar = async (platform: 'instagram' | 'tiktok') => {
    const account = (client.socialAccounts || []).find((s) => s.platform === platform);
    const raw = account?.handle || account?.url;
    const clean = cleanSocialHandle(raw);
    if (!clean) {
      alert(`No ${platform === 'instagram' ? 'Instagram' : 'TikTok'} handle configured for this client.`);
      return;
    }
    setFetchingAvatarPlatform(platform);
    try {
      const res = await fetch('/api/social/fetch-followers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urlOrHandle: clean, platform }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch social profile');
      if (data.profilePicUrl) {
        setAvatarInputUrl(data.profilePicUrl);
        setLogoUrl(data.profilePicUrl);
      } else {
        alert('No profile picture found on this social profile.');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setFetchingAvatarPlatform(null);
    }
  };

  // Save avatar directly (Admin quick action)
  const handleSaveAvatarDirectly = async (newUrl: string | null) => {
    setSavingAvatar(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoUrl: newUrl || null }),
      });
      if (res.ok) {
        const updated = await res.json();
        setClient((prev) => ({ ...prev, logoUrl: newUrl || null }));
        setLogoUrl(newUrl || '');
        setShowAvatarModal(false);
        if (onClientUpdated) onClientUpdated(updated);
        router.refresh();
      } else {
        alert('Failed to update client profile picture');
      }
    } catch (err: any) {
      alert(`Error updating profile picture: ${err.message}`);
    } finally {
      setSavingAvatar(false);
    }
  };

  // Sync Month Data & Followers (Button to update all data for that client in that month)
  const handleSyncMonthData = async (monthOverride?: string) => {
    const targetMonth = monthOverride || syncMonthPeriod;
    setSyncingMonth(true);
    setSyncElapsedTime(0);
    setSyncCountdown(16);
    setSyncStage(1);
    setSyncIsSuccessTransition(false);

    if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    const startTime = Date.now();
    syncTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setSyncElapsedTime(elapsed);
      setSyncCountdown(Math.max(1, 16 - elapsed));

      if (elapsed < 3) {
        setSyncStage(1);
      } else if (elapsed < 7) {
        setSyncStage(2);
      } else if (elapsed < 12) {
        setSyncStage(3);
      } else {
        setSyncStage(4);
      }
    }, 1000);

    try {
      const res = await fetch(`/api/clients/${client.id}/sync-month`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: targetMonth }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to sync monthly data');

      // Success! Move to stage 5 and trigger celebratory transition
      setSyncStage(5);
      setSyncIsSuccessTransition(true);
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);

      if (data.client) {
        setClient((prev) => ({ ...prev, ...data.client }));
        if (data.client.logoUrl) setLogoUrl(data.client.logoUrl);
        if (onClientUpdated) onClientUpdated(data.client);
      }
      if (data.deliverables && onDeliverablesUpdated) {
        onDeliverablesUpdated(data.deliverables);
      }

      // Smooth brief transition before displaying results
      setTimeout(() => {
        setSyncingMonth(false);
        setSyncIsSuccessTransition(false);
        setSyncSummaryModal(data.summary);
        router.refresh();
      }, 700);
    } catch (err: any) {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
      setSyncingMonth(false);
      alert(`Monthly data sync failed: ${err.message}`);
    }
  };

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

  // Monthly content goals state
  const [monthlyReels, setMonthlyReels] = useState(
    client.monthlyGoals?.reels != null ? String(client.monthlyGoals.reels) : ''
  );
  const [monthlyPosts, setMonthlyPosts] = useState(
    client.monthlyGoals?.posts != null ? String(client.monthlyGoals.posts) : ''
  );
  const [monthlyStories, setMonthlyStories] = useState(
    client.monthlyGoals?.stories != null ? String(client.monthlyGoals.stories) : ''
  );
  const [monthlyOther, setMonthlyOther] = useState(
    client.monthlyGoals?.other != null ? String(client.monthlyGoals.other) : ''
  );
  const [monthlyOtherLabel, setMonthlyOtherLabel] = useState(
    client.monthlyGoals?.otherLabel || 'TikToks / UGC'
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
          logoUrl: logoUrl.trim() || null,
          services: services.split(',').map((s) => s.trim()).filter(Boolean),
          notes: notes.trim() || null,
          assignedUserIds,
          industry: industry.trim() || null,
          contactName: contactName.trim() || null,
          contactEmail: contactEmail.trim() || null,
          contactPhone: contactPhone.trim() || null,
          startDate: startDate || null,
          socialAccounts: socialAccountsPayload,
          monthlyGoals: {
            selectedFormats: [
              parseInt(monthlyReels, 10) > 0 ? 'reels' : null,
              parseInt(monthlyPosts, 10) > 0 ? 'posts' : null,
              parseInt(monthlyStories, 10) > 0 ? 'stories' : null,
              parseInt(monthlyOther, 10) > 0 ? 'other' : null,
            ].filter(Boolean) as string[],
            reels: Math.max(0, parseInt(monthlyReels, 10) || 0),
            posts: Math.max(0, parseInt(monthlyPosts, 10) || 0),
            stories: Math.max(0, parseInt(monthlyStories, 10) || 0),
            other: Math.max(0, parseInt(monthlyOther, 10) || 0),
            otherLabel: monthlyOtherLabel.trim() || 'Other Content',
          },
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
        {/* Left Info: Avatar + Name, location, status, services */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flex: '1 1 500px', minWidth: '280px' }}>
          {/* Avatar with Admin Edit Badge */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {client.logoUrl && !logoLoadError ? (
              <img
                src={getProxiedImageUrl(client.logoUrl)}
                alt={client.name}
                referrerPolicy="no-referrer"
                onError={() => setLogoLoadError(true)}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  objectFit: 'cover',
                  border: '2px solid #e2e8f0',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                  backgroundColor: '#f8fafc',
                }}
              />
            ) : (
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  fontWeight: 800,
                  boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)',
                  letterSpacing: '0.02em',
                }}
              >
                {client.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setAvatarInputUrl(client.logoUrl || '');
                  setShowAvatarModal(true);
                }}
                title="Change client profile picture (Admin)"
                style={{
                  position: 'absolute',
                  bottom: -4,
                  right: -4,
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  backgroundColor: '#1e293b',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #ffffff',
                  cursor: 'pointer',
                  boxShadow: '0 1px 4px rgba(0, 0, 0, 0.25)',
                }}
              >
                <Camera size={11} />
              </button>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
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
                items.push(`${g.other} ${g.otherLabel || 'Other'}`);
              }
              if (items.length === 0) return null;

              return (
                <div
                  style={{
                    marginTop: 4,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11,
                    background: '#f1f5f9',
                    color: '#334155',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontWeight: 600,
                  }}
                  title="Monthly Contract Deliverables Quota"
                >
                  <Sparkles size={11} color="#6366f1" />
                  <span>{items.join(' · ')} / mo</span>
                </div>
              );
            })()}
          </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Month selector & Update Month & Followers Button */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                border: '1px solid #a7f3d0',
                borderRadius: 6,
                backgroundColor: '#ecfdf5',
                overflow: 'hidden',
                boxShadow: '0 1px 2px rgba(5, 150, 105, 0.08)',
              }}
            >
              <input
                type="month"
                value={syncMonthPeriod}
                onChange={(e) => setSyncMonthPeriod(e.target.value)}
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  padding: '4px 6px',
                  border: 'none',
                  borderRight: '1px solid #a7f3d0',
                  backgroundColor: '#f0fdf4',
                  color: '#065f46',
                  outline: 'none',
                  cursor: 'pointer',
                }}
                title="Select month to update"
              />
              <button
                type="button"
                onClick={() => handleSyncMonthData()}
                disabled={syncingMonth}
                className="btn btn-sm"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: '#ecfdf5',
                  border: 'none',
                  color: '#065f46',
                  fontWeight: 700,
                  padding: '5px 11px',
                  borderRadius: 0,
                  cursor: 'pointer',
                }}
                title={`Sync live followers and all ${syncMonthPeriod} post metrics`}
              >
                <RefreshCw size={12} className={syncingMonth ? 'animate-spin' : ''} />
                <span>{syncingMonth ? 'Updating Data...' : 'Update Month & Followers'}</span>
              </button>
            </div>

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
              {/* Profile Picture / Logo Section */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '12px 14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  {logoUrl ? (
                    <img
                      src={getProxiedImageUrl(logoUrl)}
                      alt="Logo preview"
                      referrerPolicy="no-referrer"
                      style={{
                        width: 54,
                        height: 54,
                        borderRadius: 12,
                        objectFit: 'cover',
                        border: '2px solid #e2e8f0',
                        backgroundColor: '#ffffff',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 54,
                        height: 54,
                        borderRadius: 12,
                        background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        fontWeight: 800,
                      }}
                    >
                      {name ? name.slice(0, 2).toUpperCase() : 'CL'}
                    </div>
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: '#4b5563', display: 'block', marginBottom: 4, fontWeight: 700 }}>
                    Client Profile Picture / Logo
                  </label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <label
                      className="btn btn-secondary btn-sm"
                      style={{ cursor: 'pointer', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <Upload size={12} /> Upload Photo
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleAvatarFileUpload(file);
                        }}
                      />
                    </label>
                    <input
                      type="url"
                      placeholder="Or paste image URL"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      className="input-field"
                      style={{ flex: '1 1 200px', fontSize: 12, padding: '4px 8px' }}
                    />
                    {logoUrl && (
                      <button
                        type="button"
                        onClick={() => setLogoUrl('')}
                        className="btn btn-ghost btn-sm"
                        style={{ color: '#dc2626', fontSize: 11, padding: '4px 8px' }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

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
                          ? `= ${formatNumber(parseFollowerInput(igInitialFollowers))}`
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
                          ? `= ${formatNumber(parseFollowerInput(igFollowers))}`
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
                          ? `= ${formatNumber(parseFollowerInput(ttInitialFollowers))}`
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
                          ? `= ${formatNumber(parseFollowerInput(ttFollowers))}`
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

              {/* Monthly Content Goals Section */}
              <div
                style={{
                  padding: '16px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={14} color="#6366f1" />
                    <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                      Monthly Content Deliverables (Contract Quota)
                    </strong>
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Leave blank or 0 to hide from tracker
                  </span>
                </div>

                <div className="grid-responsive-3" style={{ gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: '#475569', display: 'block', marginBottom: 3, fontWeight: 600 }}>
                      🎬 Reels / month
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="e.g. 12"
                      value={monthlyReels}
                      onChange={(e) => setMonthlyReels(e.target.value)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#475569', display: 'block', marginBottom: 3, fontWeight: 600 }}>
                      📸 Posts / month (Photos/Carousels)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="e.g. 4"
                      value={monthlyPosts}
                      onChange={(e) => setMonthlyPosts(e.target.value)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#475569', display: 'block', marginBottom: 3, fontWeight: 600 }}>
                      📱 Stories / month
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="e.g. 20"
                      value={monthlyStories}
                      onChange={(e) => setMonthlyStories(e.target.value)}
                      className="input-field"
                    />
                  </div>
                </div>

                {/* Other / Custom Format in Edit Modal */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10, display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: '11px', color: '#475569', display: 'block', marginBottom: 3, fontWeight: 600 }}>
                      ⚡ Custom Format Name (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. TikToks, UGC Videos, Graphics"
                      value={monthlyOtherLabel}
                      onChange={(e) => setMonthlyOtherLabel(e.target.value)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#475569', display: 'block', marginBottom: 3, fontWeight: 600 }}>
                      Custom Target / month
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="e.g. 8"
                      value={monthlyOther}
                      onChange={(e) => setMonthlyOther(e.target.value)}
                      className="input-field"
                    />
                  </div>
                </div>
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

      {/* Change Avatar / Profile Picture Modal (Admin Quick Action) */}
      {showAvatarModal && (
        <div className="modal-overlay">
          <div className="modal-container" style={{ maxWidth: 440, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Camera size={18} color="#4f46e5" />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#111827' }}>
                  Client Profile Picture
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAvatarModal(false)}
                className="btn btn-ghost btn-sm"
                style={{ padding: 4 }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ position: 'relative', marginBottom: 10 }}>
                {avatarInputUrl ? (
                  <img
                    src={getProxiedImageUrl(avatarInputUrl)}
                    alt="Preview"
                    referrerPolicy="no-referrer"
                    style={{
                      width: 90,
                      height: 90,
                      borderRadius: 18,
                      objectFit: 'cover',
                      border: '3px solid #e2e8f0',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      backgroundColor: '#f8fafc',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 90,
                      height: 90,
                      borderRadius: 18,
                      background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 28,
                      fontWeight: 800,
                      boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
                    }}
                  >
                    {client.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                {client.name}
              </span>
              <span style={{ fontSize: 11, color: '#64748b' }}>
                Admin Client Photo Manager
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
                  Upload image file
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAvatarFileUpload(file);
                  }}
                  className="input-field"
                  style={{ fontSize: 12, padding: '6px 8px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
                  Or enter image URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={avatarInputUrl}
                  onChange={(e) => setAvatarInputUrl(e.target.value)}
                  className="input-field"
                  style={{ fontSize: 12.5 }}
                />
              </div>

              {/* Quick social imports */}
              {(existingIg?.handle || existingTt?.handle) && (
                <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 8 }}>
                    Quick import from linked social media
                  </span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {existingIg?.handle && (
                      <button
                        type="button"
                        onClick={() => handleFetchSocialAvatar('instagram')}
                        disabled={fetchingAvatarPlatform === 'instagram'}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                      >
                        <InstagramIcon size={12} color="#be185d" />
                        <span>{fetchingAvatarPlatform === 'instagram' ? 'Fetching...' : 'Use Instagram Photo'}</span>
                      </button>
                    )}
                    {existingTt?.handle && (
                      <button
                        type="button"
                        onClick={() => handleFetchSocialAvatar('tiktok')}
                        disabled={fetchingAvatarPlatform === 'tiktok'}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                      >
                        <TikTokIcon size={12} color="#0f172a" />
                        <span>{fetchingAvatarPlatform === 'tiktok' ? 'Fetching...' : 'Use TikTok Photo'}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 22 }}>
              {client.logoUrl ? (
                <button
                  type="button"
                  onClick={() => handleSaveAvatarDirectly(null)}
                  disabled={savingAvatar}
                  className="btn btn-ghost btn-sm"
                  style={{ color: '#dc2626', fontSize: 11.5 }}
                >
                  Remove picture
                </button>
              ) : <div />}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowAvatarModal(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveAvatarDirectly(avatarInputUrl)}
                  disabled={savingAvatar}
                  className="btn btn-primary btn-sm"
                >
                  {savingAvatar ? 'Saving...' : 'Save Picture'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Countdown & Progress Overlay Modal */}
      {syncingMonth && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div
            className="modal-container"
            style={{
              maxWidth: 480,
              padding: '28px 26px',
              borderRadius: '16px',
              background: '#ffffff',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
              border: '1px solid #e2e8f0',
              textAlign: 'center',
            }}
          >
            {/* Header Icon + Titles */}
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #4f46e5, #059669)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                boxShadow: '0 8px 20px rgba(16, 185, 129, 0.25)',
              }}
            >
              <RefreshCw size={26} className="animate-spin" />
            </div>

            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
              Updating Month & Followers
            </h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 20px' }}>
              Syncing live metrics for <strong style={{ color: '#0f172a' }}>{syncMonthPeriod}</strong> and calculating follower gain
            </p>

            {/* Countdown / Elapsed Timer Box */}
            <div
              style={{
                background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: '16px 20px',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-around',
              }}
            >
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                  Estimated Countdown
                </span>
                <span
                  style={{
                    fontSize: 28,
                    fontWeight: 900,
                    color: syncIsSuccessTransition ? '#059669' : '#4f46e5',
                    fontVariantNumeric: 'tabular-nums',
                    display: 'block',
                    marginTop: 2,
                  }}
                >
                  {syncIsSuccessTransition ? 'Done!' : `${syncCountdown}s`}
                </span>
                <span style={{ fontSize: 10.5, color: '#94a3b8' }}>
                  {syncIsSuccessTransition ? 'Complete' : 'Remaining'}
                </span>
              </div>

              <div style={{ width: 1, height: 40, backgroundColor: '#cbd5e1' }} />

              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                  Time Elapsed
                </span>
                <span
                  style={{
                    fontSize: 28,
                    fontWeight: 900,
                    color: '#0f172a',
                    fontVariantNumeric: 'tabular-nums',
                    display: 'block',
                    marginTop: 2,
                  }}
                >
                  {String(Math.floor(syncElapsedTime / 60)).padStart(2, '0')}:{String(syncElapsedTime % 60).padStart(2, '0')}
                </span>
                <span style={{ fontSize: 10.5, color: '#94a3b8' }}>Stopwatch</span>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: '#e2e8f0',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${syncIsSuccessTransition ? 100 : syncStage === 1 ? 25 : syncStage === 2 ? 50 : syncStage === 3 ? 75 : 90}%`,
                    background: 'linear-gradient(90deg, #4f46e5, #06b6d4, #10b981)',
                    borderRadius: 999,
                    transition: 'width 0.6s ease-in-out',
                  }}
                />
              </div>
            </div>

            {/* Checklist of Real-time Stages */}
            <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              {[
                { stage: 1, label: 'Connecting to social scraper APIs' },
                { stage: 2, label: 'Scraping Instagram & TikTok follower counts' },
                { stage: 3, label: `Syncing deliverable views, likes & comments for ${syncMonthPeriod}` },
                { stage: 4, label: 'Calculating month-over-month follower gain vs previous month' },
                { stage: 5, label: 'Saving snapshot & finalizing results' },
              ].map((s) => {
                const isPast = syncStage > s.stage || syncIsSuccessTransition;
                const isCurrent = syncStage === s.stage && !syncIsSuccessTransition;
                return (
                  <div
                    key={s.stage}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      fontSize: 12.5,
                      color: isPast ? '#059669' : isCurrent ? '#0f172a' : '#94a3b8',
                      fontWeight: isCurrent ? 700 : isPast ? 600 : 400,
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isPast ? '#ecfdf5' : isCurrent ? '#eef2ff' : '#f1f5f9',
                        color: isPast ? '#059669' : isCurrent ? '#4f46e5' : '#94a3b8',
                        border: `1px solid ${isPast ? '#a7f3d0' : isCurrent ? '#c7d2fe' : '#e2e8f0'}`,
                        flexShrink: 0,
                      }}
                    >
                      {isPast ? <Check size={12} strokeWidth={3} /> : isCurrent ? <RefreshCw size={11} className="animate-spin" /> : s.stage}
                    </div>
                    <span>{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Sync Month Data Summary Modal */}
      {syncSummaryModal && (
        <div className="modal-overlay">
          <div className="modal-container" style={{ maxWidth: 520, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={18} color="#059669" />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#111827' }}>
                  Month & Followers Data Synced!
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSyncSummaryModal(null)}
                className="btn btn-ghost btn-sm"
                style={{ padding: 4 }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Month-over-Month Follower Gain Banner */}
              {syncSummaryModal.followerGain && (
                <div
                  style={{
                    background: syncSummaryModal.followerGain.gain == null ? '#f8fafc' : syncSummaryModal.followerGain.gain >= 0 ? 'linear-gradient(135deg, #ecfdf5, #f0fdf4)' : 'linear-gradient(135deg, #fef2f2, #fff1f2)',
                    border: `1px solid ${syncSummaryModal.followerGain.gain == null ? '#e2e8f0' : syncSummaryModal.followerGain.gain >= 0 ? '#a7f3d0' : '#fecaca'}`,
                    borderRadius: 10,
                    padding: '14px 16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: syncSummaryModal.followerGain.gain >= 0 ? '#065f46' : '#991b1b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Follower Gain This Month ({syncSummaryModal.followerGain.month})
                    </span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>
                      vs {syncSummaryModal.followerGain.prevMonth || 'Previous Month'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', margin: '4px 0 8px' }}>
                    <div
                      style={{
                        fontSize: 26,
                        fontWeight: 900,
                        color: syncSummaryModal.followerGain.gain == null ? '#0f172a' : syncSummaryModal.followerGain.gain >= 0 ? '#059669' : '#dc2626',
                      }}
                    >
                      {syncSummaryModal.followerGain.gain != null
                        ? `${syncSummaryModal.followerGain.gain >= 0 ? '+' : ''}${formatNumber(syncSummaryModal.followerGain.gain)}`
                        : formatNumber(syncSummaryModal.followerGain.total)}
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: syncSummaryModal.followerGain.gain >= 0 ? '#047857' : '#b91c1c' }}>
                      {syncSummaryModal.followerGain.gainPct != null
                        ? `(${syncSummaryModal.followerGain.gainPct >= 0 ? '+' : ''}${syncSummaryModal.followerGain.gainPct.toFixed(1)}% gained)`
                        : 'followers recorded'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 12, fontSize: 11.5, color: '#334155', flexWrap: 'wrap', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 8 }}>
                    <span>Live Total: <strong>{formatNumber(syncSummaryModal.followerGain.total)}</strong></span>
                    {syncSummaryModal.followerGain.prevTotal != null && (
                      <span>Previous Base: <strong>{formatNumber(syncSummaryModal.followerGain.prevTotal)}</strong></span>
                    )}
                    {syncSummaryModal.followerGain.igGain != null && (
                      <span style={{ color: '#be185d' }}>
                        IG: <strong>{syncSummaryModal.followerGain.igGain >= 0 ? `+${formatNumber(syncSummaryModal.followerGain.igGain)}` : formatNumber(syncSummaryModal.followerGain.igGain)}</strong>
                      </span>
                    )}
                    {syncSummaryModal.followerGain.ttGain != null && (
                      <span style={{ color: '#0f172a' }}>
                        TikTok: <strong>{syncSummaryModal.followerGain.ttGain >= 0 ? `+${formatNumber(syncSummaryModal.followerGain.ttGain)}` : formatNumber(syncSummaryModal.followerGain.ttGain)}</strong>
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Followers summary box */}
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                  Audience & Follower Counts
                </div>
                {syncSummaryModal.socials && syncSummaryModal.socials.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {syncSummaryModal.socials.map((s: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                          {s.platform === 'instagram' ? <InstagramIcon size={13} color="#be185d" /> : <TikTokIcon size={13} color="#0f172a" />}
                          {s.handle || s.platform}
                        </span>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>
                          {formatNumber(s.after)} followers
                          {s.diff !== 0 && (
                            <span style={{ marginLeft: 6, color: s.diff > 0 ? '#059669' : '#dc2626', fontSize: 11 }}>
                              ({s.diff > 0 ? `+${formatNumber(s.diff)}` : formatNumber(s.diff)})
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 11.5, color: '#64748b', margin: 0 }}>
                    No Instagram or TikTok handle was configured for follower sync.
                  </p>
                )}
              </div>

              {/* Month Posts summary box */}
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Month Posts ({syncMonthPeriod})</span>
                  <span style={{ color: '#059669' }}>
                    {syncSummaryModal.totalPostsSynced} / {syncSummaryModal.totalPostsInMonth} posts updated
                  </span>
                </div>
                {syncSummaryModal.posts && syncSummaryModal.posts.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                    {syncSummaryModal.posts.map((p: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>
                          {p.title}
                        </span>
                        <span style={{ fontWeight: 700, color: '#4338ca' }}>
                          {formatNumber(p.views)} views · {formatNumber(p.likes)} likes
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 11.5, color: '#64748b', margin: 0 }}>
                    {syncSummaryModal.totalPostsInMonth === 0
                      ? `No deliverables found for ${syncMonthPeriod}.`
                      : `No posts in ${syncMonthPeriod} have live Instagram or TikTok URLs attached yet.`}
                  </p>
                )}
              </div>

              {/* Any errors or warnings */}
              {syncSummaryModal.errors && syncSummaryModal.errors.length > 0 && (
                <div style={{ background: '#fffbeb', border: '1px solid #fef08a', padding: 10, borderRadius: 6 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#b45309', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={13} /> Notice
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#78350f' }}>
                    {syncSummaryModal.errors.map((e: string, i: number) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
              <button
                type="button"
                onClick={() => setSyncSummaryModal(null)}
                className="btn btn-primary btn-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

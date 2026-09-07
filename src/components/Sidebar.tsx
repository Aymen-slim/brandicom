'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { UserSummary, ClientData } from '@/types';
import { formatCompactMoney } from '@/lib/format';
import {
  Search,
  Sparkles,
  LayoutDashboard,
  Users,
  Calendar,
  Film,
  Settings,
  LogOut,
  Shield,
  UserCheck,
  Wallet,
  X,
} from 'lucide-react';

interface SidebarProps {
  user?: UserSummary | null;
  topClients?: Array<Pick<ClientData, 'id' | 'name'> & { monthlyFee?: number | null }>;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ user, topClients = [], isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdminUser = user?.role === 'admin';

  const handleSignOut = async () => {
    try {
      const supabase = createBrowserSupabaseClient();
      await supabase.auth.signOut();
    } finally {
      router.push('/login');
      router.refresh();
    }
  };

  const colors = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#0ea5e9'];

  const workspaceNav = [
    { label: 'Cockpit & Goals', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Clients & Accounts', href: '/clients', icon: Users },
    { label: 'Calendar', href: '/calendar', icon: Calendar },
    { label: 'Partners', href: '/partners', icon: Film },
    ...(isAdminUser ? [{ label: 'Finance', href: '/finance', icon: Wallet }] : []),
    { label: 'Settings & Team', href: '/settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      <div
        className={`sidebar-backdrop ${isOpen ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className={`sidebar-aside ${isOpen ? 'open' : ''}`}>
        {/* Brand Header */}
        <div className="sidebar-header-bar">
          <Link href="/dashboard" className="sidebar-brand-wrap" style={{ textDecoration: 'none' }}>
            <div className="sidebar-brand-badge">
              <Image
                src="/logo.png"
                alt="Brandicom Logo"
                width={28}
                height={28}
                priority
                className="sidebar-brand-img"
              />
            </div>
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-name">Brandicom</span>
              <span className="sidebar-brand-badge-pill">Studio</span>
            </div>
          </Link>

          {/* Close button on mobile */}
          <button
            type="button"
            onClick={onClose}
            className="mobile-nav-btn sidebar-close-btn"
            title="Close menu"
            aria-label="Close navigation"
          >
            <X size={17} />
          </button>
        </div>

        {/* User Card (Prominent on mobile, sleek on desktop) */}
        <div className="sidebar-user-card">
          <div className="sidebar-user-avatar">
            {user?.name ? user.name.slice(0, 2).toUpperCase() : 'AG'}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">
              {user?.name || 'Agency Staff'}
            </div>
            <div className="sidebar-user-role">
              {isAdminUser ? (
                <span className="role-tag-admin">
                  <Shield size={10} /> Admin
                </span>
              ) : (
                <span className="role-tag-member">
                  <UserCheck size={10} /> Member
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="sidebar-signout-btn"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>

        {/* Quick Action Tiles (Search / Ask AI) */}
        <div className="sidebar-actions-wrap">
          {/* Quick Search */}
          <button
            type="button"
            className="sidebar-action-tile search-tile"
            onClick={() => {
              onClose?.();
              const evt = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true });
              window.dispatchEvent(evt);
            }}
          >
            <div className="action-tile-icon-wrap">
              <Search size={14} />
            </div>
            <div className="action-tile-text">
              <span className="action-tile-title">Quick Search</span>
              <span className="action-tile-desc">Find accounts, posts & partners</span>
            </div>
            <span className="action-shortcut-badge desktop-only-badge">⌘K</span>
          </button>

          {/* Ask AI */}
          <button
            type="button"
            className="sidebar-action-tile ai-tile"
            onClick={() => {
              onClose?.();
              const evt = new KeyboardEvent('keydown', { key: 'j', metaKey: true, bubbles: true });
              window.dispatchEvent(evt);
            }}
          >
            <div className="action-tile-icon-wrap ai-icon-wrap">
              <Sparkles size={14} color="#8b5cf6" />
            </div>
            <div className="action-tile-text">
              <span className="action-tile-title" style={{ color: '#6d28d9' }}>Ask AI Assistant</span>
              <span className="action-tile-desc">Captions, plans & analytics</span>
            </div>
            <span className="action-shortcut-badge desktop-only-badge">⌘J</span>
          </button>
        </div>

        {/* Scrollable Nav Sections */}
        <div className="sidebar-scrollable-content">
          {/* WORKSPACE SECTION */}
          <div className="sidebar-nav-section">
            <div className="sidebar-section-title">
              Workspace
            </div>

            <div className="sidebar-nav-list">
              {workspaceNav.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`sidebar-nav-link ${isActive ? 'active' : ''}`}
                  >
                    <div className="nav-link-icon">
                      <Icon size={16} strokeWidth={isActive ? 2.3 : 1.8} />
                    </div>
                    <span className="nav-link-label">{item.label}</span>
                    {isActive && <div className="nav-link-active-pill" />}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* BIGGEST ACCOUNTS */}
          {topClients.length > 0 && (
            <div className="sidebar-nav-section" style={{ marginTop: '16px' }}>
              <div className="sidebar-section-title">
                Top Accounts
              </div>

              <div className="sidebar-nav-list">
                {topClients.slice(0, 5).map((acc, idx) => (
                  <Link
                    key={acc.id}
                    href={`/clients/${acc.id}`}
                    onClick={onClose}
                    className="sidebar-client-link"
                  >
                    <span
                      className="client-avatar-badge"
                      style={{ backgroundColor: colors[idx % colors.length] }}
                    >
                      {acc.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="client-name-text">
                      {acc.name}
                    </span>
                    {isAdminUser && acc.monthlyFee != null && (
                      <span
                        suppressHydrationWarning
                        className="client-fee-badge"
                      >
                        {formatCompactMoney(acc.monthlyFee)}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Compass, TrendingUp, Menu, Search, Sparkles } from 'lucide-react';
import { PeriodPicker } from './PeriodPicker';
import { AdminPostingNotifier } from './AdminPostingNotifier';
import { UserSummary } from '@/types';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  user?: UserSummary | null;
  children?: React.ReactNode;
  onToggleNav?: () => void;
}

export function Header({ title, subtitle, user, children, onToggleNav }: HeaderProps) {
  const pathname = usePathname();
  const isDashboard = pathname === '/dashboard';

  const triggerSearch = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
  };

  const triggerAi = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', metaKey: true, bubbles: true }));
  };

  return (
    <header className="app-header">
      {/* Left: Hamburger menu + Brand / Page Title */}
      <div className="header-left-wrap">
        <button
          type="button"
          onClick={onToggleNav}
          className="mobile-header-btn mobile-nav-btn"
          aria-label="Toggle navigation menu"
          title="Open menu"
        >
          <Menu size={18} />
        </button>

        {/* Mobile Brand Mark */}
        <Link href="/dashboard" className="mobile-brand-icon" title="Brandicom CRM">
          <Image
            src="/logo.png"
            alt="Brandicom Logo"
            width={28}
            height={28}
            priority
            className="mobile-brand-img"
          />
        </Link>

        {/* Desktop Tabs (Only on Dashboard) */}
        {isDashboard ? (
          <>
            <div className="desktop-only-tabs">
              <div className="desktop-tab-item active">
                <Compass size={14} />
                <span>Cockpit</span>
              </div>

              <Link href="/clients" className="desktop-tab-item">
                <TrendingUp size={14} />
                <span>Deliverables & Roster</span>
              </Link>
            </div>

            {/* Mobile Header Title */}
            <span className="mobile-header-title">Cockpit</span>
          </>
        ) : (
          <div className="header-title-container">
            <h2 className="header-title-text" title={title}>
              {title}
            </h2>
            {subtitle && (
              <p className="desktop-only-subtitle">
                {subtitle}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Right controls */}
      <div className="header-right-wrap">
        {/* Quick Search trigger on mobile */}
        <button
          type="button"
          onClick={triggerSearch}
          className="mobile-header-btn mobile-only-btn"
          title="Search (⌘K)"
          aria-label="Quick search"
        >
          <Search size={16} />
        </button>

        {/* Quick Ask AI trigger on mobile */}
        <button
          type="button"
          onClick={triggerAi}
          className="mobile-header-btn mobile-only-btn"
          title="Ask AI (⌘J)"
          aria-label="Ask AI"
          style={{ color: '#8b5cf6' }}
        >
          <Sparkles size={16} />
        </button>

        {isDashboard && (
          <Suspense fallback={null}>
            <PeriodPicker />
          </Suspense>
        )}

        <AdminPostingNotifier user={user} />
        {children}
      </div>
    </header>
  );
}

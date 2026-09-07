'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileTabBar } from './MobileTabBar';
import { UserSummary } from '@/types';

export function AppShell({
  user,
  title,
  subtitle,
  topClients,
  children,
  actions,
}: {
  user: UserSummary;
  title?: string;
  subtitle?: string;
  topClients?: Array<{ id: string; name: string; monthlyFee?: number | null }>;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile navigation drawer whenever page route changes
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  return (
    <div className="app-container">
      <Sidebar
        user={user}
        topClients={topClients}
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />
      <div className="main-content">
        <Header
          title={title}
          subtitle={subtitle}
          user={user}
          onToggleNav={() => setMobileNavOpen((prev) => !prev)}
        >
          {actions}
        </Header>
        <main className="page-body">{children}</main>
      </div>

      {/* Modern bottom tab bar for mobile phone screens */}
      <MobileTabBar
        user={user}
        onToggleMenu={() => setMobileNavOpen((prev) => !prev)}
        isMenuOpen={mobileNavOpen}
      />
    </div>
  );
}

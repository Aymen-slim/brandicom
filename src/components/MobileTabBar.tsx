'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Calendar, Film, Menu, X } from 'lucide-react';
import { UserSummary } from '@/types';

interface MobileTabBarProps {
  user?: UserSummary | null;
  onToggleMenu: () => void;
  isMenuOpen: boolean;
}

export function MobileTabBar({ user, onToggleMenu, isMenuOpen }: MobileTabBarProps) {
  const pathname = usePathname();

  const navItems = [
    {
      label: 'Cockpit',
      href: '/dashboard',
      icon: LayoutDashboard,
      isActive: pathname === '/dashboard',
    },
    {
      label: 'Clients',
      href: '/clients',
      icon: Users,
      isActive: pathname.startsWith('/clients'),
    },
    {
      label: 'Calendar',
      href: '/calendar',
      icon: Calendar,
      isActive: pathname.startsWith('/calendar'),
    },
    {
      label: 'Partners',
      href: '/partners',
      icon: Film,
      isActive: pathname.startsWith('/partners'),
    },
  ];

  return (
    <nav className="mobile-tab-bar" aria-label="Mobile Navigation">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = item.isActive && !isMenuOpen;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`mobile-tab-item ${active ? 'active' : ''}`}
          >
            <div className="mobile-tab-icon-wrap">
              <Icon size={19} strokeWidth={active ? 2.4 : 1.8} />
              {active && <span className="mobile-tab-active-dot" />}
            </div>
            <span className="mobile-tab-label">{item.label}</span>
          </Link>
        );
      })}

      {/* Menu / Drawer Toggle Button */}
      <button
        type="button"
        onClick={onToggleMenu}
        className={`mobile-tab-item ${isMenuOpen ? 'active' : ''}`}
        aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
      >
        <div className="mobile-tab-icon-wrap">
          {isMenuOpen ? (
            <X size={19} strokeWidth={2.4} />
          ) : (
            <Menu size={19} strokeWidth={1.8} />
          )}
          {isMenuOpen && <span className="mobile-tab-active-dot" />}
        </div>
        <span className="mobile-tab-label">{isMenuOpen ? 'Close' : 'More'}</span>
      </button>
    </nav>
  );
}

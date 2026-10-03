'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileTabBar } from './MobileTabBar';
import { CommandSearch } from './CommandSearch';
import { AppChrome } from './AppChrome';
import { PageChromeContext, PageChromeProps } from './PageChrome';
import { normalizePeriod } from '@/lib/period';
import { UserSummary } from '@/types';

function fallbackTitle(pathname: string) {
  if (pathname.startsWith('/finance/invoices/')) return 'Invoice';
  if (pathname.startsWith('/finance/invoices')) return 'Invoices';
  if (pathname.startsWith('/finance/expenses')) return 'Expenses';
  if (pathname.startsWith('/clients/')) return 'Client account';
  const titles: Record<string, string> = {
    '/dashboard': 'Cockpit', '/clients': 'Client accounts', '/calendar': 'Content Calendar',
    '/partners': 'Partners', '/settings': 'Agency Settings & Governance', '/leads': 'Website leads',
    '/blog': 'Blog', '/finance': 'Finance',
  };
  return titles[pathname] || 'Workspace';
}

export function AppShell({ user, topClients, children }: {
  user: UserSummary;
  topClients?: Array<{ id: string; name: string; monthlyFee?: number | null }>;
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [page, setPage] = useState<(PageChromeProps & { token: symbol }) | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const historyTarget = useRef<string | null>(null);
  const currentPage = page?.pathname === pathname && (!page.period || page.period === normalizePeriod(searchParams.get('period'))) ? page : null;
  const currentUser = currentPage?.user || user;
  const register = useCallback((next: PageChromeProps) => {
    const token = Symbol();
    setPage({ ...next, token });
    return () => setPage((previous) => previous?.token === token ? null : previous);
  }, []);

  // Close mobile navigation drawer whenever page route changes
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (historyTarget.current === routeKey) {
      historyTarget.current = null;
      router.refresh();
    }
  }, [routeKey, router]);

  useEffect(() => {
    const onHistory = () => { historyTarget.current = `${window.location.pathname}?${new URLSearchParams(window.location.search)}`; };
    let focusFrame = 0;
    const onFocus = () => {
      if (document.visibilityState !== 'visible') return;
      window.cancelAnimationFrame(focusFrame);
      focusFrame = window.requestAnimationFrame(() => router.refresh());
    };
    const onChange = (event: Event) => {
      if (['accounts', 'user'].includes((event as CustomEvent).detail?.scope)) router.refresh();
    };
    window.addEventListener('workspace:data-changed', onChange);
    window.addEventListener('popstate', onHistory);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('workspace:data-changed', onChange);
      window.removeEventListener('popstate', onHistory);
      window.removeEventListener('focus', onFocus);
    };
  }, [router]);

  return (
    <PageChromeContext.Provider value={register}>
      <div className="app-container">
        <Sidebar user={currentUser} topClients={topClients} isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
        <div className="main-content">
          <Header title={currentPage?.title || fallbackTitle(pathname)} subtitle={currentPage?.subtitle} user={currentUser}
            monthlyViews={currentPage?.monthlyViews} onToggleNav={() => setMobileNavOpen((previous) => !previous)}>
            {currentPage?.actions}
          </Header>
          <main className="page-body">{children}</main>
        </div>

        {/* Modern bottom tab bar for mobile phone screens */}
        <MobileTabBar user={currentUser} onToggleMenu={() => setMobileNavOpen((previous) => !previous)} isMenuOpen={mobileNavOpen} />
      </div>
      <Suspense fallback={null}><CommandSearch /></Suspense>
      <AppChrome />
    </PageChromeContext.Provider>
  );
}

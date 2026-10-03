'use client';

import React, { createContext, useContext, useEffect } from 'react';
import type { UserSummary } from '@/types';

export interface PageChromeProps {
  pathname: string;
  period?: string;
  user?: UserSummary;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  monthlyViews?: number;
}

export const PageChromeContext = createContext<((page: PageChromeProps) => () => void) | null>(null);

export function PageChrome({ children, ...page }: PageChromeProps & { children: React.ReactNode }) {
  const register = useContext(PageChromeContext);
  const { pathname, period, user, title, subtitle, actions, monthlyViews } = page;

  useEffect(() => {
    return register?.({ pathname, period, user, title, subtitle, actions, monthlyViews });
  }, [register, pathname, period, user, title, subtitle, actions, monthlyViews]);

  return <>{children}</>;
}

'use client';

import React, { useEffect, useRef, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { PageResult } from '@/lib/pagination';
import { shouldSyncListFilters } from '@/lib/workspaceEvents';

export function useListFilters(values: Record<string, string>, initialValues: Record<string, string>, onServerValues: (values: Record<string, string>) => void) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const key = JSON.stringify(values);
  const initialKey = JSON.stringify(initialValues);
  const previousServerKey = useRef(initialKey);
  const historyChange = useRef(false);
  const syncValues = useRef(onServerValues);
  syncValues.current = onServerValues;
  const reset = shouldSyncListFilters(previousServerKey.current, key, initialKey, historyChange.current);
  useEffect(() => {
    const onHistory = () => { historyChange.current = true; };
    window.addEventListener('popstate', onHistory);
    return () => window.removeEventListener('popstate', onHistory);
  }, []);
  useEffect(() => {
    previousServerKey.current = initialKey;
    if (reset) {
      historyChange.current = false;
      syncValues.current(JSON.parse(initialKey));
    }
  }, [reset, initialKey]);
  useEffect(() => {
    if (key === initialKey || reset) return;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      for (const [name, value] of Object.entries(JSON.parse(key) as Record<string, string>)) {
        if (!value || value === 'all') params.delete(name);
        else params.set(name, value);
      }
      params.delete('page');
      startTransition(() => router.replace(`${window.location.pathname}?${params}`, { scroll: false }));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [key, initialKey, router, reset]);
  return pending || key !== initialKey;
}

export function ListPagination({ result }: { result: Pick<PageResult<unknown>, 'page' | 'pageSize' | 'total'> }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const href = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    return `${pathname}?${params}`;
  };
  return (
    <nav aria-label="List pagination" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 14 }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{result.total} results · Page {result.page} of {pages}</span>
      <div style={{ display: 'flex', gap: 8 }}>
        {result.page > 1 && <Link className="btn btn-secondary btn-sm" href={href(result.page - 1)} scroll={false}>Previous</Link>}
        {result.page < pages && <Link className="btn btn-secondary btn-sm" href={href(result.page + 1)} scroll={false}>Next</Link>}
      </div>
    </nav>
  );
}

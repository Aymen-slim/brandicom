export function shouldSyncListFilters(previousServerKey: string, draftKey: string, serverKey: string, fromHistory = false) {
  return fromHistory || previousServerKey !== serverKey && draftKey === previousServerKey;
}

export function notifyWorkspaceChange(scope: 'accounts' | 'posting' | 'user') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('workspace:data-changed', { detail: { scope } }));
  }
}

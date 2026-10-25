/**
 * Health snapshots are shared between admins and assigned members. Keep
 * invoice-derived and other financial factors out of member-visible payloads.
 * The score itself may still reflect those factors; only the raw factor is
 * hidden.
 */
export function memberSafeHealthFactors(factors: unknown): Record<string, unknown> {
  if (!factors || typeof factors !== 'object' || Array.isArray(factors)) return {};
  const safe = { ...(factors as Record<string, unknown>) };
  delete safe.overdueInvoices;
  return safe;
}

export function memberHealthSummary(
  health: { score: number; risk: string },
  clientName?: string | null
): string {
  return `${clientName || 'This client'} is at ${health.risk} risk with a health score of ${health.score}/100.`;
}

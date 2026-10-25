function valueLabel(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function actionTitle(action: any): string {
  switch (action?.type) {
    case 'create_client':
      return `Create client${action.name ? ` · ${action.name}` : ''}`;
    case 'create_deliverable':
      return `Create deliverable${action.idea ? ` · ${action.idea}` : ''}`;
    case 'update_deliverable_status':
      return `Update post status${action.status ? ` → ${action.status}` : ''}`;
    case 'update_client': {
      const keys = action.fields && typeof action.fields === 'object' ? Object.keys(action.fields) : [];
      return `Update client${keys.length ? ` · ${keys.join(', ')}` : ''}`;
    }
    case 'add_client_note':
      return 'Add client note';
    case 'book_partner':
      return 'Book partner';
    case 'upsert_goal':
      return `Set ${action.metric || 'goal'} target`;
    case 'create_expense':
      return `Record expense${action.amount != null ? ` · ${action.amount} TND` : ''}`;
    case 'create_invoice':
      return 'Create draft invoice';
    case 'record_payment':
      return 'Record payment';
    case 'update_contract':
      return 'Update contract';
    default:
      return String(action?.type || 'Change').replace(/_/g, ' ');
  }
}

export function actionDetails(action: any): Array<{ label: string; value: string }> {
  if (!action || typeof action !== 'object') return [];
  const skip = new Set(['type', 'fields']);
  const rows: Array<{ label: string; value: string }> = [];

  if (action.type === 'update_client' && action.fields && typeof action.fields === 'object') {
    for (const [key, value] of Object.entries(action.fields)) {
      rows.push({ label: humanKey(key), value: valueLabel(value) });
    }
  }

  for (const [key, value] of Object.entries(action)) {
    if (skip.has(key) || value === null || value === undefined || value === '') continue;
    rows.push({ label: humanKey(key), value: valueLabel(value) });
  }
  return rows.slice(0, 12);
}

function humanKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function proposalStatusLabel(proposal: {
  autoApplied?: boolean;
  status?: string;
  needsConfirmation?: boolean;
}): string {
  if (proposal.status === 'reverted') return 'Undone';
  if (proposal.status === 'rejected') return 'Rejected';
  if (proposal.status === 'applying') return 'Applying…';
  if (proposal.autoApplied) return 'Applied automatically';
  if (proposal.status === 'applied') return 'Applied';
  if (proposal.status === 'failed') return 'Failed';
  if (proposal.needsConfirmation) return 'Needs your confirmation';
  return 'Proposed changes';
}

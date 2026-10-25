export interface UndoActionView {
  type: 'restore_deliverable_status' | 'delete_deliverable' | string;
  deliverableId: string;
  previousStatus?: string;
  label?: string;
}

export interface ApplyResultView {
  ok: boolean;
  type: string;
  id?: string;
  name?: string;
  error?: string;
  index?: number;
  undo?: UndoActionView;
}

export interface ProposalView {
  proposalId?: string;
  summary?: string;
  actions: any[];
  autoApplied?: boolean;
  needsConfirmation?: boolean;
  results?: ApplyResultView[];
  undo?: UndoActionView[];
  status?: string;
  appliedAt?: string | null;
}

export interface ToolActivity {
  name: string;
  status: string;
  summary?: string;
}

export interface ChatItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  proposal?: ProposalView;
  tools?: ToolActivity[];
  createdAt?: string;
  error?: boolean;
  streaming?: boolean;
}

export interface UsageSnapshot {
  used: number;
  limit: number;
  remaining: number;
  resetAt?: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
}

export type AiTask = 'chat' | 'ideas' | 'report' | 'health' | 'digest' | 'lead' | 'caption';

export const AI_DEFAULT_LANGUAGE = 'en';
export const AI_HISTORY_LIMIT = 24;
export const AI_MAX_TOOL_LOOPS = 8;

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function aiEnabled(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/**
 * Model routing is intentionally explicit. Chat and reports need stronger
 * tool use and reasoning; summaries and digests can run on the fast model.
 */
export function modelFor(task: AiTask): string {
  const taskSpecific = process.env[`GEMINI_MODEL_${task.toUpperCase()}`];
  if (taskSpecific) return taskSpecific;

  if (task === 'chat' || task === 'report' || task === 'lead' || task === 'ideas' || task === 'caption') {
    return process.env.GEMINI_MODEL_CHAT || process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  }
  return process.env.GEMINI_MODEL_FAST || 'gemini-3.5-flash-lite';
}

export function fallbackModelsFor(task: AiTask): string[] {
  const primary = modelFor(task);
  const configured = (process.env.GEMINI_MODEL_FALLBACKS || '')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);
  const defaults = ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'];
  const seen = new Set<string>();
  const models: string[] = [];
  for (const model of [...configured, ...defaults]) {
    if (model === primary || seen.has(model)) continue;
    seen.add(model);
    models.push(model);
  }
  return models;
}

export function timeoutMsFor(task: AiTask): number {
  if (task === 'report') return envNumber('AI_REPORT_TIMEOUT_MS', 60_000);
  if (task === 'chat' || task === 'ideas' || task === 'lead') return envNumber('AI_TIMEOUT_MS', 45_000);
  return envNumber('AI_FAST_TIMEOUT_MS', 20_000);
}

export function dailyAiLimit(): number {
  return envNumber('AI_DAILY_LIMIT', 80);
}

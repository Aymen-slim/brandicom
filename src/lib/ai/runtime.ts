import type {
  Content,
  FunctionCall,
  GenerateContentConfig,
  GenerateContentResponse,
  Part,
} from '@google/genai';
import { getGemini } from './gemini';
import { fallbackModelsFor, modelFor, timeoutMsFor, type AiTask } from './config';
import { logAiRun } from './telemetry';

export class AiRuntimeError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = 'ai_error', status = 500) {
    super(message);
    this.name = 'AiRuntimeError';
    this.code = code;
    this.status = status;
  }
}

export interface AiCallMeta {
  userId?: string | null;
  clientId?: string | null;
  feature?: string;
}

interface GeneratedResult {
  text: string;
  response: GenerateContentResponse;
  model: string;
  latencyMs: number;
  usage: {
    promptTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

interface StreamResult {
  text: string;
  parts: Part[];
  functionCalls: FunctionCall[];
  model: string;
  latencyMs: number;
  usage: GeneratedResult['usage'];
}

function errorStatus(error: any): number {
  return Number(error?.status || error?.code || error?.response?.status || 0);
}

function isRetryable(error: any): boolean {
  if (!error) return false;
  if (error?.name === 'AbortError') return false;
  const status = errorStatus(error);
  if (status === 404 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504) return true;
  const message = String(error?.message || '');
  return /429|5\d\d|timeout|timed out|ECONNRESET|ETIMEDOUT|fetch failed|network|overloaded|unavailable/i.test(
    message
  );
}

function combineSignals(signals: Array<AbortSignal | undefined>): AbortSignal {
  const valid = signals.filter((signal): signal is AbortSignal => Boolean(signal));
  if (valid.length === 0) return new AbortController().signal;
  if (valid.length === 1) return valid[0];
  const anySignal = (AbortSignal as any).any;
  if (typeof anySignal === 'function') return anySignal(valid);

  const controller = new AbortController();
  for (const signal of valid) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

function requestSignal(external: AbortSignal | undefined, timeoutMs: number) {
  const timeoutController = new AbortController();
  const timer = setTimeout(() => {
    timeoutController.abort(new Error(`AI request timed out after ${timeoutMs}ms`));
  }, timeoutMs);
  return {
    signal: combineSignals([external, timeoutController.signal]),
    clear: () => clearTimeout(timer),
  };
}

function usageFrom(response: GenerateContentResponse): GeneratedResult['usage'] {
  const usage = response.usageMetadata;
  return {
    promptTokens: usage?.promptTokenCount,
    outputTokens: usage?.candidatesTokenCount,
    totalTokens: usage?.totalTokenCount,
  };
}

function modelsToTry(task: AiTask): string[] {
  return [modelFor(task), ...fallbackModelsFor(task)];
}

function messageFromError(error: any): string {
  return String(error?.message || error || 'AI request failed');
}

export async function aiGenerate(opts: {
  task: AiTask;
  contents: Content[];
  config?: GenerateContentConfig;
  meta?: AiCallMeta;
  signal?: AbortSignal;
}): Promise<GeneratedResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new AiRuntimeError('GEMINI_API_KEY is not configured', 'not_configured', 503);
  }

  const ai = getGemini();
  const timeoutMs = timeoutMsFor(opts.task);
  let lastError: unknown;

  for (const model of modelsToTry(opts.task)) {
    const started = Date.now();
    const { signal, clear } = requestSignal(opts.signal, timeoutMs);
    try {
      const response = await ai.models.generateContent({
        model,
        contents: opts.contents,
        config: { ...opts.config, abortSignal: signal } as GenerateContentConfig,
      });
      const latencyMs = Date.now() - started;
      const usage = usageFrom(response);
      await logAiRun({
        task: opts.task,
        feature: opts.meta?.feature,
        userId: opts.meta?.userId,
        clientId: opts.meta?.clientId,
        model,
        status: 'ok',
        latencyMs,
        promptTokens: usage.promptTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
      });
      return { text: (response.text || '').trim(), response, model, latencyMs, usage };
    } catch (error) {
      lastError = error;
      const latencyMs = Date.now() - started;
      await logAiRun({
        task: opts.task,
        feature: opts.meta?.feature,
        userId: opts.meta?.userId,
        clientId: opts.meta?.clientId,
        model,
        status: 'error',
        latencyMs,
        error: messageFromError(error),
      });
      if (opts.signal?.aborted) {
        throw new AiRuntimeError('AI request was cancelled', 'aborted', 499);
      }
      if ((error as any)?.name === 'AbortError') {
        lastError = new Error(`AI request timed out after ${timeoutMs}ms`);
        continue;
      }
      if (!isRetryable(error)) break;
    } finally {
      clear();
    }
  }

  throw new AiRuntimeError(messageFromError(lastError), 'ai_failed', 502);
}

export async function aiStream(opts: {
  task: AiTask;
  contents: Content[];
  config?: GenerateContentConfig;
  meta?: AiCallMeta;
  signal?: AbortSignal;
  onText?: (delta: string) => void;
}): Promise<StreamResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new AiRuntimeError('GEMINI_API_KEY is not configured', 'not_configured', 503);
  }

  const ai = getGemini();
  const timeoutMs = timeoutMsFor(opts.task);
  let lastError: unknown;

  for (const model of modelsToTry(opts.task)) {
    const started = Date.now();
    const { signal, clear } = requestSignal(opts.signal, timeoutMs);
    let text = '';
    let parts: Part[] = [];
    let usage: GeneratedResult['usage'] = {};
    let emitted = false;

    try {
      const stream = await ai.models.generateContentStream({
        model,
        contents: opts.contents,
        config: { ...opts.config, abortSignal: signal } as GenerateContentConfig,
      });

      for await (const chunk of stream) {
        if (chunk.usageMetadata) {
          usage = {
            promptTokens: chunk.usageMetadata.promptTokenCount,
            outputTokens: chunk.usageMetadata.candidatesTokenCount,
            totalTokens: chunk.usageMetadata.totalTokenCount,
          };
        }
        const chunkParts = chunk.candidates?.[0]?.content?.parts || [];
        for (const part of chunkParts) {
          // Preserve the complete part. Gemini 3 requires thoughtSignature on
          // function-call parts when they are sent back in the next turn.
          parts.push(part);
          if (part.functionCall) continue;
          if (typeof part.text === 'string' && !part.thought) {
            if (!part.text) continue;
            text += part.text;
            emitted = true;
            opts.onText?.(part.text);
          }
        }
      }

      const latencyMs = Date.now() - started;
      const functionCalls = parts
        .map((part) => part.functionCall)
        .filter((call): call is FunctionCall => Boolean(call));
      await logAiRun({
        task: opts.task,
        feature: opts.meta?.feature,
        userId: opts.meta?.userId,
        clientId: opts.meta?.clientId,
        model,
        status: 'ok',
        latencyMs,
        promptTokens: usage.promptTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        toolCount: functionCalls.length,
      });
      return { text, parts, functionCalls, model, latencyMs, usage };
    } catch (error) {
      lastError = error;
      const latencyMs = Date.now() - started;
      await logAiRun({
        task: opts.task,
        feature: opts.meta?.feature,
        userId: opts.meta?.userId,
        clientId: opts.meta?.clientId,
        model,
        status: 'error',
        latencyMs,
        error: messageFromError(error),
      });
      if (opts.signal?.aborted) {
        throw new AiRuntimeError('AI request was cancelled', 'aborted', 499);
      }
      if ((error as any)?.name === 'AbortError') {
        lastError = new Error(`AI request timed out after ${timeoutMs}ms`);
        if (emitted) break;
        parts = [];
        text = '';
        continue;
      }
      if (emitted || !isRetryable(error)) break;
      parts = [];
      text = '';
    } finally {
      clear();
    }
  }

  throw new AiRuntimeError(messageFromError(lastError), 'ai_failed', 502);
}

export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  const objectStart = withoutFence.indexOf('{');
  const arrayStart = withoutFence.indexOf('[');

  let start = -1;
  if (objectStart === -1) start = arrayStart;
  else if (arrayStart === -1) start = objectStart;
  else start = Math.min(objectStart, arrayStart);

  if (start === -1) throw new Error('No JSON found in AI response');

  const opening = withoutFence[start];
  const closing = opening === '{' ? '}' : ']';
  const end = withoutFence.lastIndexOf(closing);
  if (end < start) throw new Error('Incomplete JSON in AI response');
  return JSON.parse(withoutFence.slice(start, end + 1));
}

export async function aiGenerateJson<T>(opts: {
  task: AiTask;
  contents: Content[];
  schema: unknown;
  parse: (value: unknown) => T;
  meta?: AiCallMeta;
  signal?: AbortSignal;
  config?: GenerateContentConfig;
}): Promise<{ data: T; text: string; model: string }> {
  const baseConfig: GenerateContentConfig = {
    ...opts.config,
    responseMimeType: 'application/json',
    responseSchema: opts.schema as any,
  };

  const first = await aiGenerate({
    task: opts.task,
    contents: opts.contents,
    config: baseConfig,
    meta: opts.meta,
    signal: opts.signal,
  });

  try {
    return { data: opts.parse(extractJson(first.text)), text: first.text, model: first.model };
  } catch (firstError) {
    const repair = await aiGenerate({
      task: opts.task,
      contents: [
        ...opts.contents,
        { role: 'model', parts: [{ text: first.text }] },
        {
          role: 'user',
          parts: [
            {
              text:
                'Your previous response could not be parsed. Return valid JSON only, matching the requested schema. ' +
                `Parser error: ${messageFromError(firstError)}`,
            },
          ],
        },
      ],
      config: baseConfig,
      meta: opts.meta,
      signal: opts.signal,
    });

    try {
      return { data: opts.parse(extractJson(repair.text)), text: repair.text, model: repair.model };
    } catch (repairError) {
      throw new AiRuntimeError(
        `The AI returned invalid structured data: ${messageFromError(repairError)}`,
        'invalid_json',
        502
      );
    }
  }
}

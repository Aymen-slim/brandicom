import { NextRequest, NextResponse } from 'next/server';
import { enforceAuth, isAdmin } from '@/lib/permissions';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { aiEnabled, AI_HISTORY_LIMIT, AI_MAX_TOOL_LOOPS } from '@/lib/ai/config';
import { aiStream, AiRuntimeError } from '@/lib/ai/runtime';
import { systemPrompt } from '@/lib/ai/prompt';
import { executeTool, toolDeclarations } from '@/lib/ai/tools';
import { addAiTokens, AiQuotaError, consumeAiQuota } from '@/lib/ai/usage';

export const runtime = 'nodejs';
export const maxDuration = 60;

function asToolResponse(result: unknown): Record<string, unknown> {
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    return result as Record<string, unknown>;
  }
  return { result };
}

function toolSummary(name: string, result: any): string | undefined {
  if (!result) return undefined;
  if (result.error) return String(result.error);
  if (name === 'get_client') return result.name ? `Loaded ${result.name}` : 'Client loaded';
  if (name === 'list_clients') return Array.isArray(result) ? `${result.length} client(s)` : undefined;
  if (name === 'get_top_posts' || name === 'list_deliverables') {
    return Array.isArray(result) ? `${result.length} post(s)` : undefined;
  }
  if (name === 'get_upcoming') return Array.isArray(result) ? `${result.length} scheduled item(s)` : undefined;
  if (name === 'list_partners') return Array.isArray(result) ? `${result.length} partner(s)` : undefined;
  if (name === 'get_contact_submissions') {
    return Array.isArray(result) ? `${result.length} lead(s)` : undefined;
  }
  if (name === 'propose_changes') {
    if (result.error) return String(result.error);
    if (result.autoApplied) {
      return result.failedCount
        ? `Applied ${result.appliedCount}, ${result.failedCount} failed`
        : 'Applied automatically';
    }
    if (result.proposalId) return 'Waiting for confirmation';
    return undefined;
  }
  if (name === 'search') {
    const total = ['clients', 'partners', 'deliverables', 'invoices'].reduce(
      (sum, key) => sum + (Array.isArray(result[key]) ? result[key].length : 0),
      0
    );
    return `${total} match(es)`;
  }
  return undefined;
}

export async function POST(request: NextRequest) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  if (!aiEnabled()) {
    return NextResponse.json(
      { error: 'The AI assistant is not configured. Add GEMINI_API_KEY on the server.' },
      { status: 503 }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return NextResponse.json({ error: 'message is required' }, { status: 400 });
  if (message.length > 8000) {
    return NextResponse.json({ error: 'Message is too long (max 8,000 characters)' }, { status: 400 });
  }

  let usage;
  try {
    usage = await consumeAiQuota(user.id);
  } catch (quotaError) {
    if (quotaError instanceof AiQuotaError) {
      return NextResponse.json(
        {
          error: quotaError.message,
          limit: quotaError.limit,
          used: quotaError.used,
          resetAt: quotaError.resetAt,
        },
        { status: 429 }
      );
    }
    throw quotaError;
  }

  const supabase = createServerSupabaseClient();
  let conversationId: string | null = typeof body.conversationId === 'string' ? body.conversationId : null;

  if (conversationId) {
    const { data: existingConversation } = await supabase
      .from('ai_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!existingConversation) conversationId = null;
  }

  if (!conversationId) {
    const { data: conversation, error: conversationError } = await supabase
      .from('ai_conversations')
      .insert({ user_id: user.id, title: message.slice(0, 80) })
      .select('id')
      .single();
    if (conversationError) {
      console.error('[ai] could not create conversation', conversationError);
      return NextResponse.json({ error: 'Could not start a conversation' }, { status: 500 });
    }
    conversationId = conversation.id;
  }

  const { error: userMessageError } = await supabase.from('ai_messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: message,
  });
  if (userMessageError) {
    console.error('[ai] could not save user message', userMessageError);
    return NextResponse.json({ error: 'Could not save your message. Please try again.' }, { status: 500 });
  }

  const { data: history } = await supabase
    .from('ai_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(AI_HISTORY_LIMIT);

  const contents: any[] = [...(history || [])]
    .reverse()
    .filter((row) => (row.role === 'assistant' || row.role === 'user') && row.content)
    .map((row) => ({
      role: row.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: row.content }],
    }));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch {
          closed = true;
        }
      }, 15_000);

      try {
        send('meta', { conversationId, usage });

        const tools = [{ functionDeclarations: toolDeclarations(isAdmin(user)) }] as any;
        let workingContents = contents;
        let assistantText = '';
        let totalTokens = 0;
        let model = '';
        let proposal: Record<string, unknown> | null = null;
        const toolLog: Array<{ name: string; status: string; summary?: string }> = [];

        for (let loop = 0; loop < AI_MAX_TOOL_LOOPS; loop += 1) {
          if (request.signal.aborted) throw new AiRuntimeError('AI request was cancelled', 'aborted', 499);

          const result = await aiStream({
            task: 'chat',
            contents: workingContents,
            config: {
              systemInstruction: systemPrompt(user, {
                page: body.page,
                clientId: body.clientId,
                selection: body.selection,
                month: body.month,
              }),
              tools,
            },
            meta: { userId: user.id, clientId: body.clientId, feature: 'chat' },
            signal: request.signal,
            onText: (delta) => {
              assistantText += delta;
              send('delta', { text: delta });
            },
          });

          model = result.model;
          totalTokens += result.usage.totalTokens || 0;

          if (result.functionCalls.length === 0) break;

          const modelParts = result.parts.length > 0 ? result.parts : [{ text: result.text }];
          workingContents = [...workingContents, { role: 'model', parts: modelParts as any }];

          const toolParts: any[] = [];
          for (const call of result.functionCalls) {
            const name = call.name || '';
            send('tool', { name, status: 'running' });
            let toolResult: unknown;
            try {
              toolResult = await executeTool(name, (call.args || {}) as Record<string, any>, user, {
                conversationId,
              });
            } catch (toolError: any) {
              console.error(`[ai] tool ${name} failed`, toolError);
              toolResult = { error: toolError?.message || 'Tool execution error' };
            }

            const summary = toolSummary(name, toolResult);
            send('tool', {
              name,
              status: 'done',
              summary,
              ...(name === 'propose_changes' ? { result: toolResult } : {}),
            });
            toolLog.push({ name, status: 'done', summary });

            if (name === 'propose_changes') {
              const value = toolResult as any;
              if (Array.isArray(value?.actions) && value.actions.length > 0) {
                proposal = {
                  proposalId: value.proposalId,
                  status: value.status,
                  summary: value.summary,
                  actions: value.actions || [],
                  autoApplied: Boolean(value.autoApplied),
                  needsConfirmation: Boolean(value.needsConfirmation),
                  results: value.results || [],
                  undo: value.undo || [],
                };
                send('proposal', proposal);
              }
            }

            toolParts.push({
              functionResponse: {
                name,
                response: asToolResponse(toolResult),
                ...(call.id ? { id: call.id } : {}),
              },
            });
          }

          workingContents = [...workingContents, { role: 'user', parts: toolParts }];
        }

        if (!assistantText.trim()) {
          const proposalView = proposal as any;
          if (proposalView?.autoApplied) {
            assistantText = 'Changes applied. Review them below, and use Undo if you need to reverse them.';
          } else if (proposalView?.status === 'failed') {
            assistantText = 'I could not apply those changes. The details are below.';
          } else if (proposalView) {
            assistantText = 'I prepared the changes below. Review them and confirm what you want to apply.';
          } else {
            assistantText = 'I could not produce an answer from the available data. Try rephrasing the request.';
          }
          send('delta', { text: assistantText });
        }

        const { data: savedMessage, error: saveError } = await supabase
          .from('ai_messages')
          .insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: assistantText,
            tool_calls: {
              tools: toolLog,
              proposal,
              model,
              tokens: totalTokens,
            },
          })
          .select('id')
          .maybeSingle();
        if (saveError) console.error('[ai] could not save assistant message', saveError);

        if (totalTokens > 0) await addAiTokens(user.id, totalTokens);

        send('done', {
          conversationId,
          messageId: savedMessage?.id || null,
          usage: {
            ...usage,
            used: usage.used,
            remaining: Math.max(0, usage.remaining),
          },
        });
      } catch (streamError: any) {
        const isAbort = streamError?.code === 'aborted' || streamError?.name === 'AbortError';
        if (!isAbort) {
          console.error('[ai] chat route error', streamError);
          send('error', {
            message:
              streamError instanceof AiRuntimeError
                ? streamError.message
                : streamError?.message || 'The assistant failed. Please try again.',
          });
        }
      } finally {
        clearInterval(heartbeat);
        closed = true;
        try {
          controller.close();
        } catch {
          // Already closed by the client.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  });
}

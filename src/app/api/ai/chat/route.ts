import { NextRequest } from 'next/server';
import { enforceAuth } from '@/lib/permissions';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getGemini, geminiModel, DAILY_LIMIT } from '@/lib/ai/gemini';
import { systemPrompt } from '@/lib/ai/prompt';
import { executeTool, toolDeclarations } from '@/lib/ai/tools';
import { isAdmin } from '@/lib/permissions';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const { user, error } = await enforceAuth();
  if (error || !user) return error;

  const body = await request.json();
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) {
    return new Response(JSON.stringify({ error: 'message is required' }), { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: usage } = await supabase
    .from('ai_usage')
    .select('requests')
    .eq('user_id', user.id)
    .eq('day', today)
    .maybeSingle();
  if ((usage?.requests || 0) >= DAILY_LIMIT) {
    return new Response(JSON.stringify({ error: 'Daily AI limit reached' }), { status: 429 });
  }
  await supabase.from('ai_usage').upsert({
    user_id: user.id,
    day: today,
    requests: (usage?.requests || 0) + 1,
  });

  let conversationId: string = body.conversationId;
  if (!conversationId) {
    const { data: conv, error: convErr } = await supabase
      .from('ai_conversations')
      .insert({ user_id: user.id, title: message.slice(0, 80) })
      .select('id')
      .single();
    if (convErr) throw convErr;
    conversationId = conv.id;
  }

  await supabase.from('ai_messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: message,
  });

  const { data: history } = await supabase
    .from('ai_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(24);

  const contents: any[] = (history || []).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        send('meta', { conversationId });
        const ai = getGemini();
        const tools = [{ functionDeclarations: toolDeclarations(isAdmin(user)) }] as any;
        let assistantText = '';
        let loop = 0;
        let workingContents = contents;

        while (loop < 6) {
          loop += 1;
          const response = await ai.models.generateContent({
            model: geminiModel(),
            contents: workingContents,
            config: {
              systemInstruction: systemPrompt(user, {
                page: body.page,
                clientId: body.clientId,
                selection: body.selection,
              }),
              tools,
            },
          });

          const functionCalls = response.functionCalls || [];
          if (functionCalls.length === 0) {
            assistantText += response.text || '';
            send('text', { text: response.text || '' });
            break;
          }

          const modelContent = response.candidates?.[0]?.content;
          if (!modelContent) {
            if (response.text) {
              assistantText += response.text;
              send('text', { text: response.text });
            }
            break;
          }

          workingContents = [...workingContents, modelContent];
          const toolParts = [];
          for (const fc of functionCalls) {
            send('tool', { name: fc.name, status: 'running' });
            let result: unknown;
            try {
              result = await executeTool(fc.name || '', (fc.args || {}) as Record<string, any>, user);
            } catch (toolErr: any) {
              console.error(`Tool ${fc.name} execution error:`, toolErr);
              result = { error: toolErr?.message || 'Tool execution error' };
            }
            send('tool', { name: fc.name, status: 'done', result: fc.name === 'propose_changes' ? result : undefined });
            const responseObj =
              result && typeof result === 'object' && !Array.isArray(result)
                ? (result as Record<string, unknown>)
                : { result };

            toolParts.push({
              functionResponse: {
                name: fc.name,
                response: responseObj,
                ...(fc.id ? { id: fc.id } : {}),
              },
            });
          }
          workingContents = [...workingContents, { role: 'user', parts: toolParts }];
        }

        if (!assistantText.trim()) {
          assistantText = 'I have processed your request.';
          send('text', { text: assistantText });
        }

        await supabase.from('ai_messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: assistantText,
        });
        send('done', { conversationId });
      } catch (err: any) {
        console.error('AI chat route error:', err);
        send('error', { message: err?.message || 'AI failed' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { enforceAdmin } from '@/lib/permissions';
import { dismissSilentClientAlert, fetchSilentClientAlerts } from '@/lib/data';
import { isGapKey, mergeSilenceDismissals, parseSilenceDismissals, SILENCE_DISMISS_COOKIE } from '@/lib/postingSilence';
import { privateReadHeaders } from '@/lib/listValidation';

const dismissSchema = z.object({
  clientId: z.string().uuid(),
  gapKey: z.string().refine(isGapKey, 'Invalid gap'),
});

function withDismissalCookie(response: NextResponse, entry: string) {
  const next = mergeSilenceDismissals(parseSilenceDismissals(cookies().get(SILENCE_DISMISS_COOKIE)?.value), entry);
  response.cookies.set(SILENCE_DISMISS_COOKIE, JSON.stringify(next), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 120,
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}

export async function POST(request: NextRequest) {
  const { user, error } = await enforceAdmin();
  if (error || !user) return error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid alert' }, { status: 400, headers: privateReadHeaders });
  }

  const parsed = dismissSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid alert' }, { status: 400, headers: privateReadHeaders });
  }

  const { clientId, gapKey } = parsed.data;
  try {
    const openAlerts = await fetchSilentClientAlerts([]);
    const matches = openAlerts.some((alert) => alert.clientId === clientId && alert.gapKey === gapKey);
    if (!matches) {
      return NextResponse.json({ error: 'This alert is already closed' }, { status: 404, headers: privateReadHeaders });
    }

    const stored = await dismissSilentClientAlert(user.id, clientId, gapKey);
    return withDismissalCookie(
      NextResponse.json({ ok: true, stored }, { headers: privateReadHeaders }),
      `${clientId}:${gapKey}`
    );
  } catch (err) {
    console.error('[posting-silence] failed to close alert:', err);
    return NextResponse.json({ error: 'Failed to close alert' }, { status: 500, headers: privateReadHeaders });
  }
}

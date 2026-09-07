import { NextRequest, NextResponse } from 'next/server';
import { enforceAdmin } from '@/lib/permissions';
import { recordPayment } from '@/lib/finance';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await enforceAdmin();
  if (error || !user) return error;
  try {
    const body = await request.json();
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 });
    }
    const payment = await recordPayment({
      invoiceId: params.id,
      amount,
      paidAt: body.paidAt,
      method: body.method,
      reference: body.reference,
    });
    return NextResponse.json(payment, { status: 201 });
  } catch (err: any) {
    console.error('Error recording payment:', err);
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
  }
}

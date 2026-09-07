import { NextRequest, NextResponse } from 'next/server';
import { enforceAdmin } from '@/lib/permissions';
import { createInvoice, fetchInvoices } from '@/lib/finance';

export async function GET(request: NextRequest) {
  const { user, error } = await enforceAdmin();
  if (error || !user) return error;

  const status = request.nextUrl.searchParams.get('status') || undefined;
  const clientId = request.nextUrl.searchParams.get('clientId') || undefined;
  try {
    const invoices = await fetchInvoices({ status, clientId });
    return NextResponse.json(invoices);
  } catch (err: any) {
    console.error('Error fetching invoices:', err);
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await enforceAdmin();
  if (error || !user) return error;

  try {
    const body = await request.json();
    if (!body.clientId || typeof body.clientId !== 'string') {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }
    const subtotal = Number(body.subtotal);
    if (!Number.isFinite(subtotal) || subtotal < 0) {
      return NextResponse.json({ error: 'Valid subtotal is required' }, { status: 400 });
    }
    const invoice = await createInvoice({
      clientId: body.clientId,
      issueDate: body.issueDate,
      dueDate: body.dueDate,
      periodLabel: body.periodLabel,
      subtotal,
      vatRate: body.vatRate != null ? Number(body.vatRate) : undefined,
      notes: body.notes,
      createdBy: user.id,
      status: body.status === 'sent' ? 'sent' : 'draft',
    });
    return NextResponse.json(invoice, { status: 201 });
  } catch (err: any) {
    console.error('Error creating invoice:', err);
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
  }
}

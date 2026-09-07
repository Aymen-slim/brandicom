import { NextRequest, NextResponse } from 'next/server';
import { enforceAdmin } from '@/lib/permissions';
import { fetchInvoice, updateInvoice, deleteInvoice } from '@/lib/finance';
import { INVOICE_STATUSES } from '@/lib/constants';
import { InvoiceStatus } from '@/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await enforceAdmin();
  if (error || !user) return error;
  try {
    const detail = await fetchInvoice(params.id);
    if (!detail) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    return NextResponse.json(detail);
  } catch (err: any) {
    console.error('Error fetching invoice:', err);
    return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await enforceAdmin();
  if (error || !user) return error;
  try {
    const body = await request.json();
    const status = INVOICE_STATUSES.includes(body.status) ? (body.status as InvoiceStatus) : undefined;
    const updated = await updateInvoice(params.id, {
      issueDate: body.issueDate,
      dueDate: body.dueDate,
      periodLabel: body.periodLabel,
      subtotal: body.subtotal != null ? Number(body.subtotal) : undefined,
      vatRate: body.vatRate != null ? Number(body.vatRate) : undefined,
      notes: body.notes,
      status,
    });
    if (!updated) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err: any) {
    console.error('Error updating invoice:', err);
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await enforceAdmin();
  if (error || !user) return error;
  try {
    const success = await deleteInvoice(params.id);
    if (!success) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting invoice:', err);
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { enforceAdmin } from '@/lib/permissions';
import { createExpense, fetchExpenses, fetchExpensePage } from '@/lib/finance';
import { z } from 'zod';
import { parsePagination } from '@/lib/pagination';
import { expenseFiltersSchema, privateReadHeaders } from '@/lib/listValidation';
import { EXPENSE_CATEGORIES } from '@/lib/constants';
import { ExpenseCategory } from '@/types';

export async function GET(request: NextRequest) {
  const { user, error } = await enforceAdmin();
  if (error || !user) return error;
  const sp = request.nextUrl.searchParams;
  try {
    const filters = expenseFiltersSchema.parse({ category: sp.get('category') || undefined, clientId: sp.get('clientId') || undefined,
      from: sp.get('from') || undefined, to: sp.get('to') || undefined, search: sp.get('search') || undefined, type: sp.get('type') || undefined });
    const expenses = sp.has('page') || sp.has('pageSize')
      ? await fetchExpensePage({ ...filters, ...parsePagination({ page: sp.get('page') || undefined, pageSize: sp.get('pageSize') || undefined }) })
      : await fetchExpenses(filters);
    return NextResponse.json(expenses, { headers: privateReadHeaders });
  } catch (err: any) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Invalid expense parameters' }, { status: 400, headers: privateReadHeaders });
    console.error('Error fetching expenses:', err);
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await enforceAdmin();
  if (error || !user) return error;
  try {
    const body = await request.json();
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 });
    }
    if (!body.date || typeof body.date !== 'string') {
      return NextResponse.json({ error: 'date is required' }, { status: 400 });
    }
    const category: ExpenseCategory = EXPENSE_CATEGORIES.includes(body.category) ? body.category : 'other';
    const expense = await createExpense({
      date: body.date,
      amount,
      category,
      description: body.description,
      clientId: body.clientId,
      partnerId: body.partnerId,
      assignmentId: body.assignmentId,
      recurring: Boolean(body.recurring),
      recurrence: body.recurrence === 'yearly' ? 'yearly' : body.recurrence === 'monthly' ? 'monthly' : null,
      createdBy: user.id,
    });
    return NextResponse.json(expense, { status: 201 });
  } catch (err: any) {
    console.error('Error creating expense:', err);
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}

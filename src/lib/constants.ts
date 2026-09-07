import { ExpenseCategory, InvoiceStatus } from '@/types';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'partner_fee',
  'software',
  'ads',
  'equipment',
  'salary',
  'rent',
  'travel',
  'freelance',
  'other',
];

export const INVOICE_STATUSES: InvoiceStatus[] = [
  'draft',
  'sent',
  'paid',
  'partially_paid',
  'overdue',
  'cancelled',
];

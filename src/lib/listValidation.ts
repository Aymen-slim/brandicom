import { z } from 'zod';

export const privateReadHeaders = { 'Cache-Control': 'private, no-store' };
export const calendarRangeSchema = z.object({ from: z.string().date(), to: z.string().date() })
  .refine(({ from, to }) => from < to && Date.parse(to) - Date.parse(from) <= 370 * 86400000, 'Invalid calendar range');
export const clientFiltersSchema = z.object({
  status: z.enum(['all', 'active', 'starting', 'one_time', 'paused']).optional(),
  assignedTo: z.string().uuid().optional(), search: z.string().max(200).optional(),
});
export const invoiceFiltersSchema = z.object({
  status: z.enum(['draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled']).optional(),
  clientId: z.string().uuid().optional(),
});
export const expenseFiltersSchema = z.object({
  category: z.enum(['partner_fee', 'software', 'ads', 'equipment', 'salary', 'rent', 'travel', 'freelance', 'other']).optional(),
  clientId: z.string().uuid().optional(), search: z.string().max(200).optional(),
  type: z.enum(['all', 'one_time', 'regular']).optional(), from: z.string().date().optional(), to: z.string().date().optional(),
});

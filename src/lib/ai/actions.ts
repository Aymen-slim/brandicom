import { z } from 'zod';

export const CLIENT_STATUSES = ['active', 'starting', 'one_time', 'paused'] as const;
export const DELIVERABLE_STATUSES = ['idea', 'scripted', 'filmed', 'editing', 'scheduled', 'published'] as const;
export const DELIVERABLE_FORMATS = ['reel', 'photo', 'story', 'carousel', 'ad', 'photoshoot'] as const;
export const PLATFORMS = ['instagram', 'tiktok', 'facebook', 'youtube', 'both'] as const;

const FILMED_STATUSES = new Set(['filmed', 'editing', 'scheduled', 'published']);

/** Keep the filmed/published flags aligned with a deliverable's status. */
export function deliverableStatusFlags(status: string): { filmed: boolean; published: boolean } {
  return {
    filmed: FILMED_STATUSES.has(status),
    published: status === 'published',
  };
}

const optionalText = z.string().max(4000).optional().nullable();

export const UpdateClientFieldsSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  location: optionalText,
  status: z.enum(CLIENT_STATUSES).optional(),
  services: z.array(z.string().max(120)).optional().nullable(),
  notes: optionalText,
  industry: optionalText,
  website: optionalText,
  contactName: optionalText,
  contactEmail: optionalText,
  contactPhone: optionalText,
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  leadSource: optionalText,
  churnReason: optionalText,
  tags: z.array(z.string().max(120)).optional().nullable(),
  assetsUrl: optionalText,
  logoUrl: optionalText,
});

export const ActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('create_client'),
    name: z.string().min(1).max(200),
    location: optionalText,
    status: z.enum(CLIENT_STATUSES).optional().nullable(),
    services: z.union([z.array(z.string().max(120)), z.string().max(2000)]).optional().nullable(),
    notes: optionalText,
    industry: optionalText,
    website: optionalText,
    contactName: optionalText,
    contactEmail: optionalText,
    contactPhone: optionalText,
    startDate: z.string().optional().nullable(),
    leadSource: optionalText,
    tags: z.union([z.array(z.string().max(120)), z.string().max(2000)]).optional().nullable(),
    monthlyFee: z.coerce.number().nonnegative().optional().nullable(),
    contractType: z.string().max(80).optional().nullable(),
    assignedUserIds: z.array(z.string().uuid()).optional().nullable(),
  }),
  z.object({
    type: z.literal('create_deliverable'),
    clientId: z.string().uuid(),
    idea: z.string().min(1).max(400),
    format: z.enum(DELIVERABLE_FORMATS).optional().nullable(),
    platform: z.enum(PLATFORMS).optional().nullable(),
    status: z.enum(DELIVERABLE_STATUSES).optional().nullable(),
    filmingDate: z.string().optional().nullable(),
    publishDate: z.string().optional().nullable(),
  }),
  z.object({
    type: z.literal('update_deliverable_status'),
    deliverableId: z.string().uuid(),
    status: z.enum(DELIVERABLE_STATUSES),
  }),
  z.object({
    type: z.literal('update_client'),
    clientId: z.string().uuid(),
    fields: UpdateClientFieldsSchema,
    assignedUserIds: z.array(z.string().uuid()).optional().nullable(),
  }),
  z.object({
    type: z.literal('add_client_note'),
    clientId: z.string().uuid(),
    note: z.string().min(1).max(2000),
  }),
  z.object({
    type: z.literal('book_partner'),
    clientId: z.string().uuid(),
    partnerId: z.string().uuid(),
    scheduledDate: z.string().optional().nullable(),
    deliverableId: z.string().uuid().optional().nullable(),
  }),
  z.object({
    type: z.literal('upsert_goal'),
    periodType: z.enum(['month', 'year']),
    periodValue: z.string().min(4).max(20),
    metric: z.string().min(1).max(80),
    target: z.coerce.number().positive(),
  }),
  z.object({
    type: z.literal('create_expense'),
    date: z.string(),
    amount: z.coerce.number().positive(),
    category: z.string().max(80),
    description: z.string().max(1000).optional().nullable(),
    clientId: z.string().uuid().optional().nullable(),
  }),
  z.object({
    type: z.literal('create_invoice'),
    clientId: z.string().uuid(),
    subtotal: z.coerce.number().nonnegative(),
    periodLabel: z.string().max(80).optional().nullable(),
  }),
  z.object({
    type: z.literal('record_payment'),
    invoiceId: z.string().uuid(),
    amount: z.coerce.number().positive(),
  }),
  z.object({
    type: z.literal('update_contract'),
    clientId: z.string().uuid(),
    monthlyFee: z.coerce.number().nonnegative().optional().nullable(),
    contractType: z.string().max(80).optional().nullable(),
  }),
]);

export type AiAction = z.infer<typeof ActionSchema>;

export const ADMIN_ACTIONS = new Set([
  'create_expense',
  'create_invoice',
  'record_payment',
  'update_contract',
  'upsert_goal',
]);

/**
 * These actions are safe to apply immediately because they are reversible and
 * do not touch money, contracts, permissions or client identity.
 */
export const LOW_RISK_ACTIONS = new Set(['create_deliverable', 'update_deliverable_status']);

export function isLowRiskAction(type: string): boolean {
  return LOW_RISK_ACTIONS.has(type);
}

export const UndoActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('restore_deliverable_status'),
    deliverableId: z.string().uuid(),
    previousStatus: z.enum(DELIVERABLE_STATUSES),
    label: z.string().max(300).optional(),
  }),
  z.object({
    type: z.literal('delete_deliverable'),
    deliverableId: z.string().uuid(),
    label: z.string().max(300).optional(),
  }),
]);

export type UndoAction = z.infer<typeof UndoActionSchema>;

export interface ApplyResult {
  ok: boolean;
  type: string;
  id?: string;
  name?: string;
  error?: string;
  undo?: UndoAction;
  index?: number;
}

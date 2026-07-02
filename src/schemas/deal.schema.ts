// ─────────────────────────────────────────────────────────────
// Deal Zod Schemas – Garage Auto Supplies CRM
// ─────────────────────────────────────────────────────────────

import { z } from 'zod';

/** Schema for creating or editing a Deal */
export const dealFormSchema = z.object({
  leadId: z.string().min(1, 'Lead ID is required'),
  title: z
    .string()
    .min(1, 'Deal title is required')
    .max(200, 'Title is too long'),
  value: z.coerce
    .number()
    .min(0, 'Value must be non-negative')
    .max(10_000_000, 'Value exceeds maximum'),
  stage: z.enum(['new', 'quoted', 'negotiation', 'won', 'lost'], {
    message: 'Invalid deal stage',
  }),
  probability: z.coerce
    .number()
    .int('Probability must be a whole number')
    .min(0, 'Probability must be 0-100')
    .max(100, 'Probability must be 0-100'),
  expectedCloseDate: z.coerce.date().nullable().optional(),
  notes: z.string().max(10_000, 'Notes are too long').default(''),
  shopifyDraftOrderId: z.string().nullable().optional(),
  shopifyOrderId: z.string().nullable().optional(),
});

/** Full deal document schema (includes server-generated fields) */
export const dealSchema = dealFormSchema.extend({
  id: z.string().min(1),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type DealFormInput = z.input<typeof dealFormSchema>;
export type DealFormOutput = z.output<typeof dealFormSchema>;
export type DealInput = z.input<typeof dealSchema>;
export type DealOutput = z.output<typeof dealSchema>;

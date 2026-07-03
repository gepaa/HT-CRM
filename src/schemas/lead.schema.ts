// ─────────────────────────────────────────────────────────────
// Lead Zod Schemas – Garage Auto Supplies CRM
// ─────────────────────────────────────────────────────────────

import { z } from 'zod';
import { PRODUCT_CATEGORIES } from '../lib/constants';

// ── Lead Source ──────────────────────────────────────────────

export const leadSourceSchema = z.object({
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_term: z.string().optional(),
  utm_content: z.string().optional(),
  gclid: z.string().optional(),
  fbclid: z.string().optional(),
  landing_page: z.string().url().optional().or(z.literal('')),
  referrer: z.string().optional(),
});

// ── Form Data (inbound submission) ───────────────────────────

export const leadFormDataSchema = z
  .object({
    firstName: z
      .string()
      .min(1, 'First name is required')
      .max(100, 'First name is too long'),
    lastName: z
      .string()
      .min(1, 'Last name is required')
      .max(100, 'Last name is too long'),
    email: z
      .string()
      .email('Invalid email address')
      .max(254, 'Email is too long'),
    phone: z
      .string()
      .regex(/^\+?[\d\s\-().]{7,20}$/, 'Invalid phone number')
      .optional()
      .or(z.literal('')),
    company: z.string().max(200, 'Company name is too long').optional(),
    deliveryZip: z
      .string()
      .regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code')
      .optional()
      .or(z.literal('')),
    productCategory: z.enum(PRODUCT_CATEGORIES as unknown as [string, ...string[]], {
      message: 'Please select a product category',
    }),
    productTitle: z.string().max(500, 'Product title is too long').optional(),
    productPrice: z.coerce
      .number()
      .min(0, 'Product price cannot be negative')
      .optional(),
    quantity: z.coerce
      .number()
      .int('Quantity must be a whole number')
      .min(1, 'Quantity must be at least 1')
      .max(9999, 'Quantity seems too high'),
    targetBudget: z
      .string()
      .min(1, 'Budget is required')
      .max(50, 'Budget value is too long'),
    projectDetails: z
      .string()
      .max(5000, 'Project details are too long')
      .optional(),
    timeline: z.string().max(200, 'Timeline is too long').optional(),
    source: leadSourceSchema.default({}),
    formType: z.enum(['quote', 'contact', 'product_inquiry'], {
      message: 'Invalid form type',
    }),
    honeypot: z.string().optional(),
  })
  .refine((data) => !data.honeypot || data.honeypot.trim() === '', {
    message: 'Spam detected',
    path: ['honeypot'],
  });

export type LeadFormDataInput = z.input<typeof leadFormDataSchema>;
export type LeadFormDataOutput = z.output<typeof leadFormDataSchema>;

// ── Full Lead Document ───────────────────────────────────────

export const leadScoreBreakdownSchema = z.object({
  budgetScore: z.number().min(0).max(30),
  categoryScore: z.number().min(0).max(30),
  intentScore: z.number().min(0).max(25),
  engagementScore: z.number().min(0).max(15),
});

export const leadSchema = z.object({
  id: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  company: z.string().optional(),
  deliveryZip: z.string().optional(),
  productCategory: z.string().min(1),
  quantity: z.number().int().min(1),
  targetBudget: z.string().min(1),
  projectDetails: z.string().optional(),
  source: leadSourceSchema,
  score: z.number().min(0).max(100),
  scoreBreakdown: leadScoreBreakdownSchema,
  tier: z.enum(['hot', 'warm', 'cold']),
  stage: z.enum([
    'new',
    'contacted',
    'qualified',
    'quoted',
    'negotiation',
    'won',
    'lost',
  ]),
  assignedTo: z.string().nullable(),
  slaDeadline: z.coerce.date().nullable(),
  slaStatus: z.enum(['ok', 'warning', 'overdue']),
  contactedAt: z.coerce.date().nullable(),
  formType: z.enum(['quote', 'contact', 'product_inquiry']),
  shopifyCustomerId: z.string().nullable(),
  shopifyCustomerGid: z.string().nullable().optional(),
  shopifyDraftOrderId: z.string().nullable().optional(),
  shopifyDraftOrderIds: z.array(z.string()).optional(),
  shopifyOrderId: z.string().nullable().optional(),
  shopifyOrderIds: z.array(z.string()).optional(),
  shopifyShopDomain: z.string().nullable().optional(),
  aiSummary: z.string().nullable(),
  aiNextAction: z.string().nullable(),
  tags: z.array(z.string()),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type LeadInput = z.input<typeof leadSchema>;
export type LeadOutput = z.output<typeof leadSchema>;

import { z } from 'zod';

const PRODUCT_CATEGORIES = [
  'Car Lifts', '2-Post Lifts', '4-Post Lifts', 'Scissor Lifts',
  'Tire Changers', 'Wheel Balancers', 'Pressure Washers', 'Mini Excavators',
  'Wood Chippers', 'Stump Grinders', 'Garage Storage', 'Generators',
  'Workbenches', 'Air Compressors', 'Sheet Metal Brakes', 'Sawmills',
  'Other Heavy Equipment',
] as const;

export const leadSourceSchema = z.object({
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_term: z.string().optional(),
  utm_content: z.string().optional(),
  gclid: z.string().optional(),
  fbclid: z.string().optional(),
  landing_page: z.string().optional(),
  referrer: z.string().optional(),
}).strict();

export const leadFormDataSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Invalid email address').max(255),
  phone: z.string().max(20).optional(),
  company: z.string().max(200).optional(),
  deliveryZip: z.string().max(10).optional(),
  productCategory: z.enum(PRODUCT_CATEGORIES, {
    message: 'Invalid product category',
  }),
  productTitle: z.string().max(500).optional(),
  productPrice: z.number().min(0).optional(),
  quantity: z.number().int().min(1).default(1),
  targetBudget: z.string().min(1, 'Budget is required').max(100),
  timeline: z.string().max(200).optional(),
  projectDetails: z.string().max(5000).optional(),
  source: leadSourceSchema.optional().default({}),
  formType: z.enum(['quote', 'contact', 'product_inquiry']),
  assignedTo: z.string().nullable().optional(),
  honeypot: z.string().optional(),
}).refine(
  (data) => !data.honeypot || data.honeypot === '',
  { message: 'Invalid submission' }
);

export type ValidatedLeadFormData = z.infer<typeof leadFormDataSchema>;

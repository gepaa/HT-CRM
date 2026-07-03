// ─────────────────────────────────────────────────────────────
// Constants – Garage Auto Supplies CRM
// ─────────────────────────────────────────────────────────────

import type { BusinessHours, SLAConfig } from '../types/settings';
import type { LeadStage, LeadTier } from '../types/lead';
import type { DealStage } from '../types/deal';

// ── Product Catalogue ────────────────────────────────────────

export const PRODUCT_CATEGORIES = [
  'Car Lifts',
  '2-Post Lifts',
  '4-Post Lifts',
  'Scissor Lifts',
  'Tire Changers',
  'Wheel Balancers',
  'Pressure Washers',
  'Mini Excavators',
  'Wood Chippers',
  'Stump Grinders',
  'Garage Storage',
  'Generators',
  'Workbenches',
  'Air Compressors',
  'Sheet Metal Brakes',
  'Sawmills',
  'Other Heavy Equipment',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/**
 * Category tier determines the categoryScore band.
 * Tier 1 = highest-value product lines, Tier 4 = lowest.
 */
export const CATEGORY_TIERS: Record<string, number> = {
  'Car Lifts': 1,
  '2-Post Lifts': 1,
  '4-Post Lifts': 1,
  'Mini Excavators': 1,
  'Sawmills': 1,
  'Scissor Lifts': 2,
  'Tire Changers': 2,
  'Wheel Balancers': 2,
  'Wood Chippers': 2,
  'Stump Grinders': 2,
  'Pressure Washers': 3,
  'Generators': 3,
  'Air Compressors': 3,
  'Sheet Metal Brakes': 3,
  'Garage Storage': 4,
  'Workbenches': 4,
  'Other Heavy Equipment': 4,
};

// ── Pipeline Stages ──────────────────────────────────────────

export const LEAD_STAGES: LeadStage[] = [
  'new',
  'contacted',
  'qualified',
  'quoted',
  'negotiation',
  'won',
  'lost',
];

export const DEAL_STAGES: DealStage[] = [
  'new',
  'quoted',
  'negotiation',
  'won',
  'lost',
];

export const STAGE_LABELS: Record<LeadStage, string> = {
  new: 'New Lead',
  contacted: 'Contacted',
  qualified: 'Qualified',
  quoted: 'Quoted',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

// ── Tier Configuration ───────────────────────────────────────

export interface TierConfig {
  minScore: number;
  slaMinutes: number;
  color: string;
  bgColor: string;
  label: string;
}

export const TIER_CONFIG: Record<LeadTier, TierConfig> = {
  hot: {
    minScore: 75,
    slaMinutes: 30,
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    label: 'Hot',
  },
  qualified: {
    minScore: 50,
    slaMinutes: 480,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    label: 'Qualified',
  },
  warm: {
    minScore: 30,
    slaMinutes: 1440,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    label: 'Warm',
  },
  cold: {
    minScore: 15,
    slaMinutes: 2880,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    label: 'Cold',
  },
  bad_fit: {
    minScore: 0,
    slaMinutes: 10080,
    color: 'text-surface-400',
    bgColor: 'bg-surface-700/20',
    label: 'Bad Fit',
  },
};

// ── Default Business Hours ───────────────────────────────────

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  timezone: 'America/New_York',
  schedule: [
    { day: 'Monday', start: '09:00', end: '18:00', enabled: true },
    { day: 'Tuesday', start: '09:00', end: '18:00', enabled: true },
    { day: 'Wednesday', start: '09:00', end: '18:00', enabled: true },
    { day: 'Thursday', start: '09:00', end: '18:00', enabled: true },
    { day: 'Friday', start: '09:00', end: '18:00', enabled: true },
    { day: 'Saturday', start: '09:00', end: '18:00', enabled: false },
    { day: 'Sunday', start: '09:00', end: '18:00', enabled: false },
  ],
};

// ── Default SLA Targets ──────────────────────────────────────

export const DEFAULT_SLA_CONFIG: SLAConfig = {
  hotLeadMinutes: 30,
  warmLeadMinutes: 1440,
  coldLeadMinutes: 480,
};

// ── Default Scoring Weights ──────────────────────────────────

export const DEFAULT_SCORING_WEIGHTS = {
  budget: 30,
  category: 30,
  intent: 25,
  engagement: 15,
} as const;

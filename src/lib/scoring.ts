// ─────────────────────────────────────────────────────────────
// Lead Scoring Engine – Garage Auto Supplies CRM
// ─────────────────────────────────────────────────────────────

import type { LeadFormData, LeadScoreBreakdown, LeadTier } from '../types/lead';
import { CATEGORY_TIERS } from './constants';

/**
 * Parse a free-text budget string into a numeric dollar value.
 * Handles formats like "$10,000", "10000", "10k", "$5k-$10k".
 */
function parseBudget(raw: string): number | null {
  if (!raw || raw.trim() === '') return null;

  const cleaned = raw
    .replace(/[$,]/g, '')
    .trim()
    .toLowerCase();

  // Handle range – take midpoint: "5000-10000" or "5k-10k"
  if (cleaned.includes('-')) {
    const parts = cleaned.split('-').map((p) => parseSingleBudget(p.trim()));
    const valid = parts.filter((p): p is number => p !== null);
    if (valid.length === 2) return (valid[0] + valid[1]) / 2;
    if (valid.length === 1) return valid[0];
    return null;
  }

  return parseSingleBudget(cleaned);
}

function parseSingleBudget(value: string): number | null {
  // "10k" → 10000
  const kMatch = value.match(/^(\d+(?:\.\d+)?)\s*k$/);
  if (kMatch) return parseFloat(kMatch[1]) * 1000;

  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

// ── Individual Score Components ──────────────────────────────

/**
 * Budget score (0-30):
 *  $10k+     → 28-30
 *  $5k-9999  → 22-27
 *  $2k-4999  → 15-21
 *  $1k-1999  → 8-14
 *  <$1k      → 3-7
 *  unparseable → 10
 */
function calculateBudgetScore(targetBudget: string): number {
  const budget = parseBudget(targetBudget);

  if (budget === null) return 10;

  if (budget >= 10_000) return Math.min(30, 28 + Math.floor((budget - 10_000) / 5_000));
  if (budget >= 5_000) return 22 + Math.round(((budget - 5_000) / 5_000) * 5);
  if (budget >= 2_000) return 15 + Math.round(((budget - 2_000) / 3_000) * 6);
  if (budget >= 1_000) return 8 + Math.round(((budget - 1_000) / 1_000) * 6);
  return Math.max(3, 3 + Math.round((budget / 1_000) * 4));
}

/**
 * Category score (0-30):
 *  Tier 1 → 27-30
 *  Tier 2 → 20-26
 *  Tier 3 → 12-19
 *  Tier 4 → 5-11
 */
function calculateCategoryScore(productCategory: string): number {
  const tier = CATEGORY_TIERS[productCategory] ?? 4;

  switch (tier) {
    case 1:
      return 27 + Math.floor(Math.random() * 4); // 27-30
    case 2:
      return 20 + Math.floor(Math.random() * 7); // 20-26
    case 3:
      return 12 + Math.floor(Math.random() * 8); // 12-19
    case 4:
    default:
      return 5 + Math.floor(Math.random() * 7); // 5-11
  }
}

/**
 * Intent score (0-25):
 *  quote → 20, contact → 12, product_inquiry → 8
 *  +3 if quantity > 1
 *  +2 if projectDetails > 50 chars
 */
function calculateIntentScore(
  formType: string,
  quantity: number,
  projectDetails?: string,
): number {
  let base: number;

  switch (formType) {
    case 'quote':
      base = 20;
      break;
    case 'contact':
      base = 12;
      break;
    case 'product_inquiry':
    default:
      base = 8;
      break;
  }

  if (quantity > 1) base += 3;
  if (projectDetails && projectDetails.length > 50) base += 2;

  return Math.min(25, base);
}

/**
 * Engagement score (0-15):
 *  google cpc → 10, +3 for gclid
 *  google organic → 6
 *  facebook +2 for fbclid
 *  other source → 4
 *  direct → 2
 */
function calculateEngagementScore(source: LeadFormData['source']): number {
  let score = 0;
  const utmSource = (source.utm_source ?? '').toLowerCase();
  const utmMedium = (source.utm_medium ?? '').toLowerCase();

  // Google CPC (paid search)
  if (utmSource === 'google' && utmMedium === 'cpc') {
    score = 10;
  } else if (utmSource === 'google') {
    // Google organic
    score = 6;
  } else if (utmSource) {
    // Other known source
    score = 4;
  } else {
    // Direct traffic
    score = 2;
  }

  // Click-ID bonuses
  if (source.gclid) score += 3;
  if (source.fbclid) score += 2;

  return Math.min(15, score);
}

// ── Public API ───────────────────────────────────────────────

export interface ScoringResult {
  score: number;
  scoreBreakdown: LeadScoreBreakdown;
  tier: LeadTier;
}

/**
 * Score a lead from its form data and return the composite score,
 * per-dimension breakdown, and derived temperature tier.
 */
export function scoreLead(data: LeadFormData): ScoringResult {
  const budgetScore = calculateBudgetScore(data.targetBudget);
  const categoryScore = calculateCategoryScore(data.productCategory);
  const intentScore = calculateIntentScore(
    data.formType,
    data.quantity,
    data.projectDetails,
  );
  const engagementScore = calculateEngagementScore(data.source);

  const scoreBreakdown: LeadScoreBreakdown = {
    budgetScore,
    categoryScore,
    intentScore,
    engagementScore,
  };

  // Total capped at 100
  const score = Math.min(
    100,
    budgetScore + categoryScore + intentScore + engagementScore,
  );

  // Derive tier
  let tier: LeadTier;
  if (score >= 70) {
    tier = 'hot';
  } else if (score >= 40) {
    tier = 'warm';
  } else {
    tier = 'cold';
  }

  return { score, scoreBreakdown, tier };
}

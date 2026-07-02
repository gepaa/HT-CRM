// ─────────────────────────────────────────────────────────────
// Lead Compatibility Mapper – Garage Auto Supplies CRM
// ─────────────────────────────────────────────────────────────
import type { Timestamp } from 'firebase/firestore';
import type { Lead, LeadStage, LeadTier, SLAStatus } from '../types/lead';

/**
 * Converts Firestore Timestamp or string/number or Date into a native Date object.
 */
function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'object' && 'toDate' in val && typeof (val as Timestamp).toDate === 'function') {
    return (val as Timestamp).toDate();
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Normalizes any lead data object (from Firestore or seed/mock data) into a compliant
 * Lead object that satisfies both existing frontend properties and CRM schema requirements.
 */
export function normalizeLead(raw: Record<string, any>, docId: string): Lead {
  const id = docId || raw.id || 'unknown';
  const createdAt = toDate(raw.createdAt) ?? new Date();
  const updatedAt = toDate(raw.updatedAt) ?? new Date();
  
  const contactedAt = toDate(raw.contactedAt) ?? toDate(raw.lastContactedAt);
  const slaDeadline = toDate(raw.slaDeadline) ?? toDate(raw.slaDeadlineAt);
  const nextFollowUpAt = toDate(raw.nextFollowUpAt);

  const productCategory = raw.productCategory || raw.category || 'General Equipment';
  const category = raw.category || productCategory;

  const score = typeof raw.score === 'number' ? raw.score : (typeof raw.leadScore === 'number' ? raw.leadScore : 50);
  const leadScore = score;

  const stage: LeadStage = raw.stage || raw.status || 'new';
  const status = raw.status || stage;

  const tier: LeadTier = raw.tier || (score >= 70 ? 'hot' : score >= 40 ? 'warm' : 'cold');

  const isOverdue = typeof raw.isOverdue === 'boolean'
    ? raw.isOverdue
    : (raw.slaStatus === 'overdue' || (slaDeadline !== null && slaDeadline < new Date() && stage !== 'won' && stage !== 'lost'));

  const slaStatus: SLAStatus = raw.slaStatus || (isOverdue ? 'overdue' : 'ok');

  const quantity = typeof raw.quantity === 'number' ? raw.quantity : 1;
  const productTitle = raw.productTitle || `${quantity}x ${productCategory}`;

  const numericBudget = raw.targetBudget
    ? parseInt(String(raw.targetBudget).replace(/[^\d]/g, ''), 10) || 5000
    : 5000;

  const productPrice = raw.productPrice || numericBudget;
  const estimatedDealValue = typeof raw.estimatedDealValue === 'number'
    ? raw.estimatedDealValue
    : (typeof productPrice === 'number' ? productPrice : numericBudget);

  const wonRevenue = typeof raw.wonRevenue === 'number'
    ? raw.wonRevenue
    : (stage === 'won' ? estimatedDealValue : null);

  const lostReason = raw.lostReason || (stage === 'lost' ? 'Price too high / Went with competitor' : null);

  const timeline = raw.timeline || 'Immediate / Within 30 days';

  const scoreReasons: string[] = Array.isArray(raw.scoreReasons)
    ? raw.scoreReasons
    : (raw.scoreBreakdown
        ? [
            `Budget: ${raw.scoreBreakdown.budgetScore} pts`,
            `Category: ${raw.scoreBreakdown.categoryScore} pts`,
            `Intent: ${raw.scoreBreakdown.intentScore} pts`,
            `Engagement: ${raw.scoreBreakdown.engagementScore} pts`
          ]
        : ['Commercial buyer intent']);

  const source = raw.source || {};
  const firstTouchAttribution = raw.firstTouchAttribution || source.utm_source || 'direct';
  const lastTouchAttribution = raw.lastTouchAttribution || source.utm_campaign || 'direct';
  const gclid = raw.gclid || source.gclid || undefined;

  return {
    ...raw,
    id,
    firstName: raw.firstName || 'Unknown',
    lastName: raw.lastName || 'Lead',
    email: raw.email || 'noemail@garageautosupplies.com',
    phone: raw.phone || undefined,
    company: raw.company || undefined,
    deliveryZip: raw.deliveryZip || undefined,
    productCategory,
    category,
    quantity,
    targetBudget: raw.targetBudget || '$5,000',
    projectDetails: raw.projectDetails || undefined,
    source,
    score,
    leadScore,
    scoreBreakdown: raw.scoreBreakdown || {
      budgetScore: Math.round(score * 0.35),
      categoryScore: Math.round(score * 0.30),
      intentScore: Math.round(score * 0.20),
      engagementScore: Math.round(score * 0.15),
    },
    tier,
    stage,
    status,
    assignedTo: raw.assignedTo ?? null,
    slaDeadline,
    slaDeadlineAt: slaDeadline,
    slaStatus,
    isOverdue,
    contactedAt,
    lastContactedAt: contactedAt,
    nextFollowUpAt,
    formType: raw.formType || 'quote',
    shopifyCustomerId: raw.shopifyCustomerId ?? null,
    aiSummary: raw.aiSummary ?? `${tier.toUpperCase()} lead interested in ${quantity}x ${productCategory}.`,
    aiNextAction: raw.aiNextAction ?? 'Follow up via phone or email.',
    tags: Array.isArray(raw.tags) ? raw.tags : [productCategory.toLowerCase().replace(/\s+/g, '-'), tier],
    createdAt,
    updatedAt,
    productTitle,
    productPrice,
    timeline,
    scoreReasons,
    firstTouchAttribution,
    lastTouchAttribution,
    gclid,
    estimatedDealValue,
    wonRevenue,
    lostReason,
  };
}

/**
 * Prepares a Lead object for writing back to Firestore.
 */
export function toFirestoreLead(lead: Partial<Lead>): Record<string, any> {
  const data = { ...lead };
  delete data.id;
  return data;
}

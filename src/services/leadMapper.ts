// ─────────────────────────────────────────────────────────────
// Lead Compatibility Mapper – Garage Auto Supplies CRM (Supabase)
// ─────────────────────────────────────────────────────────────
import type { Lead, LeadStage, LeadTier, SLAStatus } from '../types/lead';

/**
 * Converts string/number or Date into a native Date object.
 */
function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Normalizes lead data objects from Supabase PostgreSQL (snake_case)
 * into a compliant Lead object that satisfies existing frontend properties.
 */
export function normalizeLead(raw: Record<string, any>, docId: string): Lead {
  const id = docId || raw.id || 'unknown';
  const createdAt = toDate(raw.created_at || raw.createdAt) ?? new Date();
  const updatedAt = toDate(raw.updated_at || raw.updatedAt) ?? new Date();
  
  const contactedAt = toDate(raw.contacted_at || raw.contactedAt || raw.last_contacted_at || raw.lastContactedAt);
  const slaDeadline = toDate(raw.sla_deadline || raw.slaDeadline || raw.sla_deadline_at || raw.slaDeadlineAt);
  const nextFollowUpAt = toDate(raw.next_follow_up_at || raw.nextFollowUpAt);

  const productCategory = raw.product_category || raw.productCategory || raw.category || 'General Equipment';
  const category = raw.category || productCategory;

  const score = typeof raw.score === 'number' ? raw.score : (typeof raw.lead_score === 'number' ? raw.lead_score : (typeof raw.leadScore === 'number' ? raw.leadScore : 50));
  const leadScore = score;

  const stage: LeadStage = raw.stage || raw.status || 'new';
  const status = raw.status || stage;

  const tier: LeadTier = raw.tier || (score >= 70 ? 'hot' : score >= 40 ? 'warm' : 'cold');

  const isOverdue = typeof raw.is_overdue === 'boolean'
    ? raw.is_overdue
    : (typeof raw.isOverdue === 'boolean' ? raw.isOverdue : (raw.sla_status === 'overdue' || raw.slaStatus === 'overdue' || (slaDeadline !== null && slaDeadline < new Date() && stage !== 'won' && stage !== 'lost')));

  const slaStatus: SLAStatus = raw.sla_status || raw.slaStatus || (isOverdue ? 'overdue' : 'ok');

  const quantity = typeof raw.quantity === 'number' ? raw.quantity : 1;
  const productTitle = raw.product_title || raw.productTitle || `${quantity}x ${productCategory}`;

  const targetBudget = raw.target_budget || raw.targetBudget || '$5,000';
  const numericBudget = targetBudget
    ? parseInt(String(targetBudget).replace(/[^\d]/g, ''), 10) || 5000
    : 5000;

  const productPrice = raw.product_price ?? (raw.productPrice ?? numericBudget);
  const estimatedDealValue = typeof raw.estimated_deal_value === 'number'
    ? raw.estimated_deal_value
    : (typeof raw.estimatedDealValue === 'number' ? raw.estimatedDealValue : (typeof productPrice === 'number' ? productPrice : numericBudget));

  const wonRevenue = typeof raw.won_revenue === 'number'
    ? raw.won_revenue
    : (typeof raw.wonRevenue === 'number' ? raw.wonRevenue : (stage === 'won' ? estimatedDealValue : null));

  const lostReason = raw.lost_reason || raw.lostReason || (stage === 'lost' ? 'Price too high / Went with competitor' : null);

  const timeline = raw.timeline || 'Immediate / Within 30 days';

  const scoreBreakdown = raw.score_breakdown || raw.scoreBreakdown || {
    budgetScore: Math.round(score * 0.35),
    categoryScore: Math.round(score * 0.30),
    intentScore: Math.round(score * 0.20),
    engagementScore: Math.round(score * 0.15),
  };

  const scoreReasons: string[] = Array.isArray(raw.score_reasons || raw.scoreReasons)
    ? (raw.score_reasons || raw.scoreReasons)
    : [
        `Budget: ${scoreBreakdown.budgetScore || 0} pts`,
        `Category: ${scoreBreakdown.categoryScore || 0} pts`,
        `Intent: ${scoreBreakdown.intentScore || 0} pts`,
        `Engagement: ${scoreBreakdown.engagementScore || 0} pts`
      ];

  const source = raw.source || {};
  const firstTouchAttribution = raw.first_touch_attribution || raw.firstTouchAttribution || source.utm_source || 'direct';
  const lastTouchAttribution = raw.last_touch_attribution || raw.lastTouchAttribution || source.utm_campaign || 'direct';
  const gclid = raw.gclid || source.gclid || undefined;

  return {
    ...raw,
    id,
    firstName: raw.first_name || raw.firstName || 'Unknown',
    lastName: raw.last_name || raw.lastName || 'Lead',
    email: raw.email || 'noemail@garageautosupplies.com',
    phone: raw.phone || undefined,
    company: raw.company || undefined,
    deliveryZip: raw.delivery_zip || raw.deliveryZip || undefined,
    productCategory,
    category,
    quantity,
    targetBudget,
    projectDetails: raw.project_details || raw.projectDetails || undefined,
    source,
    score,
    leadScore,
    scoreBreakdown,
    tier,
    stage,
    status,
    assignedTo: raw.assigned_to ?? (raw.assignedTo ?? null),
    slaDeadline,
    slaDeadlineAt: slaDeadline,
    slaStatus,
    isOverdue,
    contactedAt,
    lastContactedAt: contactedAt,
    nextFollowUpAt,
    formType: raw.form_type || raw.formType || 'quote',
    shopifyCustomerId: raw.shopify_customer_id ?? (raw.shopifyCustomerId ?? null),
    shopifyCustomerGid: raw.shopify_customer_gid ?? (raw.shopifyCustomerGid ?? null),
    shopifyDraftOrderId: raw.shopify_draft_order_id ?? (raw.shopifyDraftOrderId ?? null),
    shopifyDraftOrderIds: Array.isArray(raw.shopify_draft_order_ids || raw.shopifyDraftOrderIds) ? (raw.shopify_draft_order_ids || raw.shopifyDraftOrderIds) : [],
    shopifyOrderId: raw.shopify_order_id ?? (raw.shopifyOrderId ?? null),
    shopifyOrderIds: Array.isArray(raw.shopify_order_ids || raw.shopifyOrderIds) ? (raw.shopify_order_ids || raw.shopifyOrderIds) : [],
    shopifyShopDomain: raw.shopify_shop_domain ?? (raw.shopifyShopDomain ?? null),
    aiSummary: raw.ai_summary ?? (raw.aiSummary ?? `${tier.toUpperCase()} lead interested in ${quantity}x ${productCategory}.`),
    aiNextAction: raw.ai_next_action ?? (raw.aiNextAction ?? 'Follow up via phone or email.'),
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
 * Prepares a Lead object for writing back to Supabase PostgreSQL (snake_case).
 */
export function toSupabaseLead(lead: Partial<Lead>): Record<string, any> {
  const data: Record<string, any> = {};
  
  if (lead.id !== undefined) data.id = lead.id;
  if (lead.firstName !== undefined) data.first_name = lead.firstName;
  if (lead.lastName !== undefined) data.last_name = lead.lastName;
  if (lead.email !== undefined) data.email = lead.email;
  if (lead.phone !== undefined) data.phone = lead.phone;
  if (lead.company !== undefined) data.company = lead.company;
  if (lead.deliveryZip !== undefined) data.delivery_zip = lead.deliveryZip;
  if (lead.productCategory !== undefined) data.product_category = lead.productCategory;
  if (lead.productTitle !== undefined) data.product_title = lead.productTitle;
  if (lead.quantity !== undefined) data.quantity = lead.quantity;
  if (lead.targetBudget !== undefined) data.target_budget = lead.targetBudget;
  if (lead.productPrice !== undefined) data.product_price = lead.productPrice;
  if (lead.estimatedDealValue !== undefined) data.estimated_deal_value = lead.estimatedDealValue;
  if (lead.projectDetails !== undefined) data.project_details = lead.projectDetails;
  if (lead.source !== undefined) data.source = lead.source;
  if (lead.score !== undefined) data.score = lead.score;
  if (lead.leadScore !== undefined) data.lead_score = lead.leadScore;
  if (lead.scoreBreakdown !== undefined) data.score_breakdown = lead.scoreBreakdown;
  if (lead.tier !== undefined) data.tier = lead.tier;
  if (lead.stage !== undefined) data.stage = lead.stage;
  if (lead.status !== undefined) data.status = lead.status;
  if (lead.assignedTo !== undefined) data.assigned_to = lead.assignedTo;
  if (lead.slaDeadline !== undefined) data.sla_deadline = lead.slaDeadline;
  if (lead.slaDeadlineAt !== undefined) data.sla_deadline_at = lead.slaDeadlineAt;
  if (lead.slaStatus !== undefined) data.sla_status = lead.slaStatus;
  if (lead.isOverdue !== undefined) data.is_overdue = lead.isOverdue;
  if (lead.contactedAt !== undefined) data.contacted_at = lead.contactedAt;
  if (lead.lastContactedAt !== undefined) data.last_contacted_at = lead.lastContactedAt;
  if (lead.formType !== undefined) data.form_type = lead.formType;
  if (lead.shopifyCustomerId !== undefined) data.shopify_customer_id = lead.shopifyCustomerId;
  if (lead.aiSummary !== undefined) data.ai_summary = lead.aiSummary;
  if (lead.aiNextAction !== undefined) data.ai_next_action = lead.aiNextAction;
  if (lead.tags !== undefined) data.tags = lead.tags;
  if (lead.timeline !== undefined) data.timeline = lead.timeline;

  return data;
}

// Backward compatibility alias
export const toFirestoreLead = toSupabaseLead;

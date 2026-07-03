// ─────────────────────────────────────────────────────────────
// Lead Types – Garage Auto Supplies CRM
// ─────────────────────────────────────────────────────────────

/** UTM / paid-traffic attribution fields captured at form submission */
export interface LeadSource {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  gclid?: string;
  fbclid?: string;
  landing_page?: string;
  referrer?: string;
}

/** Granular breakdown of the composite lead score (0-100) */
export interface LeadScoreBreakdown {
  budgetScore: number;
  categoryScore: number;
  intentScore: number;
  engagementScore: number;
}

/** Temperature tier derived from total score */
export type LeadTier = 'hot' | 'qualified' | 'warm' | 'cold' | 'bad_fit';

/** Pipeline stage a lead can occupy */
export type LeadStage =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'quoted'
  | 'negotiation'
  | 'won'
  | 'lost';

/** SLA health indicator */
export type SLAStatus = 'ok' | 'warning' | 'overdue';

/** Inbound form variant */
export type FormType = 'quote' | 'contact' | 'product_inquiry';

/** Full Lead document stored in Firestore */
export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  deliveryZip?: string;
  productCategory: string;
  quantity: number;
  targetBudget: string;
  projectDetails?: string;
  source: LeadSource;
  score: number;
  scoreBreakdown: LeadScoreBreakdown;
  tier: LeadTier;
  stage: LeadStage;
  assignedTo: string | null;
  slaDeadline: Date | null;
  slaStatus: SLAStatus;
  contactedAt: Date | null;
  formType: FormType;
  shopifyCustomerId: string | null;
  shopifyCustomerGid?: string | null;
  shopifyDraftOrderId?: string | null;
  shopifyDraftOrderIds?: string[];
  shopifyOrderId?: string | null;
  shopifyOrderIds?: string[];
  shopifyShopDomain?: string | null;
  aiSummary: string | null;
  aiNextAction: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;

  // Compatibility / CRM Schema fields
  category?: string;
  productTitle?: string;
  productPrice?: number | string;
  timeline?: string;
  leadScore?: number;
  status?: string;
  scoreReasons?: string[];
  firstTouchAttribution?: string | Record<string, any>;
  lastTouchAttribution?: string | Record<string, any>;
  gclid?: string;
  lastContactedAt?: Date | null;
  nextFollowUpAt?: Date | null;
  slaDeadlineAt?: Date | null;
  isOverdue?: boolean;
  estimatedDealValue?: number;
  wonRevenue?: number | null;
  lostReason?: string | null;
}

/** Subset of Lead data that arrives from inbound forms */
export interface LeadFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  deliveryZip?: string;
  productCategory: string;
  productTitle?: string;
  productPrice?: number;
  quantity: number;
  targetBudget: string;
  timeline?: string;
  projectDetails?: string;
  source: LeadSource;
  formType: FormType;
  /** Hidden honeypot field – should always be empty for real submissions */
  honeypot?: string;
}

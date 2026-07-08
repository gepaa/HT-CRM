// Lead types shared between frontend and functions
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

export interface LeadScoreBreakdown {
  budgetScore: number;
  categoryScore: number;
  intentScore: number;
  engagementScore: number;
}

export type LeadTier = 'hot' | 'qualified' | 'warm' | 'cold' | 'bad_fit';
export type LeadStage = 'new' | 'contacted' | 'qualified' | 'quoted' | 'negotiation' | 'won' | 'lost';
export type SLAStatus = 'ok' | 'warning' | 'overdue';
export type FormType = 'quote' | 'contact' | 'product_inquiry';

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
  assignedTo?: string | null;
  honeypot?: string;
}

export interface ShopifyLeadIds {
  shopifyCustomerId?: string | null;
  shopifyCustomerGid?: string | null;
  shopifyDraftOrderId?: string | null;
  shopifyDraftOrderIds?: string[];
  shopifyOrderId?: string | null;
  shopifyOrderIds?: string[];
  shopifyShopDomain?: string | null;
}

// ─────────────────────────────────────────────────────────────
// Deal Types – Garage Auto Supplies CRM
// ─────────────────────────────────────────────────────────────

/** Pipeline stage for a deal / opportunity */
export type DealStage = 'new' | 'quoted' | 'negotiation' | 'won' | 'lost';

/** Deal / opportunity linked to a Lead */
export interface Deal {
  id: string;
  leadId: string;
  title: string;
  value: number;
  stage: DealStage;
  /** Win-probability percentage (0-100) */
  probability: number;
  expectedCloseDate: Date | null;
  notes: string;
  shopifyDraftOrderId: string | null;
  shopifyOrderId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

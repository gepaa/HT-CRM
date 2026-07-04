// ─────────────────────────────────────────────────────────────
// Deal Service – Garage Auto Supplies CRM (Supabase)
// ─────────────────────────────────────────────────────────────
import { supabase } from '../config/supabase';
import type { Deal, DealStage } from '../types/crm';

const DEALS_TABLE = 'deals';

const STAGE_PROBABILITY: Record<string, number> = {
  new: 10,
  qualification: 10,
  proposal: 30,
  quoted: 30,
  negotiation: 50,
  contract: 75,
  won: 100,
  closed_won: 100,
  lost: 0,
  closed_lost: 0,
};

function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function normalizeDeal(raw: Record<string, any>, docId: string): Deal {
  const id = docId || raw.id || 'unknown';
  const createdAt = toDate(raw.created_at || raw.createdAt) ?? new Date();
  const updatedAt = toDate(raw.updated_at || raw.updatedAt) ?? new Date();
  const expectedCloseDate = toDate(raw.expected_close_date || raw.expectedCloseDate);

  const stage = raw.stage || 'qualification';
  const probability = typeof raw.probability === 'number' ? raw.probability : (STAGE_PROBABILITY[stage] ?? 10);

  return {
    ...raw,
    id,
    title: raw.title || 'Untitled Deal',
    leadId: raw.lead_id || raw.leadId || '',
    contactName: raw.contact_name || raw.contactName || '',
    value: typeof raw.value === 'number' ? raw.value : (Number(raw.value) || 0),
    stage,
    probability,
    assignedTo: raw.assigned_to || raw.assignedTo || 'Unassigned',
    expectedCloseDate,
    notes: raw.notes || '',
    createdAt,
    updatedAt,
  } as Deal;
}

function toSupabaseDeal(deal: Partial<Deal> & Record<string, any>): Record<string, any> {
  const data: Record<string, any> = {};
  if (deal.id !== undefined) data.id = deal.id;
  if (deal.title !== undefined) data.title = deal.title;
  if (deal.leadId !== undefined) data.lead_id = deal.leadId;
  if (deal.contactName !== undefined) data.contact_name = deal.contactName;
  if (deal.value !== undefined) data.value = deal.value;
  if (deal.stage !== undefined) data.stage = deal.stage;
  if (deal.probability !== undefined) data.probability = deal.probability;
  if (deal.assignedTo !== undefined) data.assigned_to = deal.assignedTo;
  if (deal.expectedCloseDate !== undefined) {
    data.expected_close_date = deal.expectedCloseDate instanceof Date ? deal.expectedCloseDate.toISOString() : deal.expectedCloseDate;
  }
  if (deal.notes !== undefined) data.notes = deal.notes;
  return data;
}

export const dealService = {
  /**
   * Subscribe to all deals in real time.
   */
  subscribeDeals(
    onData: (deals: Deal[]) => void,
    onError?: (error: any) => void
  ): () => void {
    const fetchAndNotify = async () => {
      try {
        const { data, error } = await supabase
          .from(DEALS_TABLE)
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        const docs = (data || []).map((d) => normalizeDeal(d, d.id));
        onData(docs);
      } catch (err: any) {
        if (onError) onError(err);
      }
    };

    fetchAndNotify();

    const channel = supabase
      .channel(`table-deals-all-${Math.random().toString(36).substring(2, 9)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: DEALS_TABLE },
        () => {
          fetchAndNotify();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * Create a new deal.
   */
  async createDeal(data: {
    title: string;
    leadId: string;
    contactName: string;
    value: number;
    stage?: DealStage;
    expectedCloseDate?: Date | null;
    notes?: string;
    assignedTo?: string;
  }): Promise<string> {
    const stage = data.stage ?? 'qualification';
    const probability = STAGE_PROBABILITY[stage] ?? 10;
    const id = `deal-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const now = new Date().toISOString();

    const row = toSupabaseDeal({
      id,
      ...data,
      stage,
      probability,
      assignedTo: data.assignedTo || 'system',
      expectedCloseDate: data.expectedCloseDate ?? null,
    } as any);

    row.created_at = now;
    row.updated_at = now;

    const { error } = await supabase.from(DEALS_TABLE).insert(row);
    if (error) {
      console.error('Failed to create deal:', error);
      throw error;
    }
    return id;
  },

  /**
   * Safe updater for deals.
   */
  async safeUpdate(dealId: string, updates: Record<string, any>): Promise<void> {
    const row = toSupabaseDeal(updates as any);
    row.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from(DEALS_TABLE)
      .update(row)
      .eq('id', dealId);

    if (error) {
      console.error(`safeUpdate deal ${dealId} failed:`, error);
      throw error;
    }
  },

  /**
   * Update deal stage.
   */
  async updateDealStage(dealId: string, newStage: DealStage): Promise<void> {
    const probability = STAGE_PROBABILITY[newStage] ?? 10;
    await this.safeUpdate(dealId, {
      stage: newStage,
      probability,
    });
  },

  /**
   * Update deal fields.
   */
  async updateDeal(dealId: string, data: Partial<Deal>): Promise<void> {
    await this.safeUpdate(dealId, data);
  },
};

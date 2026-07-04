// ─────────────────────────────────────────────────────────────
// Lead Service – Garage Auto Supplies CRM (Supabase)
// ─────────────────────────────────────────────────────────────
import { supabase, getApiRouteUrl } from '../config/supabase';
import type { Lead, LeadFormData, LeadStage } from '../types/lead';
import { normalizeLead, toSupabaseLead } from './leadMapper';

const LEADS_TABLE = 'leads';
const EVENTS_TABLE = 'lead_events';

export type CreateLeadInput = LeadFormData & {
  assignedTo?: string | null;
};

interface CreateLeadResponse {
  success?: boolean;
  id?: string;
  score?: number;
  tier?: string;
  error?: string;
  details?: Array<{ field: string; message: string }>;
}

function cleanOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toLeadCapturePayload(data: CreateLeadInput): CreateLeadInput {
  return {
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),
    email: data.email.trim().toLowerCase(),
    phone: cleanOptional(data.phone),
    company: cleanOptional(data.company),
    deliveryZip: cleanOptional(data.deliveryZip),
    productCategory: data.productCategory,
    productTitle: cleanOptional(data.productTitle),
    productPrice: typeof data.productPrice === 'number' && Number.isFinite(data.productPrice)
      ? data.productPrice
      : undefined,
    quantity: Number(data.quantity) || 1,
    targetBudget: data.targetBudget.trim(),
    timeline: cleanOptional(data.timeline),
    projectDetails: cleanOptional(data.projectDetails),
    source: data.source || { utm_source: 'manual' },
    formType: data.formType || 'quote',
    honeypot: data.honeypot || '',
    assignedTo: data.assignedTo ?? null,
  };
}

export const leadService = {
  /**
   * Subscribe to all leads in real time, ordered by createdAt descending.
   */
  subscribeLeads(
    onData: (leads: Lead[]) => void,
    onError?: (error: any) => void
  ): () => void {
    const fetchAndNotify = async () => {
      try {
        const { data, error } = await supabase
          .from(LEADS_TABLE)
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        const docs = (data || []).map((row) => normalizeLead(row, row.id));
        onData(docs);
      } catch (err: any) {
        if (onError) onError(err);
      }
    };

    fetchAndNotify();

    const channel = supabase
      .channel(`table-leads-all-${Math.random().toString(36).substring(2, 9)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: LEADS_TABLE },
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
   * Subscribe to a single lead by ID in real time.
   */
  subscribeLead(
    leadId: string,
    onData: (lead: Lead | null) => void,
    onError?: (error: any) => void
  ): () => void {
    if (!leadId) {
      onData(null);
      return () => {};
    }

    const fetchAndNotify = async () => {
      try {
        const { data, error } = await supabase
          .from(LEADS_TABLE)
          .select('*')
          .eq('id', leadId)
          .single();

        if (error || !data) {
          onData(null);
        } else {
          onData(normalizeLead(data, data.id));
        }
      } catch (err: any) {
        if (onError) onError(err);
      }
    };

    fetchAndNotify();

    const channel = supabase
      .channel(`table-leads-single-${leadId}-${Math.random().toString(36).substring(2, 9)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: LEADS_TABLE, filter: `id=eq.${leadId}` },
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
   * Create a new lead. Attempts API route first, then falls back to direct Supabase PostgreSQL insert.
   */
  async createLead(data: CreateLeadInput): Promise<string> {
    const payload = toLeadCapturePayload(data);
    try {
      const response = await fetch(getApiRouteUrl('/leads/create'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let body: CreateLeadResponse | null = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }

      if (response.ok && body?.success && body.id) {
        return body.id;
      }

      if (response.status === 400 && body?.error) {
        const validation = body?.details?.map((detail) => `${detail.field}: ${detail.message}`).join(', ');
        throw new Error(validation || body?.error || 'Validation failed');
      }
    } catch (apiError: any) {
      if (apiError.message && (apiError.message.includes('Validation') || apiError.message.includes('validation'))) {
        throw apiError;
      }
      console.warn('API /leads/create unavailable or failed, falling back to direct Supabase write:', apiError);
    }

    // Direct Supabase PostgreSQL fallback
    const leadId = `lead-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const now = new Date().toISOString();

    const leadRow = toSupabaseLead({
      id: leadId,
      ...payload,
      stage: 'new',
      status: 'new',
      score: 50,
      leadScore: 50,
      tier: 'warm',
      scoreBreakdown: { budgetScore: 15, categoryScore: 15, intentScore: 10, engagementScore: 10 },
      scoreReasons: ['Direct capture fallback (default warm scoring)'],
      slaStatus: 'ok',
      contactedAt: null,
      lastContactedAt: null,
      isOverdue: false,
      aiSummary: `Lead interested in ${payload.quantity}x ${payload.productCategory}.`,
      aiNextAction: 'Follow up via phone or email.',
      tags: [payload.productCategory.toLowerCase().replace(/\s+/g, '-'), 'warm', 'manual-fallback'],
    } as any);

    leadRow.created_at = now;
    leadRow.updated_at = now;

    const { error: insertErr } = await supabase.from(LEADS_TABLE).insert(leadRow);
    if (insertErr) {
      console.error('Failed to insert lead into Supabase:', insertErr);
      throw insertErr;
    }

    try {
      await supabase.from(EVENTS_TABLE).insert({
        id: `ev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        lead_id: leadId,
        type: 'created',
        description: `New ${payload.formType} lead from ${payload.firstName} ${payload.lastName} (direct fallback)`,
        metadata: { formType: payload.formType, productCategory: payload.productCategory },
        created_at: now,
      });
    } catch (e) {
      console.warn('Failed to create event in fallback:', e);
    }

    return leadId;
  },

  /**
   * Update an existing lead document in PostgreSQL.
   */
  async safeUpdate(leadId: string, updates: Record<string, any>): Promise<void> {
    const mappedUpdates = toSupabaseLead(updates as Partial<Lead>);
    mappedUpdates.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from(LEADS_TABLE)
      .update(mappedUpdates)
      .eq('id', leadId);

    if (error) {
      console.error(`safeUpdate failed for lead ${leadId}:`, error);
      throw error;
    }
  },

  /**
   * Update lead stage and log stage change event.
   */
  async updateLeadStage(leadId: string, newStage: LeadStage, oldStage?: string): Promise<void> {
    await this.safeUpdate(leadId, {
      stage: newStage,
      status: newStage,
    });

    try {
      await supabase.from(EVENTS_TABLE).insert({
        id: `ev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        lead_id: leadId,
        type: 'stage_changed',
        description: `Stage changed to "${newStage.toUpperCase()}"`,
        metadata: { from: oldStage || 'previous', to: newStage },
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Failed to log stage change event:', e);
    }
  },

  /**
   * Mark lead as contacted.
   */
  async markLeadContacted(leadId: string): Promise<void> {
    const now = new Date();
    await this.safeUpdate(leadId, {
      contactedAt: now,
      lastContactedAt: now,
      slaStatus: 'ok',
      isOverdue: false,
      stage: 'contacted',
      status: 'contacted',
    });

    try {
      await supabase.from(EVENTS_TABLE).insert({
        id: `ev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        lead_id: leadId,
        type: 'call_logged',
        description: 'Lead marked as contacted',
        metadata: { contactedAt: now.toISOString() },
        created_at: now.toISOString(),
      });
    } catch (e) {
      console.warn('Failed to log contacted event:', e);
    }
  },

  /**
   * Mark quote sent.
   */
  async markQuoteSent(leadId: string): Promise<void> {
    await this.safeUpdate(leadId, {
      stage: 'quoted',
      status: 'quoted',
    });

    try {
      await supabase.from(EVENTS_TABLE).insert({
        id: `ev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        lead_id: leadId,
        type: 'email_sent',
        description: 'Formal quote sent to customer',
        metadata: { stage: 'quoted' },
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Failed to log quote sent event:', e);
    }
  },

  /**
   * Mark lead won.
   */
  async markLeadWon(leadId: string, wonRevenue?: number): Promise<void> {
    const updates: Record<string, any> = {
      stage: 'won',
      status: 'won',
    };
    if (typeof wonRevenue === 'number') {
      updates.wonRevenue = wonRevenue;
    }
    await this.safeUpdate(leadId, updates);

    try {
      await supabase.from(EVENTS_TABLE).insert({
        id: `ev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        lead_id: leadId,
        type: 'stage_changed',
        description: `Lead closed WON! Revenue: ${wonRevenue ?? 'Standard'}`,
        metadata: { stage: 'won', wonRevenue },
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Failed to log won event:', e);
    }

    // Trigger Google Ads offline conversion upload asynchronously
    try {
      fetch(getApiRouteUrl('/google/uploadConversion'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, wonRevenue }),
      }).catch((err) => {
        console.warn('Asynchronous Google Ads conversion upload trigger failed:', err);
      });
    } catch (e) {
      console.warn('Failed to dispatch Google Ads conversion upload:', e);
    }
  },

  /**
   * Mark lead lost.
   */
  async markLeadLost(leadId: string, lostReason?: string): Promise<void> {
    const updates: Record<string, any> = {
      stage: 'lost',
      status: 'lost',
    };
    if (lostReason) {
      updates.lostReason = lostReason;
    }
    await this.safeUpdate(leadId, updates);

    try {
      await supabase.from(EVENTS_TABLE).insert({
        id: `ev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        lead_id: leadId,
        type: 'stage_changed',
        description: `Lead closed LOST. Reason: ${lostReason || 'Not specified'}`,
        metadata: { stage: 'lost', lostReason },
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Failed to log lost event:', e);
    }
  },

  /**
   * Update AI generated summary and next action in Supabase.
   */
  async updateLeadAI(leadId: string, aiSummary: string, aiNextAction: string): Promise<void> {
    await this.safeUpdate(leadId, {
      aiSummary,
      aiNextAction,
    });
  },
};

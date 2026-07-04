// ─────────────────────────────────────────────────────────────
// Event Service – Garage Auto Supplies CRM (Supabase)
// ─────────────────────────────────────────────────────────────
import { supabase } from '../config/supabase';
import type { LeadEvent } from '../types/crm';

const EVENTS_TABLE = 'lead_events';

function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function normalizeEvent(raw: Record<string, any>, docId: string, leadId: string): LeadEvent {
  return {
    ...raw,
    id: docId || raw.id || 'unknown',
    leadId: raw.lead_id || raw.leadId || leadId,
    type: raw.type || 'note_added',
    description: raw.description || '',
    metadata: raw.metadata || {},
    createdBy: raw.created_by || raw.createdBy || 'system',
    createdAt: toDate(raw.created_at || raw.createdAt) ?? new Date(),
  } as LeadEvent;
}

export const eventService = {
  /**
   * Subscribe to timeline events for a specific lead in real time.
   */
  subscribeLeadEvents(
    leadId: string,
    onData: (events: LeadEvent[]) => void,
    onError?: (error: any) => void
  ): () => void {
    if (!leadId) {
      onData([]);
      return () => {};
    }

    const fetchAndNotify = async () => {
      try {
        const { data, error } = await supabase
          .from(EVENTS_TABLE)
          .select('*')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        const docs = (data || []).map((d) => normalizeEvent(d, d.id, leadId));
        onData(docs);
      } catch (err: any) {
        if (onError) onError(err);
      }
    };

    fetchAndNotify();

    const channel = supabase
      .channel(`table-events-lead-${leadId}-${Math.random().toString(36).substring(2, 9)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: EVENTS_TABLE, filter: `lead_id=eq.${leadId}` },
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
   * Add a timeline event to a lead.
   */
  async addLeadEvent(
    leadId: string,
    type: LeadEvent['type'],
    description: string,
    metadata?: Record<string, unknown>,
    user?: { uid?: string; id?: string }
  ): Promise<string> {
    const createdBy = user?.id || user?.uid || 'user';
    const id = `ev-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const row = {
      id,
      lead_id: leadId,
      type,
      description,
      metadata: metadata ?? {},
      created_by: createdBy,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from(EVENTS_TABLE).insert(row);
    if (error) {
      console.error('Failed to add event:', error);
      throw error;
    }
    return id;
  },
};

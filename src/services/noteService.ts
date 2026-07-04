// ─────────────────────────────────────────────────────────────
// Note Service – Garage Auto Supplies CRM (Supabase)
// ─────────────────────────────────────────────────────────────
import { supabase } from '../config/supabase';
import type { LeadNote } from '../types/crm';

const NOTES_TABLE = 'lead_notes';
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

function normalizeNote(raw: Record<string, any>, docId: string, leadId: string): LeadNote {
  const authorId = raw.created_by || raw.createdBy || raw.author_id || raw.authorId || 'user';
  const authorName = raw.created_by_name || raw.createdByName || raw.author_name || raw.authorName || 'Sales Rep';

  return {
    ...raw,
    id: docId || raw.id || 'unknown',
    leadId: raw.lead_id || raw.leadId || leadId,
    content: raw.content || '',
    createdBy: authorId,
    createdByName: authorName,
    createdAt: toDate(raw.created_at || raw.createdAt) ?? new Date(),
    updatedAt: toDate(raw.updated_at || raw.updatedAt) ?? new Date(),
  } as LeadNote;
}

export const noteService = {
  /**
   * Subscribe to notes for a specific lead in real time.
   */
  subscribeLeadNotes(
    leadId: string,
    onData: (notes: LeadNote[]) => void,
    onError?: (error: any) => void
  ): () => void {
    if (!leadId) {
      onData([]);
      return () => {};
    }

    const fetchAndNotify = async () => {
      try {
        const { data, error } = await supabase
          .from(NOTES_TABLE)
          .select('*')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        const docs = (data || []).map((d) => normalizeNote(d, d.id, leadId));
        onData(docs);
      } catch (err: any) {
        if (onError) onError(err);
      }
    };

    fetchAndNotify();

    const channel = supabase
      .channel(`table-notes-lead-${leadId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: NOTES_TABLE, filter: `lead_id=eq.${leadId}` },
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
   * Add a note to a lead and record a note_added timeline event.
   */
  async addLeadNote(
    leadId: string,
    content: string,
    user?: { uid?: string; id?: string; displayName?: string; email?: string | null; user_metadata?: any }
  ): Promise<string> {
    const createdBy = user?.id || user?.uid || 'user';
    const createdByName = user?.displayName || user?.user_metadata?.display_name || user?.email || 'Sales Rep';
    const id = `note-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const now = new Date().toISOString();

    const row = {
      id,
      lead_id: leadId,
      author_id: createdBy,
      author_name: createdByName,
      created_by: createdBy,
      created_by_name: createdByName,
      content,
      created_at: now,
      updated_at: now,
    };

    const { error } = await supabase.from(NOTES_TABLE).insert(row);
    if (error) {
      console.error('Failed to add note:', error);
      throw error;
    }

    try {
      await supabase.from(EVENTS_TABLE).insert({
        id: `ev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        lead_id: leadId,
        type: 'note_added',
        description: `Note added by ${createdByName}`,
        metadata: { createdBy, createdByName },
        created_at: now,
      });
    } catch (e) {
      console.warn('Failed to record note_added event:', e);
    }

    return id;
  },
};

// ─────────────────────────────────────────────────────────────
// Event Service – Garage Auto Supplies CRM
// ─────────────────────────────────────────────────────────────
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  type Unsubscribe,
  type FirestoreError,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { LeadEvent } from '../types/crm';
import { SEED_EVENTS } from '../lib/seedData';

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

function normalizeEvent(raw: Record<string, any>, docId: string, leadId: string): LeadEvent {
  return {
    ...raw,
    id: docId || raw.id || 'unknown',
    leadId: raw.leadId || leadId,
    type: raw.type || 'note_added',
    description: raw.description || '',
    metadata: raw.metadata || {},
    createdBy: raw.createdBy || 'system',
    createdAt: toDate(raw.createdAt) ?? new Date(),
  } as LeadEvent;
}

export const eventService = {
  /**
   * Subscribe to timeline events for a specific lead in real time.
   */
  subscribeLeadEvents(
    leadId: string,
    onData: (events: LeadEvent[]) => void,
    onError?: (error: FirestoreError) => void
  ): Unsubscribe {
    if (!leadId) {
      onData([]);
      return () => {};
    }

    const q = query(
      collection(db, 'leads', leadId, 'events'),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        let docs = snapshot.docs.map((d) => normalizeEvent(d.data(), d.id, leadId));
        if (docs.length === 0 && SEED_EVENTS[leadId]) {
          docs = SEED_EVENTS[leadId].map((e) => normalizeEvent(e, e.id, leadId));
        }
        onData(docs);
      },
      (err) => {
        console.warn(`eventService.subscribeLeadEvents(${leadId}) error, fallback to seed:`, err);
        const docs = (SEED_EVENTS[leadId] || []).map((e) => normalizeEvent(e, e.id, leadId));
        onData(docs);
        if (onError) onError(err);
      }
    );
  },

  /**
   * Add a timeline event to a lead.
   */
  async addLeadEvent(
    leadId: string,
    type: LeadEvent['type'],
    description: string,
    metadata?: Record<string, unknown>,
    user?: { uid: string }
  ): Promise<string> {
    const createdBy = user?.uid || 'user';
    const docRef = await addDoc(collection(db, 'leads', leadId, 'events'), {
      leadId,
      type,
      description,
      metadata: metadata ?? null,
      createdBy,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },
};

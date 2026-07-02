// ─────────────────────────────────────────────────────────────
// Note Service – Garage Auto Supplies CRM
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
import type { LeadNote } from '../types/crm';
import { SEED_NOTES } from '../lib/seedData';

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

function normalizeNote(raw: Record<string, any>, docId: string, leadId: string): LeadNote {
  return {
    ...raw,
    id: docId || raw.id || 'unknown',
    leadId: raw.leadId || leadId,
    content: raw.content || '',
    createdBy: raw.createdBy || 'user',
    createdByName: raw.createdByName || 'Sales Rep',
    createdAt: toDate(raw.createdAt) ?? new Date(),
    updatedAt: toDate(raw.updatedAt) ?? new Date(),
  } as LeadNote;
}

export const noteService = {
  /**
   * Subscribe to notes for a specific lead in real time.
   */
  subscribeLeadNotes(
    leadId: string,
    onData: (notes: LeadNote[]) => void,
    onError?: (error: FirestoreError) => void
  ): Unsubscribe {
    if (!leadId) {
      onData([]);
      return () => {};
    }

    const q = query(
      collection(db, 'leads', leadId, 'notes'),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        let docs = snapshot.docs.map((d) => normalizeNote(d.data(), d.id, leadId));
        if (docs.length === 0 && SEED_NOTES[leadId]) {
          docs = SEED_NOTES[leadId].map((n) => normalizeNote(n, n.id, leadId));
        }
        onData(docs);
      },
      (err) => {
        console.warn(`noteService.subscribeLeadNotes(${leadId}) error, fallback to seed:`, err);
        const docs = (SEED_NOTES[leadId] || []).map((n) => normalizeNote(n, n.id, leadId));
        onData(docs);
        if (onError) onError(err);
      }
    );
  },

  /**
   * Add a note to a lead and record a note_added timeline event.
   */
  async addLeadNote(
    leadId: string,
    content: string,
    user?: { uid: string; displayName?: string; email?: string | null }
  ): Promise<string> {
    const createdBy = user?.uid || 'user';
    const createdByName = user?.displayName || user?.email || 'Sales Rep';

    const docRef = await addDoc(collection(db, 'leads', leadId, 'notes'), {
      leadId,
      content,
      createdBy,
      createdByName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    try {
      await addDoc(collection(db, 'leads', leadId, 'events'), {
        leadId,
        type: 'note_added',
        description: `Note added by ${createdByName}`,
        createdBy,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Failed to record note_added event:', e);
    }

    return docRef.id;
  },
};

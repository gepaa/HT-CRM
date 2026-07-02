// ─────────────────────────────────────────────────────────────
// Deal Service – Garage Auto Supplies CRM
// ─────────────────────────────────────────────────────────────
import {
  collection,
  doc,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  setDoc,
  serverTimestamp,
  type Unsubscribe,
  type FirestoreError,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Deal, DealStage } from '../types/crm';
import { SEED_DEALS } from '../lib/seedData';

const DEALS_COLLECTION = 'deals';

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
  if (typeof val === 'object' && 'toDate' in val && typeof (val as Timestamp).toDate === 'function') {
    return (val as Timestamp).toDate();
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function normalizeDeal(raw: Record<string, any>, docId: string): Deal {
  const id = docId || raw.id || 'unknown';
  const createdAt = toDate(raw.createdAt) ?? new Date();
  const updatedAt = toDate(raw.updatedAt) ?? new Date();
  const expectedCloseDate = toDate(raw.expectedCloseDate);

  const stage = raw.stage || 'qualification';
  const probability = typeof raw.probability === 'number' ? raw.probability : (STAGE_PROBABILITY[stage] ?? 10);

  return {
    ...raw,
    id,
    title: raw.title || 'Untitled Deal',
    leadId: raw.leadId || '',
    contactName: raw.contactName || '',
    value: typeof raw.value === 'number' ? raw.value : 0,
    stage,
    probability,
    assignedTo: raw.assignedTo || 'Unassigned',
    expectedCloseDate,
    notes: raw.notes || '',
    createdAt,
    updatedAt,
  } as Deal;
}

export const dealService = {
  /**
   * Subscribe to all deals in real time.
   */
  subscribeDeals(
    onData: (deals: Deal[]) => void,
    onError?: (error: FirestoreError) => void
  ): Unsubscribe {
    const q = query(collection(db, DEALS_COLLECTION), orderBy('createdAt', 'desc'));

    return onSnapshot(
      q,
      (snapshot) => {
        let docs = snapshot.docs.map((d) => normalizeDeal(d.data(), d.id));
        if (docs.length === 0) {
          docs = SEED_DEALS.map((d) => normalizeDeal(d, d.id));
        }
        onData(docs);
      },
      (err) => {
        console.warn('dealService.subscribeDeals error, fallback to seed:', err);
        const docs = SEED_DEALS.map((d) => normalizeDeal(d, d.id));
        onData(docs);
        if (onError) onError(err);
      }
    );
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
    const docRef = await addDoc(collection(db, DEALS_COLLECTION), {
      ...data,
      stage,
      probability,
      assignedTo: data.assignedTo || 'system',
      expectedCloseDate: data.expectedCloseDate ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  },

  /**
   * Safe updater for deals.
   */
  async safeUpdate(dealId: string, updates: Record<string, any>): Promise<void> {
    const docRef = doc(db, DEALS_COLLECTION, dealId);
    try {
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (err: any) {
      if (err.code === 'not-found' || err.message?.includes('No document to update')) {
        const seed = SEED_DEALS.find((d) => d.id === dealId);
        if (seed) {
          await setDoc(docRef, {
            ...seed,
            ...updates,
            updatedAt: serverTimestamp(),
          });
          return;
        }
      }
      throw err;
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

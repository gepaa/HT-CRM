// ─────────────────────────────────────────────────────────────
// Lead Service – Garage Auto Supplies CRM
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
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Lead, LeadStage } from '../types/lead';
import { SEED_LEADS } from '../lib/seedData';
import { normalizeLead } from './leadMapper';

const LEADS_COLLECTION = 'leads';

export const leadService = {
  /**
   * Subscribe to all leads in real time, ordered by createdAt descending.
   * Falls back to seed data if Firestore returns empty or errors.
   */
  subscribeLeads(
    onData: (leads: Lead[]) => void,
    onError?: (error: FirestoreError) => void
  ): Unsubscribe {
    const q = query(collection(db, LEADS_COLLECTION), orderBy('createdAt', 'desc'));

    return onSnapshot(
      q,
      (snapshot) => {
        let docs = snapshot.docs.map((docSnap) =>
          normalizeLead(docSnap.data(), docSnap.id)
        );

        if (docs.length === 0) {
          docs = SEED_LEADS.map((l) => normalizeLead(l, l.id));
        }

        onData(docs);
      },
      (err) => {
        console.warn('leadService.subscribeLeads error, falling back to seed data:', err);
        const seedDocs = SEED_LEADS.map((l) => normalizeLead(l, l.id));
        onData(seedDocs);
        if (onError) onError(err);
      }
    );
  },

  /**
   * Subscribe to a single lead by ID in real time.
   */
  subscribeLead(
    leadId: string,
    onData: (lead: Lead | null) => void,
    onError?: (error: FirestoreError) => void
  ): Unsubscribe {
    if (!leadId) {
      onData(null);
      return () => {};
    }

    const docRef = doc(db, LEADS_COLLECTION, leadId);

    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          onData(normalizeLead(snapshot.data(), snapshot.id));
        } else {
          const seed = SEED_LEADS.find((l) => l.id === leadId);
          onData(seed ? normalizeLead(seed, seed.id) : null);
        }
      },
      (err) => {
        console.warn(`leadService.subscribeLead(${leadId}) error, fallback to seed:`, err);
        const seed = SEED_LEADS.find((l) => l.id === leadId);
        onData(seed ? normalizeLead(seed, seed.id) : null);
        if (onError) onError(err);
      }
    );
  },

  /**
   * Create a new lead document in Firestore.
   */
  async createLead(data: Partial<Lead> & {
    firstName: string;
    lastName: string;
    email: string;
    productCategory: string;
    targetBudget: string;
    quantity?: number;
  }): Promise<string> {
    const stage: LeadStage = data.stage || 'new';
    const quantity = data.quantity || 1;
    const score = data.score ?? 50;
    const tier = data.tier || (score >= 70 ? 'hot' : score >= 40 ? 'warm' : 'cold');

    const newLeadData = {
      ...data,
      stage,
      status: stage,
      quantity,
      score,
      leadScore: score,
      tier,
      productTitle: data.productTitle || `${quantity}x ${data.productCategory}`,
      category: data.category || data.productCategory,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      contactedAt: null,
      lastContactedAt: null,
      slaStatus: 'ok',
      isOverdue: false,
    };

    const docRef = await addDoc(collection(db, LEADS_COLLECTION), newLeadData);

    // Also record timeline event
    try {
      await addDoc(collection(docRef, 'events'), {
        type: 'created',
        description: `Lead created for ${data.firstName} ${data.lastName}`,
        metadata: { category: data.productCategory, quantity },
        createdBy: 'system',
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Failed to record lead creation event:', e);
    }

    return docRef.id;
  },

  /**
   * Safe doc updater that promotes a seed lead to Firestore if it doesn't exist yet.
   */
  async safeUpdate(leadId: string, updates: Record<string, any>): Promise<void> {
    const docRef = doc(db, LEADS_COLLECTION, leadId);
    try {
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (err: any) {
      if (err.code === 'not-found' || err.message?.includes('No document to update')) {
        const seed = SEED_LEADS.find((l) => l.id === leadId);
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
   * Update lead stage and log stage change event.
   */
  async updateLeadStage(leadId: string, newStage: LeadStage, oldStage?: string): Promise<void> {
    await this.safeUpdate(leadId, {
      stage: newStage,
      status: newStage,
    });

    try {
      await addDoc(collection(db, LEADS_COLLECTION, leadId, 'events'), {
        type: 'stage_changed',
        description: `Stage changed to "${newStage.toUpperCase()}"`,
        metadata: { from: oldStage || 'previous', to: newStage },
        createdBy: 'user',
        createdAt: serverTimestamp(),
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
      await addDoc(collection(db, LEADS_COLLECTION, leadId, 'events'), {
        type: 'call_logged',
        description: 'Lead marked as contacted',
        metadata: { contactedAt: now.toISOString() },
        createdBy: 'user',
        createdAt: serverTimestamp(),
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
      await addDoc(collection(db, LEADS_COLLECTION, leadId, 'events'), {
        type: 'email_sent',
        description: 'Formal quote sent to customer',
        metadata: { stage: 'quoted' },
        createdBy: 'user',
        createdAt: serverTimestamp(),
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
      await addDoc(collection(db, LEADS_COLLECTION, leadId, 'events'), {
        type: 'stage_changed',
        description: `Lead closed WON! Revenue: ${wonRevenue ?? 'Standard'}`,
        metadata: { stage: 'won', wonRevenue },
        createdBy: 'user',
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Failed to log won event:', e);
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
      await addDoc(collection(db, LEADS_COLLECTION, leadId, 'events'), {
        type: 'stage_changed',
        description: `Lead closed LOST. Reason: ${lostReason || 'Not specified'}`,
        metadata: { stage: 'lost', lostReason },
        createdBy: 'user',
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Failed to log lost event:', e);
    }
  },
};

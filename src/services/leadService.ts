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
  serverTimestamp,
  type Unsubscribe,
  type FirestoreError,
} from 'firebase/firestore';
import { db, getApiRouteUrl } from '../config/firebase';
import type { Lead, LeadFormData, LeadStage } from '../types/lead';
import { normalizeLead } from './leadMapper';

const LEADS_COLLECTION = 'leads';

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
    onError?: (error: FirestoreError) => void
  ): Unsubscribe {
    const q = query(collection(db, LEADS_COLLECTION), orderBy('createdAt', 'desc'));

    return onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((docSnap) =>
          normalizeLead(docSnap.data(), docSnap.id)
        );
        onData(docs);
      },
      (err) => {
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
          onData(null);
        }
      },
      (err) => {
        if (onError) onError(err);
      }
    );
  },

  /**
   * Create a new lead through the Cloud Function so scoring, SLA, events,
   * and auto-task creation stay consistent with Shopify/inbound captures.
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
      console.warn('API /leads/create unavailable or failed, falling back to direct Firestore write:', apiError);
    }

    // Direct Firestore fallback when Cloud Functions are not deployed or unreachable
    const docRef = await addDoc(collection(db, LEADS_COLLECTION), {
      ...payload,
      stage: 'new',
      status: 'new',
      score: 50,
      leadScore: 50,
      tier: 'warm',
      scoreBreakdown: { budget: 15, category: 15, intent: 10, engagement: 10 },
      scoreReasons: ['Direct capture fallback (default warm scoring)'],
      slaStatus: 'ok',
      contactedAt: null,
      lastContactedAt: null,
      isOverdue: false,
      aiSummary: `Lead interested in ${payload.quantity}x ${payload.productCategory}.`,
      aiNextAction: 'Follow up via phone or email.',
      tags: [payload.productCategory.toLowerCase().replace(/\s+/g, '-'), 'warm', 'manual-fallback'],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    try {
      await addDoc(collection(db, LEADS_COLLECTION, docRef.id, 'events'), {
        type: 'created',
        description: `New ${payload.formType} lead from ${payload.firstName} ${payload.lastName} (direct fallback)`,
        metadata: { formType: payload.formType, productCategory: payload.productCategory },
        createdBy: 'system',
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Failed to create event in fallback:', e);
    }

    return docRef.id;
  },

  /**
   * Update an existing lead document.
   */
  async safeUpdate(leadId: string, updates: Record<string, any>): Promise<void> {
    const docRef = doc(db, LEADS_COLLECTION, leadId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
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

// ─────────────────────────────────────────────────────────────
// Settings Service – Garage Auto Supplies CRM
// ─────────────────────────────────────────────────────────────
import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  type Unsubscribe,
  type FirestoreError,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { AppSettings } from '../types/settings';
import {
  DEFAULT_BUSINESS_HOURS,
  DEFAULT_SLA_CONFIG,
  PRODUCT_CATEGORIES,
} from '../lib/constants';

const DEFAULT_SETTINGS: AppSettings = {
  businessHours: DEFAULT_BUSINESS_HOURS,
  sla: DEFAULT_SLA_CONFIG,
  scoringWeights: {
    budget: 30,
    category: 30,
    intent: 25,
    engagement: 15,
  },
  integrations: {
    shopify: { enabled: false },
    googleAds: { enabled: false },
    sendgrid: { enabled: false },
    twilio: { enabled: false },
    openai: { enabled: false },
  },
  dealStages: ['new', 'quoted', 'negotiation', 'won', 'lost'],
  productCategories: [...PRODUCT_CATEGORIES] as unknown as string[],
};

export const settingsService = {
  /**
   * Subscribe to global CRM settings in real time.
   */
  subscribeSettings(
    onData: (settings: AppSettings) => void,
    onError?: (error: FirestoreError) => void
  ): Unsubscribe {
    const docRef = doc(db, 'settings', 'global');

    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as Partial<AppSettings>;
          onData({
            ...DEFAULT_SETTINGS,
            ...data,
            businessHours: { ...DEFAULT_SETTINGS.businessHours, ...(data.businessHours || {}) },
            sla: { ...DEFAULT_SETTINGS.sla, ...(data.sla || {}) },
            scoringWeights: { ...DEFAULT_SETTINGS.scoringWeights, ...(data.scoringWeights || {}) },
            integrations: { ...DEFAULT_SETTINGS.integrations, ...(data.integrations || {}) },
          });
        } else {
          onData(DEFAULT_SETTINGS);
        }
      },
      (err) => {
        console.warn('settingsService.subscribeSettings error, fallback to default:', err);
        onData(DEFAULT_SETTINGS);
        if (onError) onError(err);
      }
    );
  },

  /**
   * Update or save global settings.
   */
  async updateSettings(newSettings: Partial<AppSettings>): Promise<void> {
    const docRef = doc(db, 'settings', 'global');
    await setDoc(
      docRef,
      {
        ...newSettings,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  },
};

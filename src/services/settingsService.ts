// ─────────────────────────────────────────────────────────────
// Settings Service – Garage Auto Supplies CRM (Supabase)
// ─────────────────────────────────────────────────────────────
import { supabase } from '../config/supabase';
import type { AppSettings } from '../types/settings';
import {
  DEFAULT_BUSINESS_HOURS,
  DEFAULT_SLA_CONFIG,
  PRODUCT_CATEGORIES,
} from '../lib/constants';

const SETTINGS_TABLE = 'settings';
const GLOBAL_ID = 'global';

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
    gemini: { enabled: true },
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
    onError?: (error: any) => void
  ): () => void {
    const fetchAndNotify = async () => {
      try {
        const { data, error } = await supabase
          .from(SETTINGS_TABLE)
          .select('value')
          .eq('id', GLOBAL_ID)
          .single();

        if (error || !data || !data.value) {
          onData(DEFAULT_SETTINGS);
        } else {
          const val = data.value as Partial<AppSettings>;
          onData({
            ...DEFAULT_SETTINGS,
            ...val,
            businessHours: { ...DEFAULT_SETTINGS.businessHours, ...(val.businessHours || {}) },
            sla: { ...DEFAULT_SETTINGS.sla, ...(val.sla || {}) },
            scoringWeights: { ...DEFAULT_SETTINGS.scoringWeights, ...(val.scoringWeights || {}) },
            integrations: { ...DEFAULT_SETTINGS.integrations, ...(val.integrations || {}) },
          });
        }
      } catch (err: any) {
        console.warn('settingsService.subscribeSettings error, fallback to default:', err);
        onData(DEFAULT_SETTINGS);
        if (onError) onError(err);
      }
    };

    fetchAndNotify();

    const channel = supabase
      .channel(`table-settings-global-${Math.random().toString(36).substring(2, 9)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: SETTINGS_TABLE, filter: `id=eq.${GLOBAL_ID}` },
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
   * Update or save global settings.
   */
  async updateSettings(newSettings: Partial<AppSettings>): Promise<void> {
    const { data } = await supabase
      .from(SETTINGS_TABLE)
      .select('value')
      .eq('id', GLOBAL_ID)
      .single();

    const currentVal = data?.value || {};
    const updatedVal = { ...currentVal, ...newSettings };

    const { error } = await supabase.from(SETTINGS_TABLE).upsert({
      id: GLOBAL_ID,
      value: updatedVal,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error('updateSettings failed:', error);
      throw error;
    }
  },
};

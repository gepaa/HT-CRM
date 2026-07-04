// ─────────────────────────────────────────────────────────────
// useSettings – Global CRM settings hook
// ─────────────────────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react';
import type { AppSettings } from '../types/settings';
import { settingsService } from '../services/settingsService';
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
    gemini: { enabled: true },
  },
  dealStages: ['new', 'quoted', 'negotiation', 'won', 'lost'],
  productCategories: [...PRODUCT_CATEGORIES] as unknown as string[],
};

interface UseSettingsResult {
  settings: AppSettings;
  loading: boolean;
  error: Error | null;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);

    const unsubscribe = settingsService.subscribeSettings(
      (data) => {
        setSettings(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<AppSettings>) => {
    await settingsService.updateSettings(newSettings);
  }, []);

  return { settings, loading, error, updateSettings };
}

// ─────────────────────────────────────────────────────────────
// Settings Types – Garage Auto Supplies CRM
// ─────────────────────────────────────────────────────────────

/** One day of the weekly business-hours schedule */
export interface DaySchedule {
  day: string;
  start: string;
  end: string;
  enabled: boolean;
}

/** Weekly operating schedule with timezone */
export interface BusinessHours {
  timezone: string;
  schedule: DaySchedule[];
}

/** Maximum response-time targets per lead tier (in minutes) */
export interface SLAConfig {
  hotLeadMinutes: number;
  warmLeadMinutes: number;
  coldLeadMinutes: number;
}

/** Generic third-party integration toggle + credentials */
export interface IntegrationConfig {
  enabled: boolean;
  [key: string]: any;
}

/** Top-level application settings document */
export interface AppSettings {
  businessHours: BusinessHours;
  sla: SLAConfig;
  scoringWeights: {
    budget: number;
    category: number;
    intent: number;
    engagement: number;
  };
  integrations: {
    shopify: IntegrationConfig;
    googleAds: IntegrationConfig;
    sendgrid: IntegrationConfig;
    twilio: IntegrationConfig;
    openai: IntegrationConfig;
    gemini?: IntegrationConfig;
  };
  dealStages: string[];
  productCategories: string[];
}

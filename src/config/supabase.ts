// ─────────────────────────────────────────────────────────────
// Supabase Configuration – Garage Auto Supplies CRM
// ─────────────────────────────────────────────────────────────
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hublaayffajalhnmwpgp.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_lGXIZL0MdtgMcus9Vr5yvw_N1iVX5g2';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).');
}

// Initialize Supabase Client
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const configuredFunctionsBaseUrl = (import.meta.env.VITE_FUNCTIONS_BASE_URL || `${supabaseUrl}/functions/v1`).replace(/\/$/, '');

export const supabaseRuntime = {
  url: supabaseUrl,
  functionsBaseUrl: configuredFunctionsBaseUrl,
  apiBaseUrl: configuredApiBaseUrl,
} as const;

/**
 * Returns the full URL for calling a Supabase Edge Function.
 */
export function getEdgeFunctionUrl(functionName: string): string {
  return `${configuredFunctionsBaseUrl}/${functionName}`;
}

/**
 * Returns the full URL for an API route.
 */
export function getApiRouteUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (configuredApiBaseUrl) {
    return `${configuredApiBaseUrl}${normalizedPath}`;
  }
  return `/api${normalizedPath}`;
}

export default supabase;

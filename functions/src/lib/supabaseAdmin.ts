// ─────────────────────────────────────────────────────────────
// Supabase Client Initializer for Backend Functions
// ─────────────────────────────────────────────────────────────
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://hublaayffajalhnmwpgp.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_lGXIZL0MdtgMcus9Vr5yvw_N1iVX5g2';

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Missing Supabase configuration in functions environment.');
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export default supabase;

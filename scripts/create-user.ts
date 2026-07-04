#!/usr/bin/env tsx
// ============================================================
// create-user.ts — Secure User Invitation Script (Supabase)
// ============================================================
// Creates a Supabase Auth user and writes their matching Postgres /users profile.
//
// Usage:
//   tsx scripts/create-user.ts --email admin@yourcompany.com --role admin --name "Pablo Admin"
//   tsx scripts/create-user.ts --email rep@yourcompany.com --role sales_rep --name "Sarah Jenkins"
// ============================================================
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '.env.production' });
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://hublaayffajalhnmwpgp.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_lGXIZL0MdtgMcus9Vr5yvw_N1iVX5g2';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

type Role = 'admin' | 'sales_rep' | 'viewer';

function parseArgs(): { email: string; role: Role; name: string; password?: string } {
  const args = process.argv.slice(2);
  let email = '';
  let role: Role = 'sales_rep';
  let name = '';
  let password = 'TempPassword123!';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) email = args[++i];
    else if (args[i] === '--role' && args[i + 1]) role = args[++i] as Role;
    else if (args[i] === '--name' && args[i + 1]) name = args[++i];
    else if (args[i] === '--password' && args[i + 1]) password = args[++i];
  }

  if (!email || !name) {
    console.error('Usage: tsx scripts/create-user.ts --email <email> --role <admin|sales_rep|viewer> --name "<name>" [--password <temp_pw>]');
    process.exit(1);
  }

  return { email, role, name, password };
}

async function main() {
  const { email, role, name, password } = parseArgs();

  console.log(`\n── Creating user in Supabase Auth & Postgres ──`);
  console.log(`Email: ${email}\nRole:  ${role}\nName:  ${name}\n`);

  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role, display_name: name },
  });

  if (authErr || !authData.user) {
    console.error('❌ Error creating Supabase Auth user:', authErr?.message || 'Unknown error');
    process.exit(1);
  }

  const uid = authData.user.id;
  console.log(`✅ Supabase Auth user created with ID: ${uid}`);

  const nowIso = new Date().toISOString();
  const { error: dbErr } = await supabase.from('users').upsert({
    id: uid,
    email,
    display_name: name,
    role,
    status: 'active',
    created_at: nowIso,
    updated_at: nowIso,
  });

  if (dbErr) {
    console.error('❌ Error inserting into users table:', dbErr.message);
    process.exit(1);
  }

  console.log(`✅ Postgres users profile written successfully.`);
  console.log(`\nUser can login with Email: ${email} | Password: ${password}\n`);
}

main().catch(console.error);

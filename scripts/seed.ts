// ─────────────────────────────────────────────────────────────
// Seed Script – Garage Auto Supplies CRM (Supabase)
// ─────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { subDays } from 'date-fns';
import { SEED_LEADS, SEED_DEALS, SEED_TASKS, SEED_NOTES, SEED_EVENTS } from '../src/lib/seedData';
import { toSupabaseLead } from '../src/services/leadMapper';

const isProduction = process.argv.includes('--production');
if (isProduction) {
  console.log('🌍 Loading .env.production for production seeding...');
  dotenv.config({ path: '.env.production' });
} else {
  dotenv.config();
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://hublaayffajalhnmwpgp.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_lGXIZL0MdtgMcus9Vr5yvw_N1iVX5g2';

console.log(`🔌 Connecting to Supabase at ${supabaseUrl}...`);
const supabase = createClient(supabaseUrl, supabaseKey);

async function seedDatabase() {
  console.log('🌱 Starting database seeding for Garage Auto Supplies CRM (Supabase)...');

  // 1. Seed CRM Users
  console.log('👤 Seeding CRM users...');
  const users = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      uid: 'admin-test-uid',
      email: 'admin@garageautosupplies.com',
      display_name: 'Alex Admin',
      role: 'admin',
      created_at: subDays(new Date(), 30).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      uid: 'sales-test-uid',
      email: 'sales@garageautosupplies.com',
      display_name: 'Sam Sales Rep',
      role: 'sales_rep',
      created_at: subDays(new Date(), 20).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '00000000-0000-0000-0000-000000000003',
      uid: 'ben-test-uid',
      email: 'ben@garageautosupplies.com',
      display_name: 'Ben Lockwood',
      role: 'admin',
      created_at: subDays(new Date(), 40).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '00000000-0000-0000-0000-000000000004',
      uid: 'pab-test-uid',
      email: 'pab@garageautosupplies.com',
      display_name: 'Pablo Guido',
      role: 'admin',
      created_at: subDays(new Date(), 50).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '00000000-0000-0000-0000-000000000005',
      uid: 'pablo-extra-uid',
      email: 'pablo@garageautosupplies.com',
      display_name: 'Pablo Guido',
      role: 'admin',
      created_at: subDays(new Date(), 50).toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  for (const u of users) {
    const { error } = await supabase.from('users').upsert(u);
    if (error) console.warn(`Failed to seed user ${u.email}:`, error.message);
  }

  // 2. Seed Settings
  console.log('⚙️ Seeding global settings...');
  const settingsVal = {
    businessHours: {
      timezone: 'America/New_York',
      schedule: [
        { day: 'Sunday', start: '09:00', end: '18:00', enabled: false },
        { day: 'Monday', start: '09:00', end: '18:00', enabled: true },
        { day: 'Tuesday', start: '09:00', end: '18:00', enabled: true },
        { day: 'Wednesday', start: '09:00', end: '18:00', enabled: true },
        { day: 'Thursday', start: '09:00', end: '18:00', enabled: true },
        { day: 'Friday', start: '09:00', end: '18:00', enabled: true },
        { day: 'Saturday', start: '09:00', end: '18:00', enabled: false },
      ],
    },
    sla: { hotLeadMinutes: 30, warmLeadMinutes: 1440, coldLeadMinutes: 480 },
    scoringWeights: { budget: 30, category: 30, intent: 25, engagement: 15 },
    integrations: {
      shopify: { enabled: false },
      googleAds: { enabled: false },
      sendgrid: { enabled: false },
      twilio: { enabled: false },
      openai: { enabled: false },
      gemini: { enabled: true },
    },
    dealStages: ['new', 'quoted', 'negotiation', 'won', 'lost'],
    productCategories: [
      'Car Lifts',
      '2-Post Lifts',
      '4-Post Lifts',
      'Scissor Lifts',
      'Tire Changers',
      'Wheel Balancers',
      'Pressure Washers',
      'Mini Excavators',
      'Wood Chippers',
      'Stump Grinders',
      'Garage Storage',
      'Generators',
      'Workbenches',
      'Air Compressors',
      'Sheet Metal Brakes',
      'Sawmills',
      'Other Heavy Equipment',
    ],
  };

  const { error: settingsErr } = await supabase.from('settings').upsert({
    id: 'global',
    value: settingsVal,
    updated_at: new Date().toISOString(),
  });
  if (settingsErr) console.warn('Failed to seed global settings:', settingsErr.message);

  // 3. Seed Leads, Events, Notes
  console.log(`📦 Seeding ${SEED_LEADS.length} realistic leads with events and notes...`);
  for (const lead of SEED_LEADS) {
    const row = toSupabaseLead(lead);
    row.id = lead.id;
    row.created_at = lead.createdAt instanceof Date ? lead.createdAt.toISOString() : new Date(lead.createdAt).toISOString();
    row.updated_at = lead.updatedAt instanceof Date ? lead.updatedAt.toISOString() : new Date(lead.updatedAt).toISOString();
    if (lead.slaDeadline) {
      row.sla_deadline = lead.slaDeadline instanceof Date ? lead.slaDeadline.toISOString() : new Date(lead.slaDeadline).toISOString();
      row.sla_deadline_at = row.sla_deadline;
    }
    if (lead.contactedAt) {
      row.contacted_at = lead.contactedAt instanceof Date ? lead.contactedAt.toISOString() : new Date(lead.contactedAt).toISOString();
      row.last_contacted_at = row.contacted_at;
    }

    const { error: leadErr } = await supabase.from('leads').upsert(row);
    if (leadErr) console.warn(`Failed to seed lead ${lead.id}:`, leadErr.message);

    const events = SEED_EVENTS[lead.id] || [];
    for (const evt of events) {
      const { error: evtErr } = await supabase.from('lead_events').upsert({
        id: evt.id,
        lead_id: lead.id,
        type: evt.type,
        description: evt.description,
        metadata: evt.metadata || {},
        created_by: evt.createdBy || 'system',
        created_at: evt.createdAt instanceof Date ? evt.createdAt.toISOString() : new Date(evt.createdAt).toISOString(),
      });
      if (evtErr) console.warn(`Failed to seed event ${evt.id}:`, evtErr.message);
    }

    const notes = SEED_NOTES[lead.id] || [];
    for (const note of notes) {
      const { error: noteErr } = await supabase.from('lead_notes').upsert({
        id: note.id,
        lead_id: lead.id,
        author_id: note.createdBy || 'user',
        author_name: note.createdByName || 'Sales Rep',
        created_by: note.createdBy || 'user',
        created_by_name: note.createdByName || 'Sales Rep',
        content: note.content,
        created_at: note.createdAt instanceof Date ? note.createdAt.toISOString() : new Date(note.createdAt).toISOString(),
        updated_at: note.updatedAt instanceof Date ? note.updatedAt.toISOString() : new Date(note.updatedAt).toISOString(),
      });
      if (noteErr) console.warn(`Failed to seed note ${note.id}:`, noteErr.message);
    }
  }

  // 4. Seed Tasks
  console.log(`📋 Seeding ${SEED_TASKS.length} tasks...`);
  for (const task of SEED_TASKS) {
    const dueDate = task.dueDate ? (task.dueDate instanceof Date ? task.dueDate.toISOString() : new Date(task.dueDate).toISOString()) : null;
    const completedAt = task.completedAt ? (task.completedAt instanceof Date ? task.completedAt.toISOString() : new Date(task.completedAt).toISOString()) : null;
    const { error: taskErr } = await supabase.from('tasks').upsert({
      id: task.id,
      title: task.title,
      description: task.description || '',
      lead_id: task.leadId || null,
      assigned_to: task.assignedTo || 'Unassigned',
      assigned_by: task.assignedBy || 'system',
      status: task.status || 'pending',
      priority: task.priority === 'normal' ? 'medium' : task.priority,
      due_date: dueDate,
      due_at: dueDate,
      completed_at: completedAt,
      created_at: task.createdAt instanceof Date ? task.createdAt.toISOString() : new Date(task.createdAt).toISOString(),
      updated_at: task.updatedAt instanceof Date ? task.updatedAt.toISOString() : new Date(task.updatedAt).toISOString(),
    });
    if (taskErr) console.warn(`Failed to seed task ${task.id}:`, taskErr.message);
  }

  // 5. Seed Deals
  console.log(`🤝 Seeding ${SEED_DEALS.length} deals...`);
  for (const deal of SEED_DEALS) {
    const expectedCloseDate = deal.expectedCloseDate ? (deal.expectedCloseDate instanceof Date ? deal.expectedCloseDate.toISOString() : new Date(deal.expectedCloseDate).toISOString()) : null;
    const { error: dealErr } = await supabase.from('deals').upsert({
      id: deal.id,
      title: deal.title,
      value: deal.value || 0,
      stage: deal.stage || 'qualification',
      probability: deal.probability || 10,
      lead_id: deal.leadId || null,
      contact_name: deal.contactName || '',
      expected_close_date: expectedCloseDate,
      assigned_to: deal.assignedTo || 'Unassigned',
      notes: deal.notes || '',
      created_at: deal.createdAt instanceof Date ? deal.createdAt.toISOString() : new Date(deal.createdAt).toISOString(),
      updated_at: deal.updatedAt instanceof Date ? deal.updatedAt.toISOString() : new Date(deal.updatedAt).toISOString(),
    });
    if (dealErr) console.warn(`Failed to seed deal ${deal.id}:`, dealErr.message);
  }

  console.log('✅ Supabase database seeding completed successfully!');
  process.exit(0);
}

seedDatabase().catch((e) => {
  console.error('❌ Error seeding Supabase database:', e);
  process.exit(1);
});

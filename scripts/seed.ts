import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, collection, doc, setDoc, Timestamp } from 'firebase/firestore';
import * as dotenv from 'dotenv';
import { subDays } from 'date-fns';
import { SEED_LEADS, SEED_DEALS, SEED_TASKS, SEED_NOTES, SEED_EVENTS } from '../src/lib/seedData';

const isProduction = process.argv.includes('--production');
if (isProduction) {
  console.log('🌍 Loading .env.production for production seeding...');
  dotenv.config({ path: '.env.production' });
} else {
  dotenv.config();
}

const useEmulators = !isProduction && process.env.VITE_USE_EMULATORS === 'true';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required. Use VITE_USE_EMULATORS=true for local emulator seeding.`);
  }
  return value;
}

const firebaseConfig = {
  apiKey: useEmulators ? (process.env.VITE_FIREBASE_API_KEY || 'local-emulator-key') : requiredEnv('VITE_FIREBASE_API_KEY'),
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'localhost',
  projectId: requiredEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: useEmulators ? (process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '000000000000') : requiredEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: useEmulators ? (process.env.VITE_FIREBASE_APP_ID || 'local-emulator-app') : requiredEnv('VITE_FIREBASE_APP_ID'),
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

if (useEmulators) {
  console.log('🔌 Connecting to Firestore Emulator on localhost:8080...');
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
  } catch (e) {
    console.log('Emulator already connected or failed to connect:', e);
  }
}

async function seedDatabase() {
  console.log('🌱 Starting database seeding for Garage Auto Supplies CRM...');

  // 1. Seed CRM Users
  console.log('👤 Seeding CRM users...');
  const usersRef = collection(db, 'users');
  await setDoc(doc(usersRef, 'admin-test-uid'), {
    id: 'admin-test-uid',
    email: 'admin@garageautosupplies.com',
    displayName: 'Alex Admin',
    role: 'admin',
    createdAt: Timestamp.fromDate(subDays(new Date(), 30)),
    updatedAt: Timestamp.fromDate(new Date())
  });
  await setDoc(doc(usersRef, 'sales-test-uid'), {
    id: 'sales-test-uid',
    email: 'sales@garageautosupplies.com',
    displayName: 'Sam Sales Rep',
    role: 'sales_rep',
    createdAt: Timestamp.fromDate(subDays(new Date(), 20)),
    updatedAt: Timestamp.fromDate(new Date())
  });

  // 2. Seed Settings
  console.log('⚙️ Seeding global settings...');
  await setDoc(doc(db, 'settings', 'global'), {
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
      ]
    },
    sla: { hotLeadMinutes: 30, warmLeadMinutes: 1440, coldLeadMinutes: 480 },
    scoringWeights: { budget: 30, category: 30, intent: 25, engagement: 15 },
    integrations: {
      shopify: { enabled: false },
      googleAds: { enabled: false },
      sendgrid: { enabled: false },
      twilio: { enabled: false },
      openai: { enabled: false }
    },
    dealStages: ['new', 'quoted', 'negotiation', 'won', 'lost'],
    productCategories: [
      'Car Lifts', '2-Post Lifts', '4-Post Lifts', 'Scissor Lifts',
      'Tire Changers', 'Wheel Balancers', 'Pressure Washers', 'Mini Excavators',
      'Wood Chippers', 'Stump Grinders', 'Garage Storage', 'Generators',
      'Workbenches', 'Air Compressors', 'Sheet Metal Brakes', 'Sawmills',
      'Other Heavy Equipment'
    ]
  });

  // 3. Seed Leads, Events, Notes
  console.log(`📦 Seeding ${SEED_LEADS.length} realistic leads with events and notes...`);
  for (const lead of SEED_LEADS) {
    const leadRef = doc(db, 'leads', lead.id);
    const { id, ...leadData } = lead;
    await setDoc(leadRef, {
      ...leadData,
      createdAt: Timestamp.fromDate(new Date(lead.createdAt)),
      updatedAt: Timestamp.fromDate(new Date(lead.updatedAt)),
      slaDeadline: lead.slaDeadline ? Timestamp.fromDate(new Date(lead.slaDeadline)) : null,
      contactedAt: lead.contactedAt ? Timestamp.fromDate(new Date(lead.contactedAt)) : null,
      lastContactedAt: lead.lastContactedAt ? Timestamp.fromDate(new Date(lead.lastContactedAt)) : null,
    });

    const events = SEED_EVENTS[lead.id] || [];
    for (const evt of events) {
      const { id: evtId, ...evtData } = evt;
      await setDoc(doc(db, 'leads', lead.id, 'events', evt.id), {
        ...evtData,
        createdAt: Timestamp.fromDate(new Date(evt.createdAt)),
      });
    }

    const notes = SEED_NOTES[lead.id] || [];
    for (const note of notes) {
      const { id: noteId, ...noteData } = note;
      await setDoc(doc(db, 'leads', lead.id, 'notes', note.id), {
        ...noteData,
        createdAt: Timestamp.fromDate(new Date(note.createdAt)),
        updatedAt: Timestamp.fromDate(new Date(note.updatedAt)),
      });
    }
  }

  // 4. Seed Tasks
  console.log(`📋 Seeding ${SEED_TASKS.length} tasks...`);
  for (const task of SEED_TASKS) {
    const { id, ...taskData } = task;
    await setDoc(doc(db, 'tasks', task.id), {
      ...taskData,
      dueDate: taskData.dueDate ? Timestamp.fromDate(new Date(taskData.dueDate)) : null,
      dueAt: taskData.dueDate ? Timestamp.fromDate(new Date(taskData.dueDate)) : null,
      completedAt: taskData.completedAt ? Timestamp.fromDate(new Date(taskData.completedAt)) : null,
      createdAt: Timestamp.fromDate(new Date(task.createdAt)),
      updatedAt: Timestamp.fromDate(new Date(task.updatedAt)),
    });
  }

  // 5. Seed Deals
  console.log(`🤝 Seeding ${SEED_DEALS.length} deals...`);
  for (const deal of SEED_DEALS) {
    const { id, ...dealData } = deal;
    await setDoc(doc(db, 'deals', deal.id), {
      ...dealData,
      expectedCloseDate: dealData.expectedCloseDate ? Timestamp.fromDate(new Date(dealData.expectedCloseDate)) : null,
      createdAt: Timestamp.fromDate(new Date(deal.createdAt)),
      updatedAt: Timestamp.fromDate(new Date(deal.updatedAt)),
    });
  }

  console.log('✅ Database seeding completed successfully! Created 22 leads, events, notes, tasks, and deals.');
  process.exit(0);
}

seedDatabase().catch((e) => {
  console.error('❌ Error seeding database:', e);
  process.exit(1);
});

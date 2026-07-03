#!/usr/bin/env tsx
// ============================================================
// create-user.ts — Secure User Invitation Script
// ============================================================
// Creates a Firebase Auth user, assigns a custom role claim,
// and writes their matching Firestore /users/{uid} profile.
//
// Prerequisites:
//   1. Set GOOGLE_APPLICATION_CREDENTIALS to a service account
//      key file, OR run this from a machine authenticated with
//      `firebase login` (Application Default Credentials).
//
//   2. Install deps if running outside the project:
//        npm install firebase-admin
//
// Usage:
//   # Admin user
//   tsx scripts/create-user.ts --email admin@yourcompany.com --role admin --name "Pablo Admin"
//
//   # Sales rep
//   tsx scripts/create-user.ts --email rep@yourcompany.com --role sales_rep --name "Sarah Jenkins"
//
//   # With a specific project (overrides GOOGLE_APPLICATION_CREDENTIALS project)
//   FIREBASE_PROJECT_ID=your-project-id tsx scripts/create-user.ts --email ...
//
// After running, the new user will receive a password-reset email
// link printed to stdout, which they can use to set their password.
// ============================================================

import * as admin from 'firebase-admin';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';

// ── Argument Parsing ──────────────────────────────────────────
type Role = 'admin' | 'sales_rep' | 'viewer';

function parseArgs(): {
  email: string;
  role: Role;
  name: string;
  phone?: string;
} {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const email = get('--email');
  const roleRaw = get('--role') ?? 'sales_rep';
  const name = get('--name') ?? '';
  const phone = get('--phone');

  if (!email) {
    console.error('\n❌ --email is required.\n');
    console.error('Usage: tsx scripts/create-user.ts --email user@example.com --role admin --name "Full Name"\n');
    process.exit(1);
  }

  const validRoles: Role[] = ['admin', 'sales_rep', 'viewer'];
  if (!validRoles.includes(roleRaw as Role)) {
    console.error(`\n❌ Invalid --role "${roleRaw}". Valid values: admin, sales_rep, viewer\n`);
    process.exit(1);
  }

  return { email, role: roleRaw as Role, name, phone };
}

// ── Prompt helper ─────────────────────────────────────────────
async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${question} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

// ── Main ──────────────────────────────────────────────────────
async function main(): Promise<void> {
  const { email, role, name, phone } = parseArgs();

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  HT CRM — Create New User');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Email  : ${email}`);
  console.log(`  Role   : ${role}`);
  console.log(`  Name   : ${name || '(not set)'}`);
  if (phone) console.log(`  Phone  : ${phone}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const ok = await confirm('Create this user in Firebase Auth + Firestore?');
  if (!ok) {
    console.log('Aborted.\n');
    process.exit(0);
  }

  // Initialize Admin SDK (uses service account key file, ADC, or GOOGLE_APPLICATION_CREDENTIALS)
  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    let initialized = false;

    // Check for service account key file paths
    const possiblePaths = [
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH,
      path.join(process.cwd(), 'serviceAccountKey.json'),
      path.join(process.cwd(), 'functions', 'serviceAccountKey.json'),
      path.join(__dirname, '..', 'serviceAccountKey.json'),
      path.join(__dirname, '..', 'functions', 'serviceAccountKey.json')
    ].filter((p): p is string => !!p);

    for (const p of possiblePaths) {
      const absolutePath = path.resolve(p);
      if (fs.existsSync(absolutePath)) {
        try {
          const serviceAccount = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
          });
          console.log(`ℹ️  Firebase Admin SDK initialized using service account key at: ${absolutePath}`);
          initialized = true;
          break;
        } catch (error: any) {
          console.warn(`⚠️  Failed to initialize with key at ${absolutePath}:`, error.message ?? error);
        }
      }
    }

    if (!initialized) {
      admin.initializeApp(projectId ? { projectId } : undefined);
    }
  }

  const auth = admin.auth();
  const db = admin.firestore();

  // ── Step 1: Check if user already exists ──────────────────
  let existingUid: string | null = null;
  try {
    const existing = await auth.getUserByEmail(email);
    existingUid = existing.uid;
    console.log(`⚠️  User already exists in Firebase Auth (uid: ${existing.uid})`);
    const overwrite = await confirm('Update their role and Firestore profile?');
    if (!overwrite) {
      console.log('Aborted.\n');
      process.exit(0);
    }
  } catch {
    // User doesn't exist — good, we'll create them
  }

  let uid: string;

  if (existingUid) {
    uid = existingUid;
    // Update display name if provided
    if (name) {
      await auth.updateUser(uid, { displayName: name });
    }
  } else {
    // ── Step 2: Create the Firebase Auth user ──────────────
    // No password set — we'll generate a password-reset link instead
    const userRecord = await auth.createUser({
      email,
      displayName: name || undefined,
      phoneNumber: phone || undefined,
      emailVerified: false,
      disabled: false,
    });

    uid = userRecord.uid;
    console.log(`\n✅ Firebase Auth user created: ${uid}`);
  }

  // ── Step 3: Set custom role claim ─────────────────────────
  // Custom claims are checked by Firestore rules:
  //   function hasRole(role) { return request.auth.token.role == role; }
  await auth.setCustomUserClaims(uid, {
    role,
    crm: true,
  });
  console.log(`✅ Custom claims set: { role: "${role}", crm: true }`);

  // ── Step 4: Write /users/{uid} Firestore profile ──────────
  const profileData = {
    uid,
    email,
    displayName: name || email.split('@')[0],
    role,
    phone: phone ?? null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    isActive: true,
    // Salesrep-specific defaults
    ...(role === 'sales_rep' && {
      assignedLeadCount: 0,
      dealsWon: 0,
      totalRevenue: 0,
    }),
  };

  await db.collection('users').doc(uid).set(profileData, { merge: true });
  console.log(`✅ Firestore /users/${uid} profile written`);

  // ── Step 5: Generate password-reset link ──────────────────
  const resetLink = await auth.generatePasswordResetLink(email);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✅ User created successfully!\n');
  console.log(`  UID    : ${uid}`);
  console.log(`  Email  : ${email}`);
  console.log(`  Role   : ${role}`);
  console.log('\n  🔗 Password Reset Link (send this to the user):');
  console.log(`  ${resetLink}`);
  console.log('\n  ⚠️  This link expires in 1 hour.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('  ℹ️  The user must sign in ONCE after setting their password');
  console.log('     for the custom role claim to take effect in the frontend.');
  console.log('     (Firebase ID tokens refresh after ~1 hour automatically.)\n');
}

main().catch((err) => {
  console.error('\n❌ Error creating user:', err.message ?? err);
  process.exit(1);
});

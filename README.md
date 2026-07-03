# HT CRM

Garage Auto Supplies high-ticket CRM built with Vite, React, Firebase Auth, Firestore, Firebase Hosting, and Firebase Functions.

## Required Environment

Create `.env.local` for the frontend and scripts:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_FUNCTIONS_REGION=us-central1
```

Optional local/deployment overrides:

```bash
VITE_USE_EMULATORS=true
VITE_API_BASE_URL=https://your-domain.example.com/api
VITE_FUNCTIONS_BASE_URL=http://127.0.0.1:5001/YOUR_PROJECT/us-central1
LEAD_CAPTURE_ENDPOINT=https://your-domain.example.com/api/leads/create
```

There are no production demo project fallbacks. Missing Firebase project config now fails instead of sending traffic to a demo project.

## Local Development

Install dependencies:

```bash
npm install
npm --prefix functions install
```

Run the Vite app:

```bash
npm run dev
```

Run Firebase emulators:

```bash
VITE_USE_EMULATORS=true firebase emulators:start
```

Seed local Firestore explicitly:

```bash
VITE_USE_EMULATORS=true VITE_FIREBASE_PROJECT_ID=your-project npm run seed
```

## Build And Verify

Frontend:

```bash
npm run build
```

Functions:

```bash
npm --prefix functions run build
```

Lead capture smoke test:

```bash
LEAD_CAPTURE_ENDPOINT=http://127.0.0.1:5001/YOUR_PROJECT/us-central1/api/api/leads/create npm run test:capture
```

For deployed Firebase Hosting, use:

```bash
LEAD_CAPTURE_ENDPOINT=https://YOUR_FIREBASE_HOSTING_DOMAIN/api/leads/create npm run test:capture
```

## API Routes

Firebase Hosting rewrites `/api/**` to the exported `api` Function.
For Vercel or other static previews, set `VITE_API_BASE_URL` to a Firebase Hosting/API origin because the `/api/**` rewrite is not provided by Vite.

Current routes:

- `POST /api/leads/create`
- `POST /api/webhooks/shopify`

Direct Functions exports are also available for compatibility:

- `createLead`
- `shopifyWebhook`
- `slaChecker`
- `slaWarningChecker`
- `api`

## Firestore Indexes

Composite indexes live in `firestore.indexes.json` and cover:

- `tasks`: `leadId ASC, createdAt DESC`
- `leads`: `slaStatus ASC, contactedAt ASC, slaDeadline ASC`

Deploy rules and indexes:

```bash
firebase deploy --only firestore
```

## Deploy

Build and deploy Hosting plus Functions:

```bash
npm run build
npm --prefix functions run build
firebase deploy --only hosting,functions
```

Deploy everything Firebase-managed:

```bash
firebase deploy
```

## Shopify Capture Form

`public/snippets/garage-crm-form.liquid` reads the endpoint from the wrapper element:

```html
<div class="gas-crm-form-wrapper" data-crm-endpoint="https://YOUR_FIREBASE_HOSTING_DOMAIN/api/leads/create">
```

Set the production Firebase Hosting domain there before installing the snippet in Shopify.

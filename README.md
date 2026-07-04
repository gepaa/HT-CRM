# HT CRM

Garage Auto Supplies high-ticket CRM built with Vite, React, Tailwind CSS, Supabase Postgres, and Vercel Serverless Functions.

## Required Environment

Create `.env.local` or `.env` for your local development:

```bash
VITE_SUPABASE_URL=https://hublaayffajalhnmwpgp.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_lGXIZL0MdtgMcus9Vr5yvw_N1iVX5g2
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
VITE_API_BASE_URL=/api
```

## Local Development

Install dependencies:

```bash
npm install
```

Run the Vite frontend:

```bash
npm run dev
```

## Serverless API & Webhooks (Vercel)

All backend endpoints are built as Vercel Serverless Functions inside `/api`:
- `POST /api/leads/create` — Public lead capture endpoint from Shopify / Landing pages
- `POST /api/shopifyWebhook` — Shopify customer, draft order, and order webhook handler
- `GET /api/cron/slaChecker` — Scheduled SLA checking cron (every 5 mins)
- `GET /api/cron/slaWarningChecker` — Scheduled SLA warning cron (every 5 mins)

## Verification & Testing

Verify lead capture endpoint:
```bash
npm run test:capture
```

Build the project:
```bash
npm run build
```

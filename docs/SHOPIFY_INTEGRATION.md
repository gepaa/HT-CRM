# Shopify Lead Capture Integration

This project exposes routed Vercel Serverless HTTPS endpoints for Shopify:

- Lead capture form endpoint: `https://your-domain.vercel.app/api/leads/create`
- Shopify webhook endpoint: `https://your-domain.vercel.app/api/shopifyWebhook`

## What The Integration Does

- Accepts quote/contact submissions from `public/snippets/garage-crm-form.liquid`.
- Verifies Shopify webhooks with `X-Shopify-Hmac-SHA256` before reading the payload.
- Deduplicates webhook retries with `X-Shopify-Webhook-Id`.
- Processes these Shopify webhook topics:
  - `customers/create`: links or creates a CRM lead and stores `shopifyCustomerId` in Supabase Postgres.
  - `draft_orders/create`: links or creates a lead, stores draft order IDs, marks the lead `quoted`, and upserts a proposal-stage deal.
  - `orders/create`: links or creates a lead, stores order IDs, marks the lead `won`, and upserts a won deal.
- Writes audit records to `integrations_log` and delivery records to `shopify_webhook_deliveries` in Supabase.

Shopify references:

- HMAC verification and dedupe headers: https://shopify.dev/docs/apps/build/webhooks/verify-deliveries
- Webhook topics and subscription options: https://shopify.dev/docs/api/webhooks/latest

## 1. Configure Environment in Vercel

In your Vercel Project Settings → Environment Variables, set:

```bash
SHOPIFY_WEBHOOK_SECRET=your_shopify_app_client_secret_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
```

## 2. Connect Webhooks in Shopify Admin

1. In your Shopify Admin, navigate to **Settings** → **Notifications** → **Webhooks**.
2. Create webhooks for `customers/create`, `draft_orders/create`, and `orders/create`.
3. Point them to `https://your-domain.vercel.app/api/shopifyWebhook` with format set to **JSON**.
4. Copy the Webhook Signing Secret from the bottom of the page into your Vercel `SHOPIFY_WEBHOOK_SECRET` variable.

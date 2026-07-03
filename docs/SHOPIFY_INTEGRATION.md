# Shopify Lead Capture Integration

This project exposes routed Firebase HTTPS endpoints for Shopify:

- Lead capture form endpoint: `https://YOUR_FIREBASE_HOSTING_DOMAIN/api/leads/create`
- Shopify webhook endpoint: `https://YOUR_FIREBASE_HOSTING_DOMAIN/api/webhooks/shopify`

## What The Integration Does

- Accepts quote/contact submissions from `public/snippets/garage-crm-form.liquid`.
- Verifies Shopify webhooks with `X-Shopify-Hmac-SHA256` before reading the payload.
- Deduplicates webhook retries with `X-Shopify-Webhook-Id`.
- Processes these Shopify webhook topics:
  - `customers/create`: links or creates a CRM lead and stores `shopifyCustomerId`.
  - `draft_orders/create`: links or creates a lead, stores draft order IDs, marks the lead `quoted`, and upserts a proposal-stage deal.
  - `orders/create`: links or creates a lead, stores order IDs, marks the lead `won`, and upserts a won deal.
- Writes audit records to `integrations_log` and delivery records to `shopify_webhook_deliveries`.

Shopify references:

- HMAC verification and dedupe headers: https://shopify.dev/docs/apps/build/webhooks/verify-deliveries
- Webhook topics and subscription options: https://shopify.dev/docs/api/webhooks/latest

## 1. Configure Firebase

Set the Shopify app client secret/API secret key for webhook HMAC verification:

```bash
firebase functions:config:set shopify.webhook_secret="YOUR_SHOPIFY_APP_CLIENT_SECRET"
```

The function also supports `SHOPIFY_WEBHOOK_SECRET` if your deployment environment injects environment variables directly.

Build and deploy:

```bash
npm --prefix functions run build
firebase deploy --only functions
```

After deploy, use the Firebase Hosting URLs:

```text
https://YOUR_FIREBASE_HOSTING_DOMAIN/api/leads/create
https://YOUR_FIREBASE_HOSTING_DOMAIN/api/webhooks/shopify
```

For direct emulator/function testing, the routed `api` function URL is:

```text
http://127.0.0.1:5001/YOUR_FIREBASE_PROJECT_ID/us-central1/api/api/leads/create
http://127.0.0.1:5001/YOUR_FIREBASE_PROJECT_ID/us-central1/api/api/webhooks/shopify
```

## 2. Install The Shopify Snippet

Copy `public/snippets/garage-crm-form.liquid` into the Shopify theme as `snippets/garage-crm-form.liquid`.

Render it from a product, page, or custom quote template:

```liquid
{% render 'garage-crm-form',
  form_type: 'quote',
  crm_endpoint: 'https://YOUR_FIREBASE_HOSTING_DOMAIN/api/leads/create'
%}
```

Alternatively, store the endpoint in the shop metafield `gas_crm.lead_endpoint` and render:

```liquid
{% render 'garage-crm-form', form_type: 'quote' %}
```

Supported `form_type` values are `quote`, `contact`, and `product_inquiry`.

## 3. Configure Shopify Webhooks

In Shopify, create webhook subscriptions pointing to:

```text
https://YOUR_FIREBASE_HOSTING_DOMAIN/api/webhooks/shopify
```

Subscribe to:

- `customers/create`
- `draft_orders/create`
- `orders/create`

Required app scopes:

- `read_customers`
- `read_draft_orders`
- `read_orders`

If using the Shopify app configuration file, add subscriptions for the same topics and URI. If using the GraphQL Admin API, create equivalent `webhookSubscriptionCreate` subscriptions.

## 4. Smoke Test

Lead capture:

```bash
LEAD_CAPTURE_ENDPOINT="https://YOUR_FIREBASE_HOSTING_DOMAIN/api/leads/create" \
npm run test:capture
```

Webhook verification is best tested from Shopify because the HMAC must be generated over Shopify's exact raw request body. Use Shopify's webhook test delivery or create a test customer, draft order, and order in a development store.

Confirm in Firestore:

- `leads/{leadId}` has `shopifyCustomerId`, `shopifyDraftOrderIds`, or `shopifyOrderIds`.
- `leads/{leadId}/events` includes `shopify_synced` records.
- `deals` has proposal or won records linked to the lead.
- `integrations_log` has a processed Shopify entry.
- `shopify_webhook_deliveries/{X-Shopify-Webhook-Id}` exists for webhook deliveries.

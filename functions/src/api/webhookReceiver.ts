import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { ShopifyWebhookTopic } from '../types/shopify';

const db = admin.firestore();

/**
 * POST /api/webhooks/shopify
 *
 * Placeholder endpoint for Shopify webhooks.
 * Currently logs all incoming webhooks to integrations_log for audit purposes.
 *
 * Supported topics (future implementation):
 * - customers/create: Match to existing lead by email or create new lead
 * - orders/create: Link order to lead/deal, mark deal as "won"
 * - draft_orders/create: Link draft order to deal
 * - checkouts/create: Log checkout event on lead timeline
 * - carts/create: Log cart event (future)
 *
 * IMPORTANT: Before enabling in production:
 * 1. Add HMAC verification using verifyShopifyWebhook()
 * 2. Configure SHOPIFY_WEBHOOK_SECRET in Cloud Functions env
 * 3. Whitelist Shopify IP ranges
 */
export const shopifyWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const topic = req.headers['x-shopify-topic'] as ShopifyWebhookTopic | undefined;
    const shopDomain = req.headers['x-shopify-shop-domain'] as string | undefined;

    if (!topic) {
      res.status(400).json({ error: 'Missing x-shopify-topic header' });
      return;
    }

    // TODO: Verify HMAC signature in production
    // const hmac = req.headers['x-shopify-hmac-sha256'] as string;
    // const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
    // if (!verifyShopifyWebhook(req.rawBody, hmac, secret)) {
    //   res.status(401).json({ error: 'Invalid signature' });
    //   return;
    // }

    // Log the webhook to integrations_log
    const logRef = await db.collection('integrations_log').add({
      source: 'shopify',
      topic,
      payload: req.body || {},
      status: 'processed',
      leadId: null,
      error: null,
      metadata: {
        shopDomain,
        receivedAt: new Date().toISOString(),
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    functions.logger.info(`Shopify webhook received: ${topic} from ${shopDomain}, logged as ${logRef.id}`);

    // Future: Route by topic and process
    switch (topic) {
      case 'customers/create':
        // TODO: Match customer email to existing lead, or create new lead
        functions.logger.info('customers/create — placeholder, logged only');
        break;

      case 'orders/create':
        // TODO: Find lead by email, link order, mark deal as won
        functions.logger.info('orders/create — placeholder, logged only');
        break;

      case 'draft_orders/create':
        // TODO: Find lead, link draft order to deal
        functions.logger.info('draft_orders/create — placeholder, logged only');
        break;

      case 'checkouts/create':
        // TODO: Log checkout event on lead timeline
        functions.logger.info('checkouts/create — placeholder, logged only');
        break;

      case 'carts/create':
        // TODO: Log cart event on lead timeline
        functions.logger.info('carts/create — placeholder, logged only');
        break;

      default:
        functions.logger.warn(`Unknown Shopify webhook topic: ${topic}`);
    }

    // Always return 200 to acknowledge receipt
    res.status(200).json({ success: true, logId: logRef.id });
  } catch (error) {
    functions.logger.error('Error processing Shopify webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

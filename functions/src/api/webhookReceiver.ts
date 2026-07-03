import * as functions from 'firebase-functions';
import type { Request, Response } from 'firebase-functions/v1';
import { admin, db } from '../firebaseAdmin';
import { calculateSLADeadline } from '../lib/sla';
import { scoreLead } from '../lib/scoring';
import { verifyShopifyWebhook } from '../lib/shopify';
import { getAutoAssignee } from '../lib/autoAssign';
import {
  ShopifyCustomer,
  ShopifyDraftOrder,
  ShopifyOrder,
  ShopifyWebhookTopic,
} from '../types/shopify';
import { LeadFormData } from '../types/lead';

type LeadMatch = {
  ref: admin.firestore.DocumentReference;
  data: admin.firestore.DocumentData;
};

type WebhookResult = {
  leadId: string | null;
  shopifyCustomerId?: string | null;
  shopifyDraftOrderId?: string | null;
  shopifyOrderId?: string | null;
  action: string;
};

const SHOPIFY_TOPICS: ShopifyWebhookTopic[] = [
  'customers/create',
  'orders/create',
  'draft_orders/create',
];

function getWebhookSecret(): string | undefined {
  return process.env.SHOPIFY_WEBHOOK_SECRET || functions.config().shopify?.webhook_secret;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getRawBody(req: { rawBody?: Buffer }): Buffer {
  return req.rawBody || Buffer.from('');
}

function parsePayload(req: { body?: unknown; rawBody?: Buffer }): unknown {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }

  const rawBody = getRawBody(req);
  if (!rawBody || rawBody.length === 0) return {};
  return JSON.parse(rawBody.toString('utf8'));
}

function normalizeEmail(email?: string | null): string | null {
  const normalized = email?.trim().toLowerCase();
  return normalized || null;
}

function stringId(id?: number | string | null): string | null {
  if (id === undefined || id === null || id === '') return null;
  return String(id);
}

function parseMoney(value?: string | number | null): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const parsed = Number.parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function lineItemSummary(lineItems: Array<{ title?: string; quantity?: number }> = []): string {
  if (lineItems.length === 0) return 'Shopify item';
  return lineItems
    .slice(0, 3)
    .map((item) => `${item.quantity || 1}x ${item.title || 'Shopify item'}`)
    .join(', ');
}

function preferredAddress(customer?: ShopifyCustomer | null) {
  return customer?.default_address || customer?.addresses?.[0] || null;
}

function splitCustomerName(customer?: ShopifyCustomer | null, fallbackEmail?: string | null) {
  const emailName = fallbackEmail?.split('@')[0] || 'Shopify Customer';
  return {
    firstName: customer?.first_name || emailName,
    lastName: customer?.last_name || 'Lead',
  };
}

async function findLeadByShopifyCustomerId(customerId?: string | null): Promise<LeadMatch | null> {
  if (!customerId) return null;

  const snapshot = await db
    .collection('leads')
    .where('shopifyCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { ref: doc.ref, data: doc.data() };
}

async function findLeadByEmail(email?: string | null): Promise<LeadMatch | null> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const snapshot = await db
    .collection('leads')
    .where('email', '==', normalizedEmail)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { ref: doc.ref, data: doc.data() };
}

async function findLeadByShopifyDraftOrderId(draftOrderId?: string | null): Promise<LeadMatch | null> {
  if (!draftOrderId) return null;

  const arraySnapshot = await db
    .collection('leads')
    .where('shopifyDraftOrderIds', 'array-contains', draftOrderId)
    .limit(1)
    .get();

  if (!arraySnapshot.empty) {
    const doc = arraySnapshot.docs[0];
    return { ref: doc.ref, data: doc.data() };
  }

  const scalarSnapshot = await db
    .collection('leads')
    .where('shopifyDraftOrderId', '==', draftOrderId)
    .limit(1)
    .get();

  if (scalarSnapshot.empty) return null;
  const doc = scalarSnapshot.docs[0];
  return { ref: doc.ref, data: doc.data() };
}

async function findLeadForCustomer(customer: ShopifyCustomer): Promise<LeadMatch | null> {
  const customerId = stringId(customer.id);
  return (
    (await findLeadByShopifyCustomerId(customerId)) ||
    (await findLeadByEmail(customer.email))
  );
}

async function findLeadForOrder(order: ShopifyOrder): Promise<LeadMatch | null> {
  const customerId = stringId(order.customer?.id);
  return (
    (await findLeadByShopifyCustomerId(customerId)) ||
    (await findLeadByEmail(order.email || order.customer?.email))
  );
}

async function findLeadForDraftOrder(draftOrder: ShopifyDraftOrder): Promise<LeadMatch | null> {
  const customerId = stringId(draftOrder.customer?.id);
  const draftOrderId = stringId(draftOrder.id);
  return (
    (await findLeadByShopifyDraftOrderId(draftOrderId)) ||
    (await findLeadByShopifyCustomerId(customerId)) ||
    (await findLeadByEmail(draftOrder.email || draftOrder.customer?.email))
  );
}

function createLeadInputFromCustomer(customer: ShopifyCustomer): LeadFormData {
  const email = normalizeEmail(customer.email) || `shopify-customer-${customer.id}@noemail.garageautosupplies.local`;
  const address = preferredAddress(customer);
  const { firstName, lastName } = splitCustomerName(customer, email);

  return {
    firstName,
    lastName,
    email,
    phone: customer.phone || address?.phone || undefined,
    company: address?.company || undefined,
    deliveryZip: address?.zip || undefined,
    productCategory: 'Other Heavy Equipment',
    quantity: 1,
    targetBudget: '$0',
    projectDetails: customer.note || 'Created from Shopify customer webhook.',
    source: { utm_source: 'shopify', utm_medium: 'webhook' },
    formType: 'contact',
  };
}

function createLeadInputFromOrder(order: ShopifyOrder): LeadFormData {
  const email = normalizeEmail(order.email || order.customer?.email) || `shopify-order-${order.id}@noemail.garageautosupplies.local`;
  const address = preferredAddress(order.customer);
  const { firstName, lastName } = splitCustomerName(order.customer, email);
  const totalQuantity = order.line_items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 1;

  return {
    firstName,
    lastName,
    email,
    phone: order.customer?.phone || address?.phone || undefined,
    company: address?.company || undefined,
    deliveryZip: address?.zip || undefined,
    productCategory: order.line_items?.[0]?.title || 'Other Heavy Equipment',
    quantity: totalQuantity,
    targetBudget: `${order.currency || 'USD'} ${order.total_price || '0'}`,
    projectDetails: `Shopify order ${order.name || order.id}: ${lineItemSummary(order.line_items)}.${order.note ? ` Note: ${order.note}` : ''}`,
    source: {
      utm_source: 'shopify',
      utm_medium: 'webhook',
      landing_page: order.landing_site || undefined,
      referrer: order.referring_site || undefined,
    },
    formType: 'quote',
  };
}

function createLeadInputFromDraftOrder(draftOrder: ShopifyDraftOrder): LeadFormData {
  const email = normalizeEmail(draftOrder.email || draftOrder.customer?.email) || `shopify-draft-${draftOrder.id}@noemail.garageautosupplies.local`;
  const address = preferredAddress(draftOrder.customer);
  const { firstName, lastName } = splitCustomerName(draftOrder.customer, email);
  const totalQuantity = draftOrder.line_items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 1;

  return {
    firstName,
    lastName,
    email,
    phone: draftOrder.customer?.phone || address?.phone || undefined,
    company: address?.company || undefined,
    deliveryZip: address?.zip || undefined,
    productCategory: draftOrder.line_items?.[0]?.title || 'Other Heavy Equipment',
    quantity: totalQuantity,
    targetBudget: `${draftOrder.currency || 'USD'} ${draftOrder.total_price || '0'}`,
    projectDetails: `Shopify draft order ${draftOrder.name || draftOrder.id}: ${lineItemSummary(draftOrder.line_items)}.${draftOrder.note ? ` Note: ${draftOrder.note}` : ''}`,
    source: { utm_source: 'shopify', utm_medium: 'webhook' },
    formType: 'quote',
  };
}

async function createLeadFromInput(input: LeadFormData, extra: Record<string, unknown>): Promise<LeadMatch> {
  const { score, scoreBreakdown, tier, scoreReasons } = scoreLead(input);
  const now = new Date();
  const slaDeadline = calculateSLADeadline(now, tier);
  const leadRef = db.collection('leads').doc();

  // Auto-assign to least-busy sales rep
  const assignedTo = await getAutoAssignee();

  await leadRef.set({
    ...input,
    email: normalizeEmail(input.email),
    score,
    scoreBreakdown,
    scoreReasons,
    tier,
    stage: 'new',
    assignedTo,
    slaDeadline: admin.firestore.Timestamp.fromDate(slaDeadline),
    slaStatus: 'ok',
    contactedAt: null,
    shopifyCustomerId: null,
    shopifyCustomerGid: null,
    shopifyDraftOrderId: null,
    shopifyDraftOrderIds: [],
    shopifyOrderId: null,
    shopifyOrderIds: [],
    shopifyShopDomain: null,
    aiSummary: null,
    aiNextAction: null,
    tags: ['shopify'],
    ...extra,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await leadRef.collection('events').add({
    type: 'created',
    description: `New Shopify lead created for ${input.firstName} ${input.lastName}`,
    metadata: { score, tier, source: 'shopify', assignedTo, ...extra },
    createdBy: 'system',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const created = await leadRef.get();
  return { ref: leadRef, data: created.data() || {} };
}

async function addLeadEvent(
  leadRef: admin.firestore.DocumentReference,
  description: string,
  metadata: Record<string, unknown>,
) {
  await leadRef.collection('events').add({
    type: 'shopify_synced',
    description,
    metadata,
    createdBy: 'system',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function upsertDealForLead(params: {
  lead: LeadMatch;
  title: string;
  value: number;
  stage: 'proposal' | 'closed_won';
  probability: number;
  shopifyDraftOrderId?: string | null;
  shopifyOrderId?: string | null;
  notes: string;
}) {
  const existingByLead = await db
    .collection('deals')
    .where('leadId', '==', params.lead.ref.id)
    .limit(1)
    .get();

  const updates = {
    title: params.title,
    leadId: params.lead.ref.id,
    contactName: `${params.lead.data.firstName || ''} ${params.lead.data.lastName || ''}`.trim(),
    value: params.value,
    stage: params.stage,
    probability: params.probability,
    assignedTo: params.lead.data.assignedTo || 'system',
    expectedCloseDate: null,
    notes: params.notes,
    shopifyDraftOrderId: params.shopifyDraftOrderId || null,
    shopifyOrderId: params.shopifyOrderId || null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (existingByLead.empty) {
    await db.collection('deals').add({
      ...updates,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return;
  }

  await existingByLead.docs[0].ref.set(updates, { merge: true });
}

async function processCustomerCreate(customer: ShopifyCustomer, shopDomain?: string): Promise<WebhookResult> {
  const shopifyCustomerId = stringId(customer.id);
  let lead = await findLeadForCustomer(customer);
  let action = 'linked_customer_to_existing_lead';

  if (!lead) {
    lead = await createLeadFromInput(createLeadInputFromCustomer(customer), {
      shopifyCustomerId,
      shopifyCustomerGid: customer.admin_graphql_api_id || null,
      shopifyShopDomain: shopDomain || null,
    });
    action = 'created_lead_from_customer';
  }

  await lead.ref.set({
    email: normalizeEmail(customer.email) || lead.data.email,
    firstName: customer.first_name || lead.data.firstName,
    lastName: customer.last_name || lead.data.lastName,
    phone: customer.phone || lead.data.phone || null,
    shopifyCustomerId,
    shopifyCustomerGid: customer.admin_graphql_api_id || lead.data.shopifyCustomerGid || null,
    shopifyShopDomain: shopDomain || lead.data.shopifyShopDomain || null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  await addLeadEvent(lead.ref, `Shopify customer ${shopifyCustomerId} synced`, {
    shopifyCustomerId,
    shopifyShopDomain: shopDomain,
  });

  return { leadId: lead.ref.id, shopifyCustomerId, action };
}

async function processDraftOrderCreate(draftOrder: ShopifyDraftOrder, shopDomain?: string): Promise<WebhookResult> {
  const shopifyDraftOrderId = stringId(draftOrder.id);
  const shopifyCustomerId = stringId(draftOrder.customer?.id);
  let lead = await findLeadForDraftOrder(draftOrder);
  let action = 'linked_draft_order_to_existing_lead';

  if (!lead) {
    lead = await createLeadFromInput(createLeadInputFromDraftOrder(draftOrder), {
      shopifyCustomerId,
      shopifyDraftOrderId,
      shopifyDraftOrderIds: shopifyDraftOrderId ? [shopifyDraftOrderId] : [],
      shopifyShopDomain: shopDomain || null,
    });
    action = 'created_lead_from_draft_order';
  }

  await lead.ref.set({
    stage: 'quoted',
    shopifyCustomerId: shopifyCustomerId || lead.data.shopifyCustomerId || null,
    shopifyDraftOrderId,
    shopifyDraftOrderIds: shopifyDraftOrderId
      ? admin.firestore.FieldValue.arrayUnion(shopifyDraftOrderId)
      : lead.data.shopifyDraftOrderIds || [],
    shopifyShopDomain: shopDomain || lead.data.shopifyShopDomain || null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  const value = parseMoney(draftOrder.total_price);
  await upsertDealForLead({
    lead,
    title: `Shopify draft order ${draftOrder.name || shopifyDraftOrderId}`,
    value,
    stage: 'proposal',
    probability: 30,
    shopifyDraftOrderId,
    notes: lineItemSummary(draftOrder.line_items),
  });

  await addLeadEvent(lead.ref, `Shopify draft order ${draftOrder.name || shopifyDraftOrderId} synced`, {
    shopifyDraftOrderId,
    shopifyCustomerId,
    status: draftOrder.status,
    totalPrice: draftOrder.total_price,
    currency: draftOrder.currency,
    shopifyShopDomain: shopDomain,
  });

  return { leadId: lead.ref.id, shopifyCustomerId, shopifyDraftOrderId, action };
}

async function processOrderCreate(order: ShopifyOrder, shopDomain?: string): Promise<WebhookResult> {
  const shopifyOrderId = stringId(order.id);
  const shopifyCustomerId = stringId(order.customer?.id);
  let lead = await findLeadForOrder(order);
  let action = 'linked_order_to_existing_lead';

  if (!lead) {
    lead = await createLeadFromInput(createLeadInputFromOrder(order), {
      shopifyCustomerId,
      shopifyOrderId,
      shopifyOrderIds: shopifyOrderId ? [shopifyOrderId] : [],
      shopifyShopDomain: shopDomain || null,
    });
    action = 'created_lead_from_order';
  }

  const wonRevenue = parseMoney(order.total_price);
  await lead.ref.set({
    stage: 'won',
    shopifyCustomerId: shopifyCustomerId || lead.data.shopifyCustomerId || null,
    shopifyOrderId,
    shopifyOrderIds: shopifyOrderId
      ? admin.firestore.FieldValue.arrayUnion(shopifyOrderId)
      : lead.data.shopifyOrderIds || [],
    shopifyShopDomain: shopDomain || lead.data.shopifyShopDomain || null,
    wonRevenue,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  await upsertDealForLead({
    lead,
    title: `Shopify order ${order.name || shopifyOrderId}`,
    value: wonRevenue,
    stage: 'closed_won',
    probability: 100,
    shopifyOrderId,
    notes: lineItemSummary(order.line_items),
  });

  await addLeadEvent(lead.ref, `Shopify order ${order.name || shopifyOrderId} marked won`, {
    shopifyOrderId,
    shopifyCustomerId,
    financialStatus: order.financial_status,
    fulfillmentStatus: order.fulfillment_status,
    totalPrice: order.total_price,
    currency: order.currency,
    shopifyShopDomain: shopDomain,
  });

  return { leadId: lead.ref.id, shopifyCustomerId, shopifyOrderId, action };
}

async function processWebhook(topic: ShopifyWebhookTopic, payload: unknown, shopDomain?: string): Promise<WebhookResult> {
  switch (topic) {
    case 'customers/create':
      return processCustomerCreate(payload as ShopifyCustomer, shopDomain);
    case 'draft_orders/create':
      return processDraftOrderCreate(payload as ShopifyDraftOrder, shopDomain);
    case 'orders/create':
      return processOrderCreate(payload as ShopifyOrder, shopDomain);
    default:
      return { leadId: null, action: 'ignored_unsupported_topic' };
  }
}

/**
 * POST /shopifyWebhook
 *
 * Handles Shopify customers/create, draft_orders/create, and orders/create.
 * Verifies X-Shopify-Hmac-SHA256 against SHOPIFY_WEBHOOK_SECRET before parsing.
 */
export const shopifyWebhookHandler = async (req: Request, res: Response): Promise<void> => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const topic = headerValue(req.headers['x-shopify-topic']) as ShopifyWebhookTopic | undefined;
  const shopDomain = headerValue(req.headers['x-shopify-shop-domain']);
  const hmac = headerValue(req.headers['x-shopify-hmac-sha256']);
  const webhookId = headerValue(req.headers['x-shopify-webhook-id']);
  const eventId = headerValue(req.headers['x-shopify-event-id']);

  if (!topic || !SHOPIFY_TOPICS.includes(topic)) {
    res.status(400).json({ error: 'Unsupported or missing x-shopify-topic header' });
    return;
  }

  const isValid = verifyShopifyWebhook(getRawBody(req as { rawBody?: Buffer }), hmac, getWebhookSecret());
  if (!isValid) {
    functions.logger.warn('Rejected Shopify webhook with invalid HMAC', { topic, shopDomain, webhookId });
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  const deliveryRef = webhookId
    ? db.collection('shopify_webhook_deliveries').doc(webhookId)
    : db.collection('shopify_webhook_deliveries').doc();

  try {
    if (webhookId) {
      await deliveryRef.create({
        source: 'shopify',
        topic,
        shopDomain: shopDomain || null,
        eventId: eventId || null,
        status: 'processing',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  } catch (error: any) {
    if (error.code === 6 || error.code === 'already-exists') {
      res.status(200).json({ success: true, duplicate: true });
      return;
    }
    throw error;
  }

  let logRef: admin.firestore.DocumentReference | null = null;

  try {
    const payload = parsePayload(req);
    const result = await processWebhook(topic, payload, shopDomain);

    logRef = await db.collection('integrations_log').add({
      source: 'shopify',
      topic,
      payload,
      status: 'processed',
      leadId: result.leadId,
      error: null,
      metadata: {
        action: result.action,
        shopDomain: shopDomain || null,
        webhookId: webhookId || null,
        eventId: eventId || null,
        shopifyCustomerId: result.shopifyCustomerId || null,
        shopifyDraftOrderId: result.shopifyDraftOrderId || null,
        shopifyOrderId: result.shopifyOrderId || null,
        receivedAt: new Date().toISOString(),
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await deliveryRef.set({
      status: 'processed',
      leadId: result.leadId,
      logId: logRef.id,
      result,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    functions.logger.info('Shopify webhook processed', { topic, shopDomain, webhookId, ...result });
    res.status(200).json({ success: true, logId: logRef.id, ...result });
  } catch (error: any) {
    functions.logger.error('Error processing Shopify webhook:', error);

    logRef = await db.collection('integrations_log').add({
      source: 'shopify',
      topic,
      payload: req.body || {},
      status: 'error',
      leadId: null,
      error: error.message || 'Unknown error',
      metadata: {
        shopDomain: shopDomain || null,
        webhookId: webhookId || null,
        eventId: eventId || null,
        receivedAt: new Date().toISOString(),
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await deliveryRef.set({
      status: 'error',
      logId: logRef.id,
      error: error.message || 'Unknown error',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.status(500).json({ error: 'Internal server error' });
  }
};

export const shopifyWebhook = functions.https.onRequest(shopifyWebhookHandler);

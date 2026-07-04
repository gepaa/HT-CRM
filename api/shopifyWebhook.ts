
import { supabase } from '../lib/supabaseAdmin';
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
  id: string;
  data: Record<string, any>;
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

  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('shopify_customer_id', customerId)
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return { id: data[0].id, data: data[0] };
}

async function findLeadByEmail(email?: string | null): Promise<LeadMatch | null> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('email', normalizedEmail)
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return { id: data[0].id, data: data[0] };
}

async function findLeadByShopifyDraftOrderId(draftOrderId?: string | null): Promise<LeadMatch | null> {
  if (!draftOrderId) return null;

  const { data: arrayData } = await supabase
    .from('leads')
    .select('*')
    .contains('shopify_draft_order_ids', [draftOrderId])
    .limit(1);

  if (arrayData && arrayData.length > 0) {
    return { id: arrayData[0].id, data: arrayData[0] };
  }

  const { data: scalarData } = await supabase
    .from('leads')
    .select('*')
    .eq('shopify_draft_order_id', draftOrderId)
    .limit(1);

  if (!scalarData || scalarData.length === 0) return null;
  return { id: scalarData[0].id, data: scalarData[0] };
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
  const nowIso = now.toISOString();
  const slaDeadline = calculateSLADeadline(now, tier);
  const slaIso = slaDeadline.toISOString();

  // Auto-assign to least-busy sales rep
  const assignedTo = await getAutoAssignee();

  const productTitle = input.productTitle || `${input.quantity || 1}x ${input.productCategory}`;

  const leadRow: Record<string, any> = {
    first_name: input.firstName,
    last_name: input.lastName,
    email: normalizeEmail(input.email),
    phone: input.phone || null,
    company: input.company || null,
    delivery_zip: input.deliveryZip || null,
    product_category: input.productCategory,
    product_title: productTitle,
    quantity: input.quantity || 1,
    target_budget: input.targetBudget,
    timeline: input.timeline || null,
    project_details: input.projectDetails || null,
    source: input.source || {},
    form_type: input.formType,
    score,
    lead_score: score,
    score_breakdown: scoreBreakdown,
    tier,
    stage: 'new',
    status: 'new',
    assigned_to: assignedTo,
    sla_deadline: slaIso,
    sla_deadline_at: slaIso,
    sla_status: 'ok',
    contacted_at: null,
    last_contacted_at: null,
    is_overdue: false,
    shopify_customer_id: (extra.shopifyCustomerId as string) || null,
    shopify_customer_gid: (extra.shopifyCustomerGid as string) || null,
    shopify_draft_order_id: (extra.shopifyDraftOrderId as string) || null,
    shopify_draft_order_ids: Array.isArray(extra.shopifyDraftOrderIds) ? extra.shopifyDraftOrderIds : [],
    shopify_order_id: (extra.shopifyOrderId as string) || null,
    shopify_order_ids: Array.isArray(extra.shopifyOrderIds) ? extra.shopifyOrderIds : [],
    shopify_shop_domain: (extra.shopifyShopDomain as string) || null,
    ai_summary: null,
    ai_next_action: null,
    tags: ['shopify'],
    created_at: nowIso,
    updated_at: nowIso,
  };

  const { data: inserted, error: insertErr } = await supabase
    .from('leads')
    .insert(leadRow)
    .select('*')
    .single();

  if (insertErr || !inserted) {
    console.error('Error inserting Shopify lead into Supabase:', insertErr);
    throw new Error('Failed to insert lead into Supabase');
  }

  await supabase.from('lead_events').insert({
    lead_id: inserted.id,
    type: 'created',
    description: `New Shopify lead created for ${input.firstName} ${input.lastName}`,
    metadata: { score, tier, source: 'shopify', assignedTo, ...extra },
    created_by: 'system',
    created_at: nowIso,
  });

  return { id: inserted.id, data: inserted };
}

async function addLeadEvent(
  lead: LeadMatch,
  description: string,
  metadata: Record<string, unknown>,
) {
  await supabase.from('lead_events').insert({
    lead_id: lead.id,
    type: 'shopify_synced',
    description,
    metadata,
    created_by: 'system',
    created_at: new Date().toISOString(),
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
  const nowIso = new Date().toISOString();
  const { data: existingByLead } = await supabase
    .from('deals')
    .select('id')
    .eq('lead_id', params.lead.id)
    .limit(1);

  const contactName = `${params.lead.data.first_name || params.lead.data.firstName || ''} ${params.lead.data.last_name || params.lead.data.lastName || ''}`.trim();

  if (!existingByLead || existingByLead.length === 0) {
    await supabase.from('deals').insert({
      title: params.title,
      lead_id: params.lead.id,
      contact_name: contactName,
      value: params.value,
      stage: params.stage,
      probability: params.probability,
      assigned_to: params.lead.data.assigned_to || params.lead.data.assignedTo || 'system',
      expected_close_date: null,
      notes: params.notes,
      created_at: nowIso,
      updated_at: nowIso,
    });
    return;
  }

  await supabase
    .from('deals')
    .update({
      title: params.title,
      value: params.value,
      stage: params.stage,
      probability: params.probability,
      notes: params.notes,
      updated_at: nowIso,
    })
    .eq('id', existingByLead[0].id);
}

async function processCustomerCreate(customer: ShopifyCustomer, shopDomain?: string): Promise<WebhookResult> {
  const shopifyCustomerId = stringId(customer.id);
  let lead = await findLeadForCustomer(customer);
  let action = 'linked_customer_to_existing_lead';
  const nowIso = new Date().toISOString();

  if (!lead) {
    lead = await createLeadFromInput(createLeadInputFromCustomer(customer), {
      shopifyCustomerId,
      shopifyCustomerGid: customer.admin_graphql_api_id || null,
      shopifyShopDomain: shopDomain || null,
    });
    action = 'created_lead_from_customer';
  }

  await supabase
    .from('leads')
    .update({
      email: normalizeEmail(customer.email) || lead.data.email,
      first_name: customer.first_name || lead.data.first_name || lead.data.firstName,
      last_name: customer.last_name || lead.data.last_name || lead.data.lastName,
      phone: customer.phone || lead.data.phone || null,
      shopify_customer_id: shopifyCustomerId,
      shopify_customer_gid: customer.admin_graphql_api_id || lead.data.shopify_customer_gid || lead.data.shopifyCustomerGid || null,
      shopify_shop_domain: shopDomain || lead.data.shopify_shop_domain || lead.data.shopifyShopDomain || null,
      updated_at: nowIso,
    })
    .eq('id', lead.id);

  await addLeadEvent(lead, `Shopify customer ${shopifyCustomerId} synced`, {
    shopifyCustomerId,
    shopifyShopDomain: shopDomain,
  });

  return { leadId: lead.id, shopifyCustomerId, action };
}

async function processDraftOrderCreate(draftOrder: ShopifyDraftOrder, shopDomain?: string): Promise<WebhookResult> {
  const shopifyDraftOrderId = stringId(draftOrder.id);
  const shopifyCustomerId = stringId(draftOrder.customer?.id);
  let lead = await findLeadForDraftOrder(draftOrder);
  let action = 'linked_draft_order_to_existing_lead';
  const nowIso = new Date().toISOString();

  if (!lead) {
    lead = await createLeadFromInput(createLeadInputFromDraftOrder(draftOrder), {
      shopifyCustomerId,
      shopifyDraftOrderId,
      shopifyDraftOrderIds: shopifyDraftOrderId ? [shopifyDraftOrderId] : [],
      shopifyShopDomain: shopDomain || null,
    });
    action = 'created_lead_from_draft_order';
  }

  const existingIds: string[] = lead.data.shopify_draft_order_ids || lead.data.shopifyDraftOrderIds || [];
  const newIds = shopifyDraftOrderId && !existingIds.includes(shopifyDraftOrderId)
    ? [...existingIds, shopifyDraftOrderId]
    : existingIds;

  await supabase
    .from('leads')
    .update({
      stage: 'quoted',
      shopify_customer_id: shopifyCustomerId || lead.data.shopify_customer_id || lead.data.shopifyCustomerId || null,
      shopify_draft_order_id: shopifyDraftOrderId,
      shopify_draft_order_ids: newIds,
      shopify_shop_domain: shopDomain || lead.data.shopify_shop_domain || lead.data.shopifyShopDomain || null,
      updated_at: nowIso,
    })
    .eq('id', lead.id);

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

  await addLeadEvent(lead, `Shopify draft order ${draftOrder.name || shopifyDraftOrderId} synced`, {
    shopifyDraftOrderId,
    shopifyCustomerId,
    status: draftOrder.status,
    totalPrice: draftOrder.total_price,
    currency: draftOrder.currency,
    shopifyShopDomain: shopDomain,
  });

  return { leadId: lead.id, shopifyCustomerId, shopifyDraftOrderId, action };
}

async function processOrderCreate(order: ShopifyOrder, shopDomain?: string): Promise<WebhookResult> {
  const shopifyOrderId = stringId(order.id);
  const shopifyCustomerId = stringId(order.customer?.id);
  let lead = await findLeadForOrder(order);
  let action = 'linked_order_to_existing_lead';
  const nowIso = new Date().toISOString();

  if (!lead) {
    lead = await createLeadFromInput(createLeadInputFromOrder(order), {
      shopifyCustomerId,
      shopifyOrderId,
      shopifyOrderIds: shopifyOrderId ? [shopifyOrderId] : [],
      shopifyShopDomain: shopDomain || null,
    });
    action = 'created_lead_from_order';
  }

  const existingIds: string[] = lead.data.shopify_order_ids || lead.data.shopifyOrderIds || [];
  const newIds = shopifyOrderId && !existingIds.includes(shopifyOrderId)
    ? [...existingIds, shopifyOrderId]
    : existingIds;

  const wonRevenue = parseMoney(order.total_price);
  await supabase
    .from('leads')
    .update({
      stage: 'won',
      shopify_customer_id: shopifyCustomerId || lead.data.shopify_customer_id || lead.data.shopifyCustomerId || null,
      shopify_order_id: shopifyOrderId,
      shopify_order_ids: newIds,
      shopify_shop_domain: shopDomain || lead.data.shopify_shop_domain || lead.data.shopifyShopDomain || null,
      won_revenue: wonRevenue,
      updated_at: nowIso,
    })
    .eq('id', lead.id);

  await upsertDealForLead({
    lead,
    title: `Shopify order ${order.name || shopifyOrderId}`,
    value: wonRevenue,
    stage: 'closed_won',
    probability: 100,
    shopifyOrderId,
    notes: lineItemSummary(order.line_items),
  });

  await addLeadEvent(lead, `Shopify order ${order.name || shopifyOrderId} marked won`, {
    shopifyOrderId,
    shopifyCustomerId,
    financialStatus: order.financial_status,
    fulfillmentStatus: order.fulfillment_status,
    totalPrice: order.total_price,
    currency: order.currency,
    shopifyShopDomain: shopDomain,
  });

  return { leadId: lead.id, shopifyCustomerId, shopifyOrderId, action };
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
    console.warn('Rejected Shopify webhook with invalid HMAC', { topic, shopDomain, webhookId });
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  const nowIso = new Date().toISOString();
  const targetDeliveryId = webhookId || `wh_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  try {
    if (webhookId) {
      // Check if already processed or exists
      const { data: existingDelivery } = await supabase
        .from('shopify_webhook_deliveries')
        .select('id')
        .eq('id', webhookId)
        .limit(1);

      if (existingDelivery && existingDelivery.length > 0) {
        res.status(200).json({ success: true, duplicate: true });
        return;
      }

      await supabase.from('shopify_webhook_deliveries').insert({
        id: webhookId,
        source: 'shopify',
        topic,
        shop_domain: shopDomain || null,
        event_id: eventId || null,
        status: 'processing',
        created_at: nowIso,
        updated_at: nowIso,
      });
    }
  } catch (error: any) {
    console.warn('Error checking/creating delivery record:', error);
  }

  let logId: string | null = null;

  try {
    const payload = parsePayload(req);
    const result = await processWebhook(topic, payload, shopDomain);

    const { data: insertedLog } = await supabase
      .from('integrations_log')
      .insert({
        source: 'shopify',
        event: topic,
        topic,
        payload,
        status: 'processed',
        lead_id: result.leadId,
        error: null,
        metadata: {
          action: result.action,
          shopDomain: shopDomain || null,
          webhookId: webhookId || null,
          eventId: eventId || null,
          shopifyCustomerId: result.shopifyCustomerId || null,
          shopifyDraftOrderId: result.shopifyDraftOrderId || null,
          shopifyOrderId: result.shopifyOrderId || null,
          receivedAt: nowIso,
        },
        created_at: nowIso,
      })
      .select('id')
      .single();

    if (insertedLog) logId = insertedLog.id;

    await supabase
      .from('shopify_webhook_deliveries')
      .update({
        status: 'processed',
        processed_at: nowIso,
        log_id: logId,
        result,
        updated_at: nowIso,
      })
      .eq('id', targetDeliveryId);

    console.log('Shopify webhook processed', { topic, shopDomain, webhookId, ...result });
    res.status(200).json({ success: true, logId, ...result });
  } catch (error: any) {
    console.error('Error processing Shopify webhook:', error);

    const { data: errorLog } = await supabase
      .from('integrations_log')
      .insert({
        source: 'shopify',
        event: topic,
        topic,
        payload: req.body || {},
        status: 'error',
        lead_id: null,
        error: error.message || 'Unknown error',
        metadata: {
          shopDomain: shopDomain || null,
          webhookId: webhookId || null,
          eventId: eventId || null,
          receivedAt: new Date().toISOString(),
        },
        created_at: nowIso,
      })
      .select('id')
      .single();

    if (errorLog) logId = errorLog.id;

    await supabase
      .from('shopify_webhook_deliveries')
      .update({
        status: 'error',
        processed_at: nowIso,
        log_id: logId,
        error: error.message || 'Unknown error',
        updated_at: nowIso,
      })
      .eq('id', targetDeliveryId);

    res.status(500).json({ error: 'Internal server error' });
  }
};

export default async function handler(req: any, res: any) {
  return shopifyWebhookHandler(req, res);
}

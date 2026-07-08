import * as crypto from 'crypto';

/**
 * Verify Shopify webhook HMAC signature.
 * Uses the raw request body and the shared webhook secret.
 *
 * NOTE: This is a placeholder. In production, you need to:
 * 1. Configure your Shopify webhook secret in Cloud Functions config
 * 2. Ensure you have access to the raw request body (not parsed JSON)
 */
export function verifyShopifyWebhook(
  rawBody: string | Buffer,
  hmacHeader: string | undefined,
  secret: string | undefined,
): boolean {
  if (!hmacHeader || !secret) return false;

  const hash = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');

  const calculated = Buffer.from(hash, 'base64');
  const received = Buffer.from(hmacHeader, 'base64');

  if (calculated.length !== received.length) return false;
  return crypto.timingSafeEqual(calculated, received);
}

/**
 * Extract the Shopify webhook topic from the request headers.
 */
export function getShopifyWebhookTopic(headers: Record<string, string>): string | undefined {
  return headers['x-shopify-topic'];
}

/**
 * Extract the Shopify shop domain from the request headers.
 */
export function getShopifyShopDomain(headers: Record<string, string>): string | undefined {
  return headers['x-shopify-shop-domain'];
}

// ─────────────────────────────────────────────────────────────
// Attribution Helpers – Garage Auto Supplies CRM
// ─────────────────────────────────────────────────────────────

import type { LeadSource } from '../types/lead';

/**
 * Extract UTM and click-ID parameters from a URL search-params object
 * or a plain key-value record.
 */
export function parseAttribution(
  params: Record<string, string | undefined> | URLSearchParams,
): LeadSource {
  const get = (key: string): string | undefined => {
    if (params instanceof URLSearchParams) {
      return params.get(key) ?? undefined;
    }
    return params[key] ?? undefined;
  };

  return {
    utm_source: get('utm_source'),
    utm_medium: get('utm_medium'),
    utm_campaign: get('utm_campaign'),
    utm_term: get('utm_term'),
    utm_content: get('utm_content'),
    gclid: get('gclid'),
    fbclid: get('fbclid'),
    landing_page: get('landing_page') ?? get('lp'),
    referrer: get('referrer') ?? get('ref'),
  };
}

/**
 * Derive a human-readable source label from attribution data.
 */
export function getSourceLabel(source: LeadSource): string {
  const utmSource = (source.utm_source ?? '').toLowerCase();
  const utmMedium = (source.utm_medium ?? '').toLowerCase();

  if (source.gclid) return 'Google Ads (CPC)';

  if (utmSource === 'google' && utmMedium === 'cpc') return 'Google Ads (CPC)';
  if (utmSource === 'google') return 'Google Organic';

  if (source.fbclid) return 'Facebook Ads';
  if (utmSource === 'facebook' && utmMedium === 'cpc') return 'Facebook Ads';
  if (utmSource === 'facebook') return 'Facebook';

  if (utmSource === 'bing' && utmMedium === 'cpc') return 'Bing Ads';
  if (utmSource === 'bing') return 'Bing Organic';

  if (utmSource === 'email' || utmMedium === 'email') return 'Email Campaign';
  if (utmSource === 'newsletter') return 'Newsletter';

  if (source.referrer) return 'Referral';
  if (utmSource) return `${utmSource}${utmMedium ? ` (${utmMedium})` : ''}`;

  return 'Direct';
}

/**
 * Return the lucide-react icon name that best represents the traffic source.
 */
export function getSourceIcon(source: LeadSource): string {
  const label = getSourceLabel(source).toLowerCase();

  if (label.includes('google')) return 'search';
  if (label.includes('facebook')) return 'facebook';
  if (label.includes('bing')) return 'search';
  if (label.includes('email') || label.includes('newsletter')) return 'mail';
  if (label.includes('referral')) return 'share-2';
  if (label.includes('direct')) return 'globe';

  return 'link';
}

// ─────────────────────────────────────────────────────────────
// Vercel Serverless Endpoint: POST /api/google/uploadConversion
// ─────────────────────────────────────────────────────────────
import { supabase } from '../_lib/supabaseAdmin';

function formatGoogleAdsDateTime(date: Date): string {
  const pad = (num: number) => String(num).padStart(2, '0');
  const yyyy = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  
  const offset = -date.getTimezoneOffset();
  const diffSign = offset >= 0 ? '+' : '-';
  const absOffset = Math.abs(offset);
  const offsetHours = pad(Math.floor(absOffset / 60));
  const offsetMinutes = pad(absOffset % 60);

  return `${yyyy}-${MM}-${dd} ${hh}:${mm}:${ss}${diffSign}${offsetHours}:${offsetMinutes}`;
}

async function refreshAccessToken(clientId: string, clientSecret: string, refreshToken: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to refresh Google access token: ${text}`);
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    expires_in: data.expires_in,
  };
}

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const logId = `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const nowIso = new Date().toISOString();
  const { leadId, wonRevenue } = req.body || {};

  if (!leadId) {
    res.status(400).json({ error: 'Missing leadId in request body' });
    return;
  }

  try {
    // 1. Fetch Google Ads settings
    const { data: settingsData, error: settingsErr } = await supabase
      .from('settings')
      .select('value')
      .eq('id', 'global')
      .single();

    if (settingsErr || !settingsData) {
      throw new Error(`Failed to load system settings: ${settingsErr?.message}`);
    }

    const settings = settingsData.value || {};
    const googleAdsConfig = settings.integrations?.googleAds || {};

    if (!googleAdsConfig.enabled) {
      console.log('Google Ads integration is disabled. Skipping conversion upload.');
      res.status(200).json({ success: false, message: 'Google Ads integration is disabled.' });
      return;
    }

    // 2. Fetch Lead Details
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadErr || !lead) {
      throw new Error(`Failed to find lead with ID ${leadId}: ${leadErr?.message}`);
    }

    const source = lead.source || {};
    const gclid = lead.gclid || source.gclid;

    // If there is no GCLID, we cannot upload offline click conversions to Google Ads. Ignore.
    if (!gclid) {
      console.log(`Lead ${leadId} does not have a Google GCLID. Skipping conversion upload.`);
      
      await supabase.from('integrations_log').insert({
        id: logId,
        source: 'google_ads',
        topic: 'offline_conversion_upload',
        status: 'ignored',
        lead_id: leadId,
        payload: { leadId },
        metadata: { reason: 'Lead has no Google GCLID (offline tracking ID).' },
        created_at: nowIso,
      });

      res.status(200).json({ success: false, message: 'Skipped: Lead has no GCLID.' });
      return;
    }

    // Get value for conversion
    const conversionValue = typeof wonRevenue === 'number'
      ? wonRevenue
      : (typeof lead.won_revenue === 'number'
          ? lead.won_revenue
          : (typeof lead.estimated_deal_value === 'number' ? lead.estimated_deal_value : 0));

    // 3. Check for Simulation Mode
    const customerId = googleAdsConfig.customerId || '';
    const developerToken = googleAdsConfig.developerToken || '';
    const conversionAction = googleAdsConfig.conversionAction || 'Lead Conversion';

    const isSimulation = 
      !customerId || 
      customerId.startsWith('your_') || 
      !developerToken || 
      developerToken.startsWith('your_');

    if (isSimulation) {
      console.log(`[SIMULATION MODE] Simulating Google Ads offline conversion upload for GCLID: ${gclid}`);
      
      const payload = {
        conversions: [
          {
            gclid,
            conversionAction,
            conversionDateTime: formatGoogleAdsDateTime(new Date()),
            conversionValue,
            currencyCode: 'USD',
          }
        ],
        partialFailure: true
      };

      await supabase.from('integrations_log').insert({
        id: logId,
        source: 'google_ads',
        topic: 'offline_conversion_upload',
        status: 'processed',
        lead_id: leadId,
        payload,
        metadata: {
          simulation: true,
          message: 'Simulation: Google Ads credentials are not fully configured. Click conversion upload was simulated successfully.',
          customerId,
          conversionAction,
        },
        created_at: nowIso,
      });

      res.status(200).json({
        success: true,
        simulated: true,
        message: 'Successfully simulated offline conversion upload (credentials not configured).'
      });
      return;
    }

    // 4. Production Upload (Actual Google Ads API Call)
    const tokens = googleAdsConfig.tokens || {};
    let accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token;
    const expiryDate = tokens.expiry_date;

    if (!refreshToken) {
      throw new Error('Google Ads refresh token is missing. Please reconnect your Google account in Settings.');
    }

    // Refresh access token if expired (or within 5 minutes of expiry)
    if (!accessToken || !expiryDate || Date.now() > (expiryDate - 300000)) {
      console.log('Google access token is expired or expiring soon. Refreshing...');
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables');
      }
      
      const refreshResult = await refreshAccessToken(clientId, clientSecret, refreshToken);
      accessToken = refreshResult.access_token;
      
      // Update access token in database settings
      googleAdsConfig.tokens.access_token = accessToken;
      googleAdsConfig.tokens.expiry_date = Date.now() + (refreshResult.expires_in * 1000);
      
      const updatedVal = {
        ...settings,
        integrations: {
          ...settings.integrations,
          googleAds: googleAdsConfig,
        },
      };

      await supabase.from('settings').upsert({
        id: 'global',
        value: updatedVal,
        updated_at: new Date().toISOString(),
      });
      console.log('Google Ads access token refreshed and saved successfully.');
    }

    // Build the request payload
    // Clean Customer ID (remove hyphens as Google Ads API expects only numbers)
    const cleanCustomerId = customerId.replace(/-/g, '').trim();
    
    // Google Ads resource path for conversion action
    // If user provided resource name (starts with customers/), use as is. Otherwise construct standard path.
    const conversionActionPath = conversionAction.startsWith('customers/')
      ? conversionAction
      : `customers/${cleanCustomerId}/conversionActions/${conversionAction}`;

    const apiPayload = {
      conversions: [
        {
          gclid,
          conversionAction: conversionActionPath,
          conversionDateTime: formatGoogleAdsDateTime(new Date()),
          conversionValue,
          currencyCode: 'USD',
        }
      ],
      partialFailure: true
    };

    console.log(`Uploading click conversion to Google Ads API for GCLID ${gclid} and customer ${cleanCustomerId}...`);
    
    const apiResponse = await fetch(
      `https://googleads.googleapis.com/v17/customers/${cleanCustomerId}/offlineConversionUploads:uploadClickConversions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': developerToken,
        },
        body: JSON.stringify(apiPayload),
      }
    );

    const apiResponseData = await apiResponse.json();

    if (!apiResponse.ok) {
      console.error('Google Ads API conversion upload returned an error:', apiResponseData);
      throw new Error(`Google Ads API error: ${JSON.stringify(apiResponseData)}`);
    }

    // Check for partial failure inside successful HTTP response
    const partialFailureError = apiResponseData.partialFailureError;
    const hasError = partialFailureError && Object.keys(partialFailureError).length > 0;

    const finalStatus = hasError ? 'failed' : 'processed';
    const finalErrorMsg = hasError ? JSON.stringify(partialFailureError) : null;

    // Log to integrations_log
    await supabase.from('integrations_log').insert({
      id: logId,
      source: 'google_ads',
      topic: 'offline_conversion_upload',
      status: finalStatus,
      lead_id: leadId,
      payload: apiPayload,
      metadata: apiResponseData,
      error: finalErrorMsg,
      created_at: nowIso,
    });

    if (hasError) {
      throw new Error(`Google Ads partial failure: ${finalErrorMsg}`);
    }

    console.log('Google Ads offline conversion upload succeeded!');
    res.status(200).json({ success: true, details: apiResponseData });
  } catch (error: any) {
    console.error('Error uploading Google Ads offline conversion:', error);
    
    // Log failure to integrations_log
    try {
      await supabase.from('integrations_log').insert({
        id: logId,
        source: 'google_ads',
        topic: 'offline_conversion_upload',
        status: 'failed',
        lead_id: leadId,
        payload: { leadId },
        error: error.message || 'Unknown error occurred during upload',
        created_at: nowIso,
      });
    } catch (e) {
      console.error('Failed to write failure entry to integrations_log:', e);
    }

    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

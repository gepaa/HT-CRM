// ─────────────────────────────────────────────────────────────
// Vercel Serverless Endpoint: GET /api/google/callback
// ─────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabaseAdmin';

export default async function handler(req: any, res: any) {
  const host = req.headers.host || 'localhost:5173';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const frontendUrl = `${protocol}://${host}`;

  try {
    const { code, error: oauthError } = req.query || {};

    if (oauthError) {
      console.error('Google OAuth error from query:', oauthError);
      res.writeHead(302, { Location: `${frontendUrl}/settings?google=error&msg=${encodeURIComponent(String(oauthError))}` });
      res.end();
      return;
    }

    if (!code) {
      console.error('Missing code in Google OAuth callback');
      res.writeHead(302, { Location: `${frontendUrl}/settings?google=error&msg=Missing+authorization+code` });
      res.end();
      return;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables');
    }
    const redirectUri = `${protocol}://${host}/api/google/callback`;

    // Exchange auth code for tokens
    console.log('Exchanging auth code for Google tokens...');
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: String(code),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Google token exchange failed:', errorText);
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in, token_type, scope } = tokenData;

    // Calculate absolute token expiry timestamp
    const expiryDate = Date.now() + (Number(expires_in) * 1000);

    // Fetch user profile info (email)
    console.log('Fetching Google user profile info...');
    const userinfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    let email = 'unknown@google.com';
    if (userinfoResponse.ok) {
      const userData = await userinfoResponse.json();
      email = userData.email || email;
    } else {
      console.warn('Failed to fetch Google user info, continuing anyway');
    }

    // Load global settings
    console.log('Fetching global CRM settings...');
    const { data: currentSettingsData, error: fetchErr } = await supabase
      .from('settings')
      .select('value')
      .eq('id', 'global')
      .single();

    if (fetchErr) {
      console.error('Error fetching global settings from database:', fetchErr);
      throw fetchErr;
    }

    const currentVal = currentSettingsData?.value || {};
    const integrations = currentVal.integrations || {};
    const existingGoogleAds = integrations.googleAds || {};

    // Build the updated googleAds integration object.
    // Retain existing offline-conversion config properties (like customerId and developerToken) if they exist.
    const updatedGoogleAds = {
      ...existingGoogleAds,
      enabled: true,
      email,
      connectedAt: new Date().toISOString(),
      tokens: {
        access_token,
        refresh_token: refresh_token || existingGoogleAds.tokens?.refresh_token || null, // refresh_token is only returned on prompt=consent
        expiry_date: expiryDate,
        token_type,
        scope,
      },
    };

    const updatedVal = {
      ...currentVal,
      integrations: {
        ...integrations,
        googleAds: updatedGoogleAds,
      },
    };

    // Save back to database
    console.log('Saving Google account connection to Supabase settings table...');
    const { error: upsertErr } = await supabase.from('settings').upsert({
      id: 'global',
      value: updatedVal,
      updated_at: new Date().toISOString(),
    });

    if (upsertErr) {
      console.error('Failed to save Google account tokens to settings:', upsertErr);
      throw upsertErr;
    }

    console.log(`Successfully connected Google account ${email}`);
    res.writeHead(302, { Location: `${frontendUrl}/settings?google=connected` });
    res.end();
  } catch (error: any) {
    console.error('Error in /api/google/callback:', error);
    res.writeHead(302, { Location: `${frontendUrl}/settings?google=error&msg=${encodeURIComponent(error.message || 'Internal Server Error')}` });
    res.end();
  }
}

// ─────────────────────────────────────────────────────────────
// Vercel Serverless Endpoint: GET/POST /api/google/auth
// ─────────────────────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const host = req.headers.host || 'localhost:5173';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const redirectUri = `${protocol}://${host}/api/google/callback`;

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error('Missing GOOGLE_CLIENT_ID environment variable');
    }
    const scopes = [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/adwords'
    ].join(' ');

    const authUrl = `https://accounts.google.com/o/oauth2/auth?` +
      `client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&access_type=offline` +
      `&prompt=consent`;

    console.log('Redirecting to Google OAuth:', authUrl);

    res.writeHead(302, { Location: authUrl });
    res.end();
  } catch (error: any) {
    console.error('Error in /api/google/auth:', error);
    res.status(500).json({ error: error.message || 'Failed to initialize Google authorization' });
  }
}

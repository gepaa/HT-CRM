// ─────────────────────────────────────────────────────────────
// Vercel Serverless Endpoint: POST /api/ai/gemini
// ─────────────────────────────────────────────────────────────
import { analyzeLeadWithGemini, draftQuoteEmailWithGemini } from '../lib/gemini';

export default async function handler(req: any, res: any) {
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

  try {
    const { action, lead } = req.body || {};

    if (!lead) {
      res.status(400).json({ error: 'Missing lead data in request body' });
      return;
    }

    if (action === 'analyze_lead') {
      const result = await analyzeLeadWithGemini(lead);
      res.status(200).json({ success: true, ...result });
      return;
    }

    if (action === 'draft_email') {
      const emailDraft = await draftQuoteEmailWithGemini(lead);
      res.status(200).json({ success: true, emailDraft });
      return;
    }

    res.status(400).json({ error: 'Invalid action. Must be analyze_lead or draft_email' });
  } catch (error: any) {
    console.error('Error in /api/ai/gemini:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

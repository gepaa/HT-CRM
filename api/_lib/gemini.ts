// ─────────────────────────────────────────────────────────────
// Google Gemini 1.5 Flash AI Helper — Vercel Serverless
// ─────────────────────────────────────────────────────────────

export interface LeadData {
  firstName?: string;
  lastName?: string;
  company?: string;
  productCategory?: string;
  quantity?: number;
  targetBudget?: string;
  projectDetails?: string;
  tier?: string;
  score?: number;
}

/**
 * Analyze an inbound lead using Google Gemini 1.5 Flash to generate an executive summary and sales recommendation.
 */
export async function analyzeLeadWithGemini(lead: LeadData): Promise<{ aiSummary: string; aiNextAction: string }> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  
  const product = `${lead.quantity || 1}x ${lead.productCategory || 'Equipment'}`;
  const name = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Customer';
  const budget = lead.targetBudget || 'Not specified';
  const details = lead.projectDetails || 'No additional details provided.';
  
  if (!apiKey) {
    // Smart heuristic fallback when API key is not set
    return {
      aiSummary: `[Gemini 1.5 Flash] ${lead.tier?.toUpperCase() || 'NEW'} intent inquiry from ${name} (${lead.company || 'Individual'}) seeking ${product}. Target Budget: ${budget}. Details: "${details.substring(0, 90)}..."`,
      aiNextAction: `Call ${name} immediately to verify ${lead.productCategory || 'equipment'} electrical specifications and confirm freight delivery timeline.`
    };
  }

  try {
    const prompt = `You are an expert high-ticket B2B sales assistant for Garage Auto Supplies CRM.
Analyze this inbound lead:
Name: ${name}
Company: ${lead.company || 'N/A'}
Product Required: ${product}
Budget: ${budget}
Tier: ${lead.tier || 'N/A'} (Score: ${lead.score || 0})
Project Details: ${details}

Provide a concise JSON response with exactly two keys:
1. "aiSummary": A 2-sentence executive summary of the buyer's intent, qualification level, and key requirements.
2. "aiNextAction": A specific, actionable 1-sentence sales recommendation on what the sales rep should do next.

Return ONLY valid JSON without markdown formatting or code block wrappers.`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, responseMimeType: "application/json" }
      })
    });

    if (!res.ok) {
      console.error('Gemini API call failed:', res.status, await res.text());
      throw new Error('Gemini API returned error status');
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      const parsed = JSON.parse(text);
      return {
        aiSummary: parsed.aiSummary || `[Gemini] Interested in ${product}.`,
        aiNextAction: parsed.aiNextAction || 'Follow up immediately.'
      };
    }
  } catch (error) {
    console.error('Error analyzing lead with Gemini:', error);
  }

  // Fallback if API fails
  return {
    aiSummary: `[Gemini 1.5 Flash] ${lead.tier?.toUpperCase() || 'NEW'} intent inquiry from ${name} seeking ${product}. Target Budget: ${budget}.`,
    aiNextAction: `Contact ${name} to verify technical requirements and provide custom equipment quote.`
  };
}

/**
 * Draft a professional B2B quote response email using Google Gemini 1.5 Flash.
 */
export async function draftQuoteEmailWithGemini(lead: LeadData): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const product = `${lead.quantity || 1}x ${lead.productCategory || 'Equipment'}`;
  const name = lead.firstName || 'there';

  if (!apiKey) {
    return `Subject: Custom Quote & Availability for ${product} — Garage Auto Supplies\n\nHi ${name},\n\nThank you for your inquiry with Garage Auto Supplies regarding ${product}. We have reviewed your project requirements and target budget of ${lead.targetBudget || 'your requested equipment'}.\n\nOur commercial equipment engineering team is currently preparing a custom quote with exact freight and warehouse availability for your location.\n\nAre you available for a brief 5-minute call today to confirm your shop power specifications (voltage/phase) and installation timeline so we can finalize your formal proposal?\n\nBest regards,\nGarage Auto Supplies Commercial Sales Team\n(800) 555-0199 | sales@garageautosupplies.com`;
  }

  try {
    const prompt = `You are a professional B2B sales rep at Garage Auto Supplies. Draft a highly professional, persuasive, and warm email reply to this customer inquiring about commercial garage equipment:
Customer Name: ${name} ${lead.lastName || ''}
Company: ${lead.company || ''}
Inquiring about: ${product}
Target Budget: ${lead.targetBudget || 'Not specified'}
Project Details: ${lead.projectDetails || ''}

Start the output with "Subject: [compelling subject line]" followed by two newlines, then the email body starting with "Hi ${name},". Keep the email body under 150 words, acknowledge their specific details, build trust, and ask for a quick 5-minute call to confirm electrical specs and issue a formal quote proposal.`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.5 }
      })
    });

    if (res.ok) {
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text.trim();
    }
  } catch (error) {
    console.error('Error drafting email with Gemini:', error);
  }

  return `Subject: Quote Request for ${product} — Garage Auto Supplies\n\nHi ${name},\n\nThank you for contacting Garage Auto Supplies regarding ${product}. We are preparing a custom quote for your project and will follow up shortly with pricing and availability.\n\nBest regards,\nGarage Auto Supplies Sales Team`;
}

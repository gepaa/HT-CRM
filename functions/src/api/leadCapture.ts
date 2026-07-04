import * as functions from 'firebase-functions';
import type { Request, Response } from 'firebase-functions/v1';
import cors from 'cors';
import { supabase } from '../lib/supabaseAdmin';
import { leadFormDataSchema } from '../lib/validation';
import { scoreLead } from '../lib/scoring';
import { calculateSLADeadline } from '../lib/sla';
import { getAutoAssignee } from '../lib/autoAssign';

// ── CORS configuration ─────────────────────────────────────────
// Allowed origins are sourced (in priority order) from:
//   1. LEAD_CAPTURE_ALLOWED_ORIGINS env var (comma-separated)
//   2. Firebase Functions config: lead_capture.allowed_origins
//   3. Emulator fallback: allow all (localhost)
//
// Set in production via:
//   firebase functions:config:set lead_capture.allowed_origins="https://store.myshopify.com,https://project.web.app"
// OR set the env var LEAD_CAPTURE_ALLOWED_ORIGINS before deployment.
function buildAllowedOrigins(): string[] | true {
  const raw: string =
    process.env.LEAD_CAPTURE_ALLOWED_ORIGINS ||
    (functions.config()?.lead_capture?.allowed_origins as string | undefined) ||
    '';

  // In emulator / local dev: allow all origins
  if (!raw || process.env.FUNCTIONS_EMULATOR === 'true') {
    return true as const;
  }

  const list = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return list.length > 0 ? list : true;
}

const ALLOWED_ORIGINS = buildAllowedOrigins();

const corsHandler = cors({
  origin: ALLOWED_ORIGINS,
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // preflight cache: 24 hours
});

/**
 * POST /api/leads/create
 *
 * Public endpoint for lead capture from Shopify quote/contact forms.
 * Protection layers:
 * 1. CORS restriction (configured above)
 * 2. Honeypot field detection
 * 3. Zod validation
 * 4. Rate limiting placeholder (add Cloud Armor or Cloudflare in production)
 * 5. Future: Turnstile/reCAPTCHA token verification
 */
export const leadCaptureHandler = (req: Request, res: Response): void => {
  corsHandler(req, res, async () => {
    // Only accept POST
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      // Validate the incoming data
      const result = leadFormDataSchema.safeParse(req.body);

      if (!result.success) {
        // Check if it's a honeypot rejection — return 200 to not tip off bots
        const isHoneypot = result.error.issues.some(
          (issue) => issue.message === 'Invalid submission'
        );

        if (isHoneypot) {
          // Silently accept but don't process — bot mitigation
          res.status(200).json({ success: true, id: 'processed' });
          return;
        }

        res.status(400).json({
          error: 'Validation failed',
          details: result.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        });
        return;
      }

      const data = result.data;

      // Score the lead
      const { score, scoreBreakdown, tier, scoreReasons } = scoreLead({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        company: data.company,
        deliveryZip: data.deliveryZip,
        productCategory: data.productCategory,
        quantity: data.quantity,
        targetBudget: data.targetBudget,
        projectDetails: data.projectDetails,
        source: data.source || {},
        formType: data.formType,
      });

      // Calculate SLA deadline
      const now = new Date();
      const slaDeadline = calculateSLADeadline(now, tier);
      const source = data.source || {};
      const productTitle = data.productTitle || `${data.quantity}x ${data.productCategory}`;
      const numericProductPrice = typeof data.productPrice === 'number' ? data.productPrice : null;
      const estimatedDealValue = numericProductPrice !== null
        ? numericProductPrice * data.quantity
        : null;
      const sourceTag = source.utm_source || 'direct';

      // Resolve assignee: use form value, or auto-assign to least-busy rep
      const resolvedAssignee: string | null = data.assignedTo || (await getAutoAssignee());

      // Create the lead document in Supabase
      const nowIso = new Date().toISOString();
      const slaIso = slaDeadline.toISOString();

      const leadRow = {
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email.toLowerCase(),
        phone: data.phone || null,
        company: data.company || null,
        delivery_zip: data.deliveryZip || null,
        product_category: data.productCategory,
        product_title: productTitle,
        product_price: numericProductPrice,
        quantity: data.quantity,
        target_budget: data.targetBudget,
        timeline: data.timeline || null,
        project_details: data.projectDetails || null,
        source,
        form_type: data.formType,
        score,
        lead_score: score,
        score_breakdown: scoreBreakdown,
        tier,
        stage: 'new',
        status: 'new',
        assigned_to: resolvedAssignee,
        sla_deadline: slaIso,
        sla_deadline_at: slaIso,
        sla_status: 'ok',
        contacted_at: null,
        last_contacted_at: null,
        is_overdue: false,
        shopify_customer_id: null,
        ai_summary: `${tier.toUpperCase()} lead interested in ${data.quantity}x ${data.productCategory}.`,
        ai_next_action: 'Follow up via phone or email.',
        tags: [
          data.productCategory.toLowerCase().replace(/\s+/g, '-'),
          tier,
          sourceTag,
        ],
        estimated_deal_value: estimatedDealValue,
        created_at: nowIso,
        updated_at: nowIso,
      };

      const { data: insertedLeads, error: insertErr } = await supabase
        .from('leads')
        .insert(leadRow)
        .select('id')
        .single();

      if (insertErr || !insertedLeads) {
        functions.logger.error('Error inserting lead into Supabase:', insertErr);
        res.status(500).json({ error: 'Failed to create lead in database' });
        return;
      }

      const leadId = insertedLeads.id;

      // Create "created" event in lead_events table
      await supabase.from('lead_events').insert({
        lead_id: leadId,
        type: 'created',
        description: `New ${data.formType} lead from ${data.firstName} ${data.lastName}`,
        metadata: {
          formType: data.formType,
          productCategory: data.productCategory,
          productTitle,
          score,
          tier,
        },
        created_by: 'system',
        created_at: nowIso,
      });

      // Auto-create task for hot and warm leads
      if (tier === 'hot' || tier === 'warm') {
        const taskPriority = tier === 'hot' ? 'urgent' : 'high';
        const taskTitle = tier === 'hot'
          ? `🔥 URGENT: Call ${data.firstName} ${data.lastName} — ${data.productCategory} ($${data.targetBudget})`
          : `Follow up with ${data.firstName} ${data.lastName} — ${data.productCategory}`;

        await supabase.from('tasks').insert({
          lead_id: leadId,
          title: taskTitle,
          description: `Auto-generated: ${data.formType} request for ${data.productCategory}. Budget: ${data.targetBudget}. ${data.projectDetails || ''}`,
          type: 'follow_up',
          priority: taskPriority,
          status: 'pending',
          due_at: slaIso,
          due_date: slaIso,
          assigned_to: resolvedAssignee || '',
          is_auto_generated: true,
          completed_at: null,
          created_at: nowIso,
          updated_at: nowIso,
        });

        // Log the auto-task creation event
        await supabase.from('lead_events').insert({
          lead_id: leadId,
          type: 'task_created',
          description: `Auto-created ${taskPriority} follow-up task`,
          metadata: { priority: taskPriority, tier },
          created_by: 'system',
          created_at: nowIso,
        });
      }

      functions.logger.info(`Lead created: ${leadId}, score: ${score}, tier: ${tier}`);

      res.status(201).json({
        success: true,
        id: leadId,
        score,
        scoreBreakdown,
        tier,
      });
    } catch (error) {
      functions.logger.error('Error creating lead:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
};

export const createLead = functions.https.onRequest(leadCaptureHandler);

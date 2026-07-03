import * as functions from 'firebase-functions';
import type { Request, Response } from 'firebase-functions/v1';
import cors from 'cors';
import { admin, db } from '../firebaseAdmin';
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

      // Create the lead document
      const leadRef = db.collection('leads').doc();
      const lead = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email.toLowerCase(),
        phone: data.phone || null,
        company: data.company || null,
        deliveryZip: data.deliveryZip || null,
        productCategory: data.productCategory,
        category: data.productCategory,
        productTitle,
        productPrice: numericProductPrice,
        quantity: data.quantity,
        targetBudget: data.targetBudget,
        timeline: data.timeline || null,
        projectDetails: data.projectDetails || null,
        source,
        formType: data.formType,
        score,
        leadScore: score,
        scoreBreakdown,
        scoreReasons,
        tier,
        stage: 'new',
        status: 'new',
        assignedTo: resolvedAssignee,
        slaDeadline: admin.firestore.Timestamp.fromDate(slaDeadline),
        slaDeadlineAt: admin.firestore.Timestamp.fromDate(slaDeadline),
        slaStatus: 'ok',
        contactedAt: null,
        lastContactedAt: null,
        nextFollowUpAt: admin.firestore.Timestamp.fromDate(slaDeadline),
        isOverdue: false,
        shopifyCustomerId: null,
        shopifyCustomerGid: null,
        shopifyDraftOrderId: null,
        shopifyDraftOrderIds: [],
        shopifyOrderId: null,
        shopifyOrderIds: [],
        shopifyShopDomain: null,
        aiSummary: `${tier.toUpperCase()} lead interested in ${data.quantity}x ${data.productCategory}.`,
        aiNextAction: 'Follow up via phone or email.',
        tags: [
          data.productCategory.toLowerCase().replace(/\s+/g, '-'),
          tier,
          sourceTag,
        ],
        estimatedDealValue,
        wonRevenue: null,
        lostReason: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await leadRef.set(lead);

      // Create "created" event in subcollection
      await leadRef.collection('events').add({
        type: 'created',
        description: `New ${data.formType} lead from ${data.firstName} ${data.lastName}`,
        metadata: {
          formType: data.formType,
          productCategory: data.productCategory,
          productTitle,
          score,
          tier,
        },
        createdBy: 'system',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Auto-create task for hot and warm leads
      if (tier === 'hot' || tier === 'warm') {
        const taskPriority = tier === 'hot' ? 'urgent' : 'high';
        const taskTitle = tier === 'hot'
          ? `🔥 URGENT: Call ${data.firstName} ${data.lastName} — ${data.productCategory} ($${data.targetBudget})`
          : `Follow up with ${data.firstName} ${data.lastName} — ${data.productCategory}`;

        await db.collection('tasks').add({
          leadId: leadRef.id,
          title: taskTitle,
          description: `Auto-generated: ${data.formType} request for ${data.productCategory}. Budget: ${data.targetBudget}. ${data.projectDetails || ''}`,
          type: 'follow_up',
          priority: taskPriority,
          status: 'pending',
          dueAt: admin.firestore.Timestamp.fromDate(slaDeadline),
          dueDate: admin.firestore.Timestamp.fromDate(slaDeadline),
          assignedTo: resolvedAssignee || '',
          isAutoGenerated: true,
          completedAt: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Log the auto-task creation event
        await leadRef.collection('events').add({
          type: 'task_created',
          description: `Auto-created ${taskPriority} follow-up task`,
          metadata: { priority: taskPriority, tier },
          createdBy: 'system',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      functions.logger.info(`Lead created: ${leadRef.id}, score: ${score}, tier: ${tier}`);

      res.status(201).json({
        success: true,
        id: leadRef.id,
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

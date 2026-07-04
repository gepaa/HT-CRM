// ─────────────────────────────────────────────────────────────
// Vercel Serverless Endpoint: POST /api/leads/create
// ─────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabaseAdmin';
import { leadFormDataSchema } from '../lib/validation';
import { scoreLead } from '../lib/scoring';
import { calculateSLADeadline } from '../lib/sla';
import { getAutoAssignee } from '../lib/autoAssign';
import { analyzeLeadWithGemini } from '../lib/gemini';

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

  try {
    const result = leadFormDataSchema.safeParse(req.body);

    if (!result.success) {
      const isHoneypot = result.error.issues.some(
        (issue) => issue.message === 'Invalid submission'
      );

      if (isHoneypot) {
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

    const { score, scoreBreakdown, tier } = scoreLead({
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

    const now = new Date();
    const slaDeadline = calculateSLADeadline(now, tier);
    const source = data.source || {};
    const productTitle = data.productTitle || `${data.quantity}x ${data.productCategory}`;
    const numericProductPrice = typeof data.productPrice === 'number' ? data.productPrice : null;
    const estimatedDealValue = numericProductPrice !== null
      ? numericProductPrice * data.quantity
      : null;
    const sourceTag = source.utm_source || 'direct';

    const resolvedAssignee: string | null = data.assignedTo || (await getAutoAssignee());

    const { aiSummary, aiNextAction } = await analyzeLeadWithGemini({
      firstName: data.firstName,
      lastName: data.lastName,
      company: data.company,
      productCategory: data.productCategory,
      quantity: data.quantity,
      targetBudget: data.targetBudget,
      projectDetails: data.projectDetails,
      tier,
      score,
    });

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
      ai_summary: aiSummary,
      ai_next_action: aiNextAction,
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
      console.error('Error inserting lead into Supabase:', insertErr);
      res.status(500).json({ error: 'Failed to create lead in database' });
      return;
    }

    const leadId = insertedLeads.id;

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

      await supabase.from('lead_events').insert({
        lead_id: leadId,
        type: 'task_created',
        description: `Auto-created ${taskPriority} follow-up task`,
        metadata: { priority: taskPriority, tier },
        created_by: 'system',
        created_at: nowIso,
      });
    }

    console.log(`Lead created: ${leadId}, score: ${score}, tier: ${tier}`);

    res.status(201).json({
      success: true,
      id: leadId,
      score,
      scoreBreakdown,
      tier,
    });
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

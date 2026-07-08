// ─────────────────────────────────────────────────────────────
// Vercel Serverless Cron: GET /api/cron/slaChecker
// ─────────────────────────────────────────────────────────────
import { supabase } from '../_lib/supabaseAdmin';

export default async function handler(req: any, res: any) {
  const nowIso = new Date().toISOString();

  try {
    const { data: overdueLeads, error } = await supabase
      .from('leads')
      .select('*')
      .in('sla_status', ['ok', 'warning'])
      .is('contacted_at', null)
      .lte('sla_deadline', nowIso);

    if (error || !overdueLeads || overdueLeads.length === 0) {
      console.log('SLA check: No overdue leads found');
      res.status(200).json({ success: true, count: 0 });
      return;
    }

    let overdueCount = 0;

    for (const lead of overdueLeads) {
      await supabase
        .from('leads')
        .update({
          sla_status: 'overdue',
          is_overdue: true,
          updated_at: nowIso,
        })
        .eq('id', lead.id);

      await supabase.from('lead_events').insert({
        lead_id: lead.id,
        type: 'sla_overdue',
        description: `SLA deadline missed for ${lead.first_name || ''} ${lead.last_name || ''} (${lead.tier} lead)`,
        metadata: {
          tier: lead.tier,
          slaDeadline: lead.sla_deadline,
          productCategory: lead.product_category,
        },
        created_by: 'system',
        created_at: nowIso,
      });

      await supabase.from('tasks').insert({
        lead_id: lead.id,
        title: `⚠️ SLA OVERDUE: Contact ${lead.first_name || ''} ${lead.last_name || ''} immediately`,
        description: `This ${lead.tier} lead has exceeded their SLA deadline. Product: ${lead.product_category}. Budget: ${lead.target_budget || '$0'}.`,
        type: 'follow_up',
        priority: 'urgent',
        status: 'pending',
        due_at: nowIso,
        due_date: nowIso,
        assigned_to: lead.assigned_to || '',
        is_auto_generated: true,
        completed_at: null,
        created_at: nowIso,
        updated_at: nowIso,
      });

      overdueCount++;
    }

    console.warn(`SLA check: Marked ${overdueCount} leads as overdue`);
    res.status(200).json({ success: true, overdueCount });
  } catch (error: any) {
    console.error('SLA checker error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// ─────────────────────────────────────────────────────────────
// Vercel Serverless Cron: GET /api/cron/slaWarningChecker
// ─────────────────────────────────────────────────────────────
import { supabase } from '../../lib/supabaseAdmin';

export default async function handler(req: any, res: any) {
  const now = new Date();
  const nowIso = now.toISOString();

  try {
    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, sla_deadline, created_at')
      .eq('sla_status', 'ok')
      .is('contacted_at', null);

    if (error || !leads || leads.length === 0) {
      res.status(200).json({ success: true, warningCount: 0 });
      return;
    }

    let warningCount = 0;

    for (const lead of leads) {
      if (!lead.sla_deadline) continue;

      const deadline = new Date(lead.sla_deadline);
      const created = new Date(lead.created_at || now);
      const totalMs = deadline.getTime() - created.getTime();
      const elapsedMs = now.getTime() - created.getTime();
      const percentElapsed = totalMs > 0 ? elapsedMs / totalMs : 1;

      if (percentElapsed >= 0.75) {
        await supabase
          .from('leads')
          .update({
            sla_status: 'warning',
            updated_at: nowIso,
          })
          .eq('id', lead.id);
        warningCount++;
      }
    }

    if (warningCount > 0) {
      console.log(`SLA warning: Set ${warningCount} leads to warning status`);
    }

    res.status(200).json({ success: true, warningCount });
  } catch (error: any) {
    console.error('SLA warning checker error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

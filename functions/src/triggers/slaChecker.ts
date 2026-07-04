import * as functions from 'firebase-functions';
import { supabase } from '../lib/supabaseAdmin';

/**
 * Scheduled function: SLA Checker
 * Runs every 5 minutes during business hours.
 *
 * Checks all leads where:
 * - sla_status is NOT 'overdue'
 * - contacted_at is null (not yet contacted)
 * - sla_deadline has passed
 *
 * Marks them as overdue and creates alert tasks.
 */
export const slaChecker = functions.pubsub
  .schedule('every 5 minutes')
  .timeZone('America/New_York')
  .onRun(async () => {
    const nowIso = new Date().toISOString();

    try {
      // Find leads that are past their SLA deadline but not yet marked overdue
      const { data: overdueLeads, error } = await supabase
        .from('leads')
        .select('*')
        .in('sla_status', ['ok', 'warning'])
        .is('contacted_at', null)
        .lte('sla_deadline', nowIso);

      if (error || !overdueLeads || overdueLeads.length === 0) {
        functions.logger.info('SLA check: No overdue leads found');
        return null;
      }

      let overdueCount = 0;

      for (const lead of overdueLeads) {
        // Mark as overdue
        await supabase
          .from('leads')
          .update({
            sla_status: 'overdue',
            is_overdue: true,
            updated_at: nowIso,
          })
          .eq('id', lead.id);

        // Create overdue event
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

        // Create urgent alert task
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

      functions.logger.warn(`SLA check: Marked ${overdueCount} leads as overdue`);
      return null;
    } catch (error) {
      functions.logger.error('SLA checker error:', error);
      return null;
    }
  });

/**
 * Scheduled function: SLA Warning Checker
 * Runs every 5 minutes. Sets sla_status to 'warning' when 75% of SLA time has elapsed.
 */
export const slaWarningChecker = functions.pubsub
  .schedule('every 5 minutes')
  .timeZone('America/New_York')
  .onRun(async () => {
    const now = new Date();
    const nowIso = now.toISOString();

    try {
      const { data: leads, error } = await supabase
        .from('leads')
        .select('id, sla_deadline, created_at')
        .eq('sla_status', 'ok')
        .is('contacted_at', null);

      if (error || !leads || leads.length === 0) return null;

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
        functions.logger.info(`SLA warning: Set ${warningCount} leads to warning status`);
      }

      return null;
    } catch (error) {
      functions.logger.error('SLA warning checker error:', error);
      return null;
    }
  });

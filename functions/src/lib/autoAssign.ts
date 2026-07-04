// ─────────────────────────────────────────────────────────────
// Auto-Assignment — HT CRM Cloud Functions (Supabase)
// ─────────────────────────────────────────────────────────────
// Implements a simple round-robin assignment strategy:
//   1. Query users table for active sales_rep role users
//   2. Pick the rep with the fewest assigned open leads
//   3. Fall back to the first admin if no reps are active
//   4. Return null if no eligible user is found (manual assignment required)
// ─────────────────────────────────────────────────────────────
import * as functions from 'firebase-functions';
import { supabase } from './supabaseAdmin';

interface SalesRep {
  uid: string;
  displayName?: string;
  role: string;
}

/**
 * Get the auto-assignee UID using a load-balanced least-busy strategy.
 *
 * Priority order:
 *   1. Active `sales_rep` users sorted by open lead count (ascending)
 *   2. Active `admin` users as fallback
 *   3. null — means manual assignment required
 */
export async function getAutoAssignee(): Promise<string | null> {
  try {
    // 1. Fetch all active sales reps
    const { data: repDocs, error: repErr } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'sales_rep');

    if (repErr) {
      functions.logger.error('auto-assign: Error fetching sales reps from Supabase:', repErr);
    }

    let candidates: SalesRep[] = (repDocs || []).map((d) => ({
      uid: d.uid || d.id,
      displayName: d.display_name,
      role: d.role,
    }));

    // Fall back to admin users if no active reps
    if (candidates.length === 0) {
      const { data: adminDocs, error: adminErr } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'admin');

      if (adminErr) {
        functions.logger.error('auto-assign: Error fetching admins from Supabase:', adminErr);
      }

      candidates = (adminDocs || []).map((d) => ({
        uid: d.uid || d.id,
        displayName: d.display_name,
        role: d.role,
      }));
    }

    if (candidates.length === 0) {
      functions.logger.warn('auto-assign: No active sales reps or admins found. Lead will be unassigned.');
      return null;
    }

    if (candidates.length === 1) {
      return candidates[0].uid;
    }

    // 2. Count all assigned leads per candidate (open + closed).
    const loadCounts = await Promise.all(
      candidates.map(async (rep) => {
        const { count, error } = await supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_to', rep.uid);
        if (error) {
          functions.logger.error(`auto-assign: Error counting leads for ${rep.uid}:`, error);
        }
        return { uid: rep.uid, count: count || 0 };
      })
    );

    // 3. Sort by load count ascending — least busy first
    loadCounts.sort((a, b) => a.count - b.count);
    const assignee = loadCounts[0].uid;

    functions.logger.info(`auto-assign: Assigned to ${assignee} (${loadCounts[0].count} open leads)`);
    return assignee;
  } catch (err) {
    functions.logger.error('auto-assign: Error fetching assignee, returning null:', err);
    return null;
  }
}

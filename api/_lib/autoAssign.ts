// ─────────────────────────────────────────────────────────────
// Auto-Assignment — Vercel Serverless Functions (Supabase)
// ─────────────────────────────────────────────────────────────
import { supabase } from './supabaseAdmin';

interface SalesRep {
  uid: string;
  displayName?: string;
  role: string;
}

/**
 * Get the auto-assignee UID using a load-balanced least-busy strategy.
 */
export async function getAutoAssignee(): Promise<string | null> {
  try {
    // 1. Fetch all active sales reps
    const { data: repDocs, error: repErr } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'sales_rep');

    if (repErr) {
      console.error('auto-assign: Error fetching sales reps from Supabase:', repErr);
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
        console.error('auto-assign: Error fetching admins from Supabase:', adminErr);
      }

      candidates = (adminDocs || []).map((d) => ({
        uid: d.uid || d.id,
        displayName: d.display_name,
        role: d.role,
      }));
    }

    if (candidates.length === 0) {
      console.warn('auto-assign: No active sales reps or admins found. Lead will be unassigned.');
      return null;
    }

    if (candidates.length === 1) {
      return candidates[0].uid;
    }

    // 2. Count all assigned leads per candidate.
    const loadCounts = await Promise.all(
      candidates.map(async (rep) => {
        const { count, error } = await supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_to', rep.uid);
        if (error) {
          console.error(`auto-assign: Error counting leads for ${rep.uid}:`, error);
        }
        return { uid: rep.uid, count: count || 0 };
      })
    );

    // 3. Sort by load count ascending — least busy first
    loadCounts.sort((a, b) => a.count - b.count);
    const assignee = loadCounts[0].uid;

    console.log(`auto-assign: Assigned to ${assignee} (${loadCounts[0].count} open leads)`);
    return assignee;
  } catch (err) {
    console.error('auto-assign: Error fetching assignee, returning null:', err);
    return null;
  }
}

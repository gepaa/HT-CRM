// ─────────────────────────────────────────────────────────────
// Auto-Assignment — HT CRM Cloud Functions
// ─────────────────────────────────────────────────────────────
// Implements a simple round-robin assignment strategy:
//   1. Query users collection for active sales_rep role users
//   2. Pick the rep with the fewest assigned open leads
//   3. Fall back to the first admin if no reps are active
//   4. Return null if no eligible user is found (manual assignment required)
// ─────────────────────────────────────────────────────────────
import * as functions from 'firebase-functions';
import { db } from '../firebaseAdmin';

interface SalesRep {
  uid: string;
  displayName?: string;
  role: string;
  isActive?: boolean;
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
    const repSnapshot = await db
      .collection('users')
      .where('role', '==', 'sales_rep')
      .where('isActive', '==', true)
      .get();

    let candidates: SalesRep[] = repSnapshot.docs.map((d) => ({
      uid: d.id,
      displayName: d.data().displayName,
      role: d.data().role,
      isActive: d.data().isActive,
    }));

    // Fall back to admin users if no active reps
    if (candidates.length === 0) {
      const adminSnapshot = await db
        .collection('users')
        .where('role', '==', 'admin')
        .where('isActive', '==', true)
        .get();

      candidates = adminSnapshot.docs.map((d) => ({
        uid: d.id,
        displayName: d.data().displayName,
        role: d.data().role,
        isActive: d.data().isActive,
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
    // Simple single-field query — no composite index required.
    // Sufficient for load-balancing; closed leads age out naturally.
    const loadCounts = await Promise.all(
      candidates.map(async (rep) => {
        const snapshot = await db
          .collection('leads')
          .where('assignedTo', '==', rep.uid)
          .get();
        return { uid: rep.uid, count: snapshot.size };
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

// ─────────────────────────────────────────────────────────────
// User Types – Garage Auto Supplies CRM
// ─────────────────────────────────────────────────────────────

/** Role-based access level */
export type UserRole = 'admin' | 'sales_rep' | 'viewer';

/** Authenticated CRM user profile */
export interface CRMUser {
  id: string;
  uid?: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

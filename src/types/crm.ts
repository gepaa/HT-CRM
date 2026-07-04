// ─────────────────────────────────────────────────────────────
// Shared CRM Types – Garage Auto Supplies CRM
// ─────────────────────────────────────────────────────────────

/** CRM user profile stored in Supabase Postgres users table */
export interface CRMUser {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'sales_rep' | 'viewer';
  avatarUrl?: string;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Task priority levels */
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

/** Task status */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

/** Task document */
export interface Task {
  id: string;
  title: string;
  description?: string;
  leadId?: string;
  assignedTo: string;
  assignedBy: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Deal stage */
export type DealStage =
  | 'qualification'
  | 'proposal'
  | 'negotiation'
  | 'contract'
  | 'closed_won'
  | 'closed_lost';

/** Deal document */
export interface Deal {
  id: string;
  title: string;
  leadId: string;
  contactName: string;
  value: number;
  stage: DealStage;
  probability: number;
  assignedTo: string;
  expectedCloseDate: Date | null;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Stage-to-probability mapping */
export const DEAL_STAGE_PROBABILITY: Record<DealStage, number> = {
  qualification: 10,
  proposal: 30,
  negotiation: 50,
  contract: 75,
  closed_won: 100,
  closed_lost: 0,
};

/** Lead timeline event types */
export type LeadEventType =
  | 'stage_changed'
  | 'note_added'
  | 'email_sent'
  | 'call_logged'
  | 'task_created'
  | 'deal_created'
  | 'score_updated'
  | 'assigned';

/** Lead timeline event */
export interface LeadEvent {
  id: string;
  leadId: string;
  type: LeadEventType;
  description: string;
  metadata?: Record<string, unknown>;
  createdBy: string;
  createdAt: Date;
}

/** Lead note */
export interface LeadNote {
  id: string;
  leadId: string;
  content: string;
  createdBy: string;
  createdByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

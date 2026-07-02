// ─────────────────────────────────────────────────────────────
// Event Types – Garage Auto Supplies CRM
// ─────────────────────────────────────────────────────────────

/** All possible timeline event kinds */
export type EventType =
  | 'created'
  | 'stage_changed'
  | 'note_added'
  | 'task_created'
  | 'email_sent'
  | 'call_logged'
  | 'sla_overdue'
  | 'score_updated'
  | 'deal_created'
  | 'shopify_synced';

/** Immutable timeline entry on a Lead's activity feed */
export interface LeadEvent {
  id: string;
  type: EventType;
  description: string;
  metadata: Record<string, any>;
  createdBy: string;
  createdAt: Date;
}

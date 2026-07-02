// ─────────────────────────────────────────────────────────────
// Integration Types – Garage Auto Supplies CRM
// ─────────────────────────────────────────────────────────────

/** Processing outcome for an inbound webhook payload */
export type IntegrationLogStatus = 'processed' | 'failed' | 'ignored';

/** Audit log entry for every inbound integration event */
export interface IntegrationLog {
  id: string;
  source: string;
  topic: string;
  payload: Record<string, any>;
  status: IntegrationLogStatus;
  leadId: string | null;
  error: string | null;
  createdAt: Date;
}

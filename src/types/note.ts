// ─────────────────────────────────────────────────────────────
// Note Types – Garage Auto Supplies CRM
// ─────────────────────────────────────────────────────────────

/** Free-form note attached to a Lead */
export interface Note {
  id: string;
  content: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

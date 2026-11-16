export interface AuditEntry {
  id: string;
  businessId: string | null;
  userId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

const entries: AuditEntry[] = [];

export function recordAudit(
  entry: Omit<AuditEntry, "id" | "createdAt">,
): AuditEntry {
  const record: AuditEntry = {
    id: `${entries.length + 1}`,
    businessId: entry.businessId,
    userId: entry.userId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    metadata: entry.metadata ?? null,
    createdAt: new Date().toISOString(),
  };
  entries.push(record);
  return record;
}

export function listAudit(businessId: string): AuditEntry[] {
  return entries.filter((e) => e.businessId === businessId);
}

export function resetAudit(): void {
  entries.length = 0;
}

// --- DB-backed (durable) variants ---

export interface AuditDbRow {
  id: string;
  business_id: string | null;
  user_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sb = { from: (t: string) => any };
/* eslint-enable @typescript-eslint/no-explicit-any */

export function rowToAudit(row: AuditDbRow): AuditEntry {
  return {
    id: row.id,
    businessId: row.business_id,
    userId: row.user_id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

export async function recordAuditDb(
  supabase: Sb,
  entry: Omit<AuditEntry, "id" | "createdAt">,
): Promise<AuditEntry> {
  const { data, error } = await supabase
    .from("audit_log")
    .insert({
      business_id: entry.businessId,
      user_id: entry.userId,
      action: entry.action,
      target_type: entry.targetType,
      target_id: entry.targetId,
      metadata: entry.metadata,
    })
    .select("*")
    .single();
  if (error || !data) {
    return recordAudit(entry);
  }
  return rowToAudit(data as AuditDbRow);
}

export async function listAuditDb(
  supabase: Sb,
  businessId: string,
): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  if (error || !data) return listAudit(businessId);
  return (data as AuditDbRow[]).map(rowToAudit);
}
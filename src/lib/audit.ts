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
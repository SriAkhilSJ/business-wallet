/**
 * Durable collection jobs — in-memory registry for the POC/dev path.
 *
 * Production durability comes from the `collection_jobs` table (see migration
 * 20261120000001_collection_jobs.sql) and a Supabase-backed adapter; this
 * module defines the shared shape and helpers so the two stay aligned.
 */
export type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface JobProgress {
  discovered: number;
  processed: number;
  failed: number;
  total: number;
}

export interface CollectionJobRecord {
  id: string;
  businessId: string;
  userId: string;
  status: JobStatus;
  input: unknown;
  progress: JobProgress;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

const jobs = new Map<string, CollectionJobRecord>();

export function createJob(
  id: string,
  businessId: string,
  userId: string,
  input: unknown,
  total: number,
): CollectionJobRecord {
  const now = new Date().toISOString();
  const job: CollectionJobRecord = {
    id,
    businessId,
    userId,
    status: "pending",
    input,
    progress: { discovered: total, processed: 0, failed: 0, total },
    error: null,
    createdAt: now,
    updatedAt: now,
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): CollectionJobRecord | null {
  return jobs.get(id) ?? null;
}

export function updateJob(
  id: string,
  patch: Partial<Pick<CollectionJobRecord, "status" | "progress" | "error">>,
): CollectionJobRecord | null {
  const job = jobs.get(id);
  if (!job) return null;
  if (patch.status !== undefined) job.status = patch.status;
  if (patch.progress !== undefined) job.progress = patch.progress;
  if (patch.error !== undefined) job.error = patch.error;
  job.updatedAt = new Date().toISOString();
  return job;
}

export function listJobs(businessId: string): CollectionJobRecord[] {
  return [...jobs.values()].filter((j) => j.businessId === businessId);
}

/** Reset all jobs (for tests). */
export function resetJobs(): void {
  jobs.clear();
}

// --- DB-backed (durable) variants ---

export interface JobDbRow {
  id: string;
  business_id: string;
  user_id: string;
  status: JobStatus;
  input: unknown;
  progress: JobProgress;
  error: string | null;
  created_at: string;
  updated_at: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sb = { from: (t: string) => any };
/* eslint-enable @typescript-eslint/no-explicit-any */

export function rowToJob(row: JobDbRow): CollectionJobRecord {
  return {
    id: row.id,
    businessId: row.business_id,
    userId: row.user_id,
    status: row.status,
    input: row.input,
    progress: row.progress,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createJobDb(
  supabase: Sb,
  id: string,
  businessId: string,
  userId: string,
  input: unknown,
  total: number,
): Promise<CollectionJobRecord> {
  const { data, error } = await supabase
    .from("collection_jobs")
    .insert({
      id,
      business_id: businessId,
      user_id: userId,
      status: "pending",
      input,
      progress: { discovered: total, processed: 0, failed: 0, total },
    })
    .select("*")
    .single();
  if (error || !data) return createJob(id, businessId, userId, input, total);
  return rowToJob(data as JobDbRow);
}

export async function getJobDb(
  supabase: Sb,
  id: string,
): Promise<CollectionJobRecord | null> {
  const { data, error } = await supabase
    .from("collection_jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return getJob(id);
  return rowToJob(data as JobDbRow);
}

export async function updateJobDb(
  supabase: Sb,
  id: string,
  patch: Partial<Pick<CollectionJobRecord, "status" | "progress" | "error">>,
): Promise<CollectionJobRecord | null> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.progress !== undefined) update.progress = patch.progress;
  if (patch.error !== undefined) update.error = patch.error;
  const { data, error } = await supabase
    .from("collection_jobs")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) return updateJob(id, patch);
  return rowToJob(data as JobDbRow);
}

export async function listJobsDb(
  supabase: Sb,
  businessId: string,
): Promise<CollectionJobRecord[]> {
  const { data, error } = await supabase
    .from("collection_jobs")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  if (error || !data) return listJobs(businessId);
  return (data as JobDbRow[]).map(rowToJob);
}
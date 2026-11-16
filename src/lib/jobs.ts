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
import { describe, expect, it, beforeEach } from "vitest";
import { createJob, getJob, updateJob, resetJobs, listJobs } from "@/lib/jobs";

describe("jobs", () => {
  beforeEach(() => resetJobs());

  it("creates and retrieves a job", () => {
    const job = createJob("j1", "b1", "u1", { from: "2026-08-01" }, 5);
    expect(job.status).toBe("pending");
    expect(job.progress.total).toBe(5);
    expect(getJob("j1")).toBe(job);
  });

  it("updates progress and status", () => {
    createJob("j1", "b1", "u1", {}, 5);
    const updated = updateJob("j1", { status: "running", progress: { discovered: 5, processed: 2, failed: 0, total: 5 } });
    expect(updated?.status).toBe("running");
    expect(updated?.progress.processed).toBe(2);
  });

  it("returns null for unknown job", () => {
    expect(getJob("nope")).toBeNull();
    expect(updateJob("nope", { status: "failed" })).toBeNull();
  });

  it("lists jobs by business", () => {
    createJob("j1", "b1", "u1", {}, 1);
    createJob("j2", "b2", "u2", {}, 1);
    expect(listJobs("b1")).toHaveLength(1);
  });
});
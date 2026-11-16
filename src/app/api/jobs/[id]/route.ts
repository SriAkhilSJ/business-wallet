import { requireUser } from "@/lib/auth/session";
import { jsonError } from "@/lib/errors";
import { getJob } from "@/lib/jobs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await params;
    const job = getJob(id);
    if (!job) {
      return Response.json({ error: { code: "not_found", message: "Job not found." } }, { status: 404 });
    }
    return Response.json({ job });
  } catch (err) {
    return jsonError(err);
  }
}
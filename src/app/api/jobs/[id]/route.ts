import { requireUser } from "@/lib/auth/session";
import { getMode } from "@/lib/env";
import { jsonError } from "@/lib/errors";
import { getJob, getJobDb } from "@/lib/jobs";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await params;
    const mode = getMode();
    let job = null;
    if (mode === "supabase") {
      const supabase = await createSupabaseServerClient();
      job = await getJobDb(supabase, id);
    } else {
      job = getJob(id);
    }
    if (!job) {
      return Response.json({ error: { code: "not_found", message: "Job not found." } }, { status: 404 });
    }
    return Response.json({ job });
  } catch (err) {
    return jsonError(err);
  }
}
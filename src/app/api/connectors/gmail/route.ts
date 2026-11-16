import { z } from "zod";

import { parseOrThrow, readJsonBody } from "@/lib/api-helpers";
import { requireUser } from "@/lib/auth/session";
import { jsonError } from "@/lib/errors";
import { getStore } from "@/lib/store";
import { gmailConnector } from "@/lib/connectors/gmail";

const schema = z.object({
  // Optional: limit discovery; import all discovered if ids omitted.
  ids: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = parseOrThrow(schema, await readJsonBody(req), "Invalid request.");
    const store = await getStore();
    const ctx = { userId: user.id, store };
    const discovered = await gmailConnector.discover(ctx);
    const toImport = body.ids ? discovered.filter((d) => body.ids!.includes(d.sourceFileId)) : discovered;
    if (toImport.length === 0) {
      return Response.json({ documents: [], errors: [], message: "Nothing to import." });
    }
    const result = await gmailConnector.import(ctx, toImport);
    return Response.json({ documents: result.created, errors: result.errors, notice: result.notice }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
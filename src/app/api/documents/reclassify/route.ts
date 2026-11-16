import { requireUser } from "@/lib/auth/session";
import { classifyDocument, classificationConfig } from "@/lib/classify/vision";
import { AUTO_ACCEPT_CONFIDENCE } from "@/lib/config";
import { jsonError } from "@/lib/errors";
import { getStore } from "@/lib/store";

/** How many documents one request reads. Each costs a model call. */
const BATCH = 4;

/** How many documents still need reading. */
export async function GET() {
  try {
    const user = await requireUser();
    const store = await getStore();
    const remaining = await store.countUnreadDocuments(user.id);
    return Response.json({ remaining });
  } catch (err) {
    return jsonError(err);
  }
}

/**
 * Re-reads documents uploaded before the reader worked, or whose read failed.
 * One batch per request so a slow model cannot time out the function.
 */
export async function POST() {
  try {
    const user = await requireUser();
    const store = await getStore();

    const docs = await store.listUnreadDocuments(user.id, BATCH);
    let classified = 0;

    for (const doc of docs) {
      const stored = await store.readDocument(user.id, doc.id);
      if (!stored?.bytes) continue;

      const result = await classifyDocument({
        bytes: stored.bytes,
        mimeType: doc.mimeType,
      });
      if (!result || result.confidence < AUTO_ACCEPT_CONFIDENCE) continue;

      await store.applyClassification(user.id, doc.id, {
        category: result.docType,
        documentDate: result.date,
        amount: result.amount,
        vendor: result.vendor,
        gstin: result.gstin,
        confidence: result.confidence,
        model: classificationConfig()?.model ?? "model",
      });
      classified += 1;
    }

    const remaining = await store.countUnreadDocuments(user.id);
    return Response.json({ processed: docs.length, classified, remaining });
  } catch (err) {
    return jsonError(err);
  }
}

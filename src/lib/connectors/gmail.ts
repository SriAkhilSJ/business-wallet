import { getGoogleAccessToken } from "../google-tokens";
import { ingest } from "../ingest";
import type { DiscoveredDocument, DocumentConnector } from "./types";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

export const gmailConnector: DocumentConnector = {
  sourceType: "gmail",

  async discover(ctx) {
    const token = await getGoogleAccessToken(ctx.userId);
    if (!token) return [];
    const params = new URLSearchParams({ q: "has:attachment", maxResults: "20" });
    const res = await fetch(`${GMAIL_API}/messages?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { messages?: { id: string }[] };
    const out: DiscoveredDocument[] = [];
    for (const m of data.messages ?? []) {
      const msgRes = await fetch(`${GMAIL_API}/messages/${m.id}?format=full`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!msgRes.ok) continue;
      const msg = (await msgRes.json()) as {
        id: string;
        payload?: { parts?: { filename?: string; body?: { attachmentId?: string; size?: number } }[] };
      };
      for (const part of msg.payload?.parts ?? []) {
        if (!part.filename || !part.body?.attachmentId) continue;
        out.push({
          filename: part.filename,
          bytes: new Uint8Array(),
          size: part.body.size,
          sourceFileId: `${msg.id}:${part.body.attachmentId}`,
          // bytes fetched lazily in import
        });
      }
    }
    // Stash attachment ids in sourceFileId; fetch bytes during import.
    return out;
  },

  async import(ctx, docs) {
    const token = await getGoogleAccessToken(ctx.userId);
    if (!token) return { created: [], errors: docs.map((d) => ({ filename: d.filename, error: "Not connected to Google." })), notice: null, usedUploadDateFallback: 0 };
    const files = [];
    for (const d of docs) {
      const [msgId, attId] = d.sourceFileId.split(":");
      const res = await fetch(`${GMAIL_API}/messages/${msgId}/attachments/${attId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        files.push({ filename: d.filename, bytes: new Uint8Array(), size: d.size, sourceFileId: d.sourceFileId });
        continue;
      }
      const data = (await res.json()) as { data?: string };
      const bytes = data.data ? Uint8Array.from(atob(data.data.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)) : new Uint8Array();
      files.push({ filename: d.filename, bytes, size: bytes.length, sourceFileId: d.sourceFileId, sourceType: "gmail" });
    }
    return ingest(ctx.store, ctx.userId, files.map((f) => ({ ...f, sourceType: "gmail" })));
  },
};
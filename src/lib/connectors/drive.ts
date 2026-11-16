import { getGoogleAccessToken } from "../google-tokens";
import { ingest } from "../ingest";
import type { DocumentConnector } from "./types";

const DRIVE_API = "https://www.googleapis.com/drive/v3";

export const driveConnector: DocumentConnector = {
  sourceType: "drive",

  async discover(ctx, params) {
    const token = await getGoogleAccessToken(ctx.userId);
    if (!token) return [];
    const folderId = (params as { folderId?: string } | undefined)?.folderId;
    const q = folderId ? `'${folderId}' in parents` : "'root' in parents";
    const params2 = new URLSearchParams({ q, fields: "files(id,name,mimeType,size)", pageSize: "50" });
    const res = await fetch(`${DRIVE_API}/files?${params2}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { files?: { id: string; name: string; mimeType: string; size?: string }[] };
    return (data.files ?? [])
      .filter((f) => f.mimeType !== "application/vnd.google-apps.folder")
      .map((f) => ({
        filename: f.name,
        bytes: new Uint8Array(),
        size: f.size ? Number(f.size) : undefined,
        sourceFileId: f.id,
      }));
  },

  async import(ctx, docs) {
    const token = await getGoogleAccessToken(ctx.userId);
    if (!token) return { created: [], errors: docs.map((d) => ({ filename: d.filename, error: "Not connected to Google." })), notice: null, usedUploadDateFallback: 0 };
    const files = [];
    for (const d of docs) {
      const res = await fetch(`${DRIVE_API}/files/${d.sourceFileId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        files.push({ filename: d.filename, bytes: new Uint8Array(), size: d.size, sourceFileId: d.sourceFileId });
        continue;
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      files.push({ filename: d.filename, bytes: buf, size: buf.length, sourceFileId: d.sourceFileId });
    }
    return ingest(ctx.store, ctx.userId, files.map((f) => ({ ...f, sourceType: "drive" })));
  },
};
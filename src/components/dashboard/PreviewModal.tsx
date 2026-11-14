"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, X } from "lucide-react";

import type { DocumentRecord } from "@/lib/types";

interface PreviewResponse {
  url: string;
  mimeType: string;
  kind: "pdf" | "image";
  filename: string;
  error?: { code: string; message: string };
}

export function PreviewModal({
  doc,
  onClose,
}: {
  doc: DocumentRecord;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/documents/${doc.id}/preview`);
        const data = (await res.json()) as PreviewResponse;
        if (!res.ok) {
          if (!cancelled) {
            setError(data.error?.message ?? "Preview is unavailable.");
          }
          return;
        }
        if (!cancelled) setPreview(data);
      } catch {
        if (!cancelled) setError("Could not load the preview.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc.id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${doc.originalFilename}`}
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-900">
              {doc.originalFilename}
            </h2>
            <p className="text-xs text-slate-500">{doc.mimeType}</p>
          </div>
          <div className="flex items-center gap-1">
            <a
              href={`/api/documents/${doc.id}/download`}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              aria-label={`Download ${doc.originalFilename}`}
              title="Download"
            >
              <Download className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex min-h-[20rem] flex-1 items-center justify-center overflow-auto bg-slate-100 p-3">
          {error && (
            <p className="p-6 text-center text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          {!error && !preview && (
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-hidden="true" />
          )}
          {preview && preview.kind === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.url}
              alt={doc.originalFilename}
              className="max-h-[70vh] rounded-lg bg-white shadow-sm"
            />
          )}
          {preview && preview.kind === "pdf" && (
            <iframe
              src={preview.url}
              title={doc.originalFilename}
              className="h-[70vh] w-full rounded-lg border-0 bg-white shadow-sm"
            />
          )}
        </div>
      </div>
    </div>
  );
}

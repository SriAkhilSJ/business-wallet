"use client";

import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  X,
} from "lucide-react";

import type { JobItem } from "@/lib/collect/job";

interface PreviewResponse {
  url?: string;
  kind?: "pdf" | "image" | "text";
  mimeType?: string;
  error?: { message?: string };
}

/**
 * Shows what is actually inside the pack before it is downloaded: one document
 * at a time, with arrows to move between them. Escape or Cancel closes it.
 */
export function PackPreview({
  items,
  onClose,
}: {
  items: JobItem[];
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [source, setSource] = useState<{ url: string; kind: "pdf" | "image" | "text" } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const item = items[index];
  const last = items.length - 1;

  useEffect(() => {
    if (!item) return;
    let alive = true;
    /* eslint-disable react-hooks/set-state-in-effect -- resetting for the newly selected document */
    setLoading(true);
    setError(null);
    setSource(null);
    /* eslint-enable react-hooks/set-state-in-effect */

    fetch(`/api/documents/${item.id}/preview`)
      .then(async (res) => ({ ok: res.ok, data: (await res.json()) as PreviewResponse }))
      .then(({ ok, data }) => {
        if (!alive) return;
        if (!ok || !data.url) {
          setError(data.error?.message ?? "Preview is not available for this file.");
          return;
        }
        setSource({ url: data.url, kind: data.kind ?? "pdf" });
      })
      .catch(() => {
        if (alive) setError("Could not load the preview.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [item]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setIndex((i) => Math.min(i + 1, last));
      if (event.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last, onClose]);

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pack preview"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {item.filename}
            </p>
            <p className="text-xs text-slate-500">
              {item.category} · {item.date || "date unknown"}
              {item.amount != null ? ` · ₹${item.amount.toLocaleString("en-IN")}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex min-h-[320px] flex-1 items-center justify-center overflow-auto bg-slate-50 p-3">
          {loading && (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading preview…
            </p>
          )}
          {!loading && error && (
            <p className="flex max-w-sm items-center gap-2 text-center text-sm text-slate-600">
              <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
          {!loading && source?.kind === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={source.url}
              alt={item.filename}
              className="max-h-[60vh] w-auto rounded-lg border border-slate-200 bg-white"
            />
          )}
          {!loading && (source?.kind === "pdf" || source?.kind === "text") && (
            <iframe
              src={source.url}
              title={item.filename}
              className="h-[60vh] w-full rounded-lg border border-slate-200 bg-white"
            />
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(i - 1, 0))}
              disabled={index === 0}
              aria-label="Previous document"
              className="rounded-lg border border-slate-300 p-2 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-sm text-slate-600">
              {index + 1} of {items.length}
            </span>
            <button
              type="button"
              onClick={() => setIndex((i) => Math.min(i + 1, last))}
              disabled={index === last}
              aria-label="Next document"
              className="rounded-lg border border-slate-300 p-2 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </footer>
      </div>
    </div>
  );
}

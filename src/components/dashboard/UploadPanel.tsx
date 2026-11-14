"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Info,
  Loader2,
  Upload,
  X,
} from "lucide-react";

import { CATEGORIES, MAX_FILE_SIZE_MB, MAX_FILES_PER_UPLOAD, type Category } from "@/lib/config";
import { formatBytes } from "@/lib/dates";
import type { DocumentRecord } from "@/lib/types";

interface UploadEntry {
  file: File;
  category: Category;
  documentDate: string; // '' means "use upload date"
}

interface UploadResponse {
  documents: DocumentRecord[];
  errors: { filename: string; error: string }[];
  notice: string | null;
  error?: { code: string; message: string };
}

const ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

export function UploadPanel({
  onClose,
  onUploaded,
}: {
  onClose: () => void;
  onUploaded: (result: { created: DocumentRecord[]; notice: string | null }) => void;
}) {
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ filename: string; error: string }[]>([]);
  const [topError, setTopError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list);
    setTopError(null);
    setEntries((prev) => {
      const next = [...prev];
      for (const file of incoming) {
        if (next.length >= MAX_FILES_PER_UPLOAD) {
          setTopError(`You can add up to ${MAX_FILES_PER_UPLOAD} files at a time.`);
          break;
        }
        if (next.some((e) => e.file.name === file.name && e.file.size === file.size)) {
          continue; // skip exact duplicates in the selection
        }
        next.push({ file, category: "Other", documentDate: "" });
      }
      return next;
    });
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files?.length) addFiles(event.dataTransfer.files);
  }

  function update(index: number, patch: Partial<UploadEntry>) {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }

  function remove(index: number) {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit() {
    if (entries.length === 0) return;
    setBusy(true);
    setErrors([]);
    setTopError(null);
    try {
      const form = new FormData();
      const meta = entries.map((e) => ({
        category: e.category,
        documentDate: e.documentDate,
      }));
      form.append("meta", JSON.stringify(meta));
      for (const entry of entries) {
        form.append("files", entry.file, entry.file.name);
      }
      const res = await fetch("/api/documents", { method: "POST", body: form });
      const data = (await res.json()) as UploadResponse;
      if (!res.ok && (!data.documents || data.documents.length === 0)) {
        setTopError(data.error?.message ?? "Upload failed. Please try again.");
        if (data.errors?.length) setErrors(data.errors);
        return;
      }
      if (data.errors?.length) setErrors(data.errors);
      onUploaded({
        created: data.documents ?? [],
        notice: data.notice,
      });
      const failed = data.errors?.length ? data.errors.length : 0;
      if (failed === 0) {
        onClose();
      } else {
        // Keep the panel open so the user can fix rejected files.
        const failedNames = new Set(data.errors.map((e) => e.filename));
        setEntries((prev) => prev.filter((e) => failedNames.has(e.file.name)));
      }
    } catch {
      setTopError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Upload documents"
    >
      <div className="mt-8 w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl sm:mt-0">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Upload documents</h2>
            <p className="mt-1 text-sm text-slate-600">
              PDF, JPG, JPEG or PNG · up to {MAX_FILE_SIZE_MB} MB each ·{" "}
              {MAX_FILES_PER_UPLOAD} files per batch.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close upload panel"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              dragging
                ? "border-brand-500 bg-brand-50"
                : "border-slate-300 bg-slate-50"
            }`}
          >
            <Upload className="h-8 w-8 text-brand-600" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium text-slate-700">
              Drag and drop files here
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-3 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Browse files
            </button>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPT}
              onChange={onInputChange}
              className="hidden"
              aria-label="Choose files to upload"
            />
          </div>

          {entries.length > 0 && (
            <ul className="mt-4 space-y-2">
              {entries.map((entry, index) => (
                <li
                  key={`${entry.file.name}-${entry.file.size}-${index}`}
                  className="rounded-lg border border-slate-200 p-3"
                >
                  <div className="flex items-center gap-3">
                    {entry.file.type.startsWith("image/") ? (
                      <ImageIcon className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                    ) : (
                      <FileText className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {entry.file.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatBytes(entry.file.size)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      aria-label={`Remove ${entry.file.name}`}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor={`category-${index}`}
                        className="block text-xs font-medium text-slate-600"
                      >
                        Category
                      </label>
                      <select
                        id={`category-${index}`}
                        value={entry.category}
                        onChange={(e) =>
                          update(index, { category: e.target.value as Category })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor={`date-${index}`}
                        className="block text-xs font-medium text-slate-600"
                      >
                        Document date (optional)
                      </label>
                      <input
                        id={`date-${index}`}
                        type="date"
                        value={entry.documentDate}
                        onChange={(e) => update(index, { documentDate: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900"
                      />
                    </div>
                  </div>
                  {!entry.documentDate && (
                    <p className="mt-1.5 text-xs text-amber-700">
                      No document date set — the upload date will be used.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {topError && (
            <p
              role="alert"
              className="mt-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {topError}
            </p>
          )}
          {errors.length > 0 && (
            <ul className="mt-3 space-y-1 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {errors.map((e) => (
                <li key={`${e.filename}-${e.error}`}>
                  <strong>{e.filename}:</strong> {e.error}
                </li>
              ))}
            </ul>
          )}
          {entries.length === 0 && !topError && (
            <p className="mt-4 flex items-start gap-2 text-xs text-slate-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Every file is validated on the server (type, content and size).
              Files without a document date are stored with their upload date.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || entries.length === 0}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            )}
            Upload {entries.length > 0 ? `${entries.length} file${entries.length > 1 ? "s" : ""}` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

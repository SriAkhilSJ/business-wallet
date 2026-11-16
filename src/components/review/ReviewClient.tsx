"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";

import { CATEGORIES, type Category } from "@/lib/config";
import type { AppMode } from "@/lib/env";
import type { DocumentRecord } from "@/lib/types";

interface Draft {
  category: Category;
  documentDate: string;
  amount: string;
}

function draftOf(doc: DocumentRecord): Draft {
  return {
    category: doc.category,
    documentDate: doc.documentDate ?? "",
    amount: doc.amount == null ? "" : String(doc.amount),
  };
}

export function ReviewClient({ mode }: { mode: AppMode }) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/review");
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? "Could not load the review queue.");
        return;
      }
      const docs = (data?.documents ?? []) as DocumentRecord[];
      setDocuments(docs);
      setDrafts(Object.fromEntries(docs.map((doc) => [doc.id, draftOf(doc)])));
      setError(null);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Async initial fetch: the rule cannot see past the await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function save(doc: DocumentRecord, override?: Partial<Draft>) {
    const draft = { ...drafts[doc.id], ...override };
    if (!draft) return;
    setSavingId(doc.id);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: draft.category,
          documentDate: draft.documentDate,
          amount: draft.amount.trim() === "" ? null : Number(draft.amount),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? "Could not save.");
        return;
      }
      setDocuments((prev) => prev.filter((item) => item.id !== doc.id));
      setNotice(`Confirmed “${doc.originalFilename}”.`);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Dashboard
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-sm font-semibold text-slate-900">Review</span>
        </div>
      </header>

      {mode === "dev-fallback" && (
        <div className="border-b border-amber-200 bg-amber-50">
          <p className="mx-auto max-w-4xl px-4 py-2 text-xs text-amber-800">
            <strong>Development fallback mode.</strong> Local auth and storage —
            not production-secure.
          </p>
        </div>
      )}

      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Needs your confirmation
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          The app was not sure about these. Confirm or correct them, and they go
          into the next pack.
        </p>

        {notice && (
          <p
            role="status"
            className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {notice}
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {loading ? (
          <p className="mt-8 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading…
          </p>
        ) : documents.length === 0 ? (
          <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" aria-hidden="true" />
            <p className="mt-3 font-medium text-slate-700">Nothing to review</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Every document the app read was clear enough to file on its own.
            </p>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {documents.map((doc) => {
              const draft = drafts[doc.id] ?? draftOf(doc);
              return (
                <li
                  key={doc.id}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        {doc.originalFilename}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {doc.vendor ? `${doc.vendor} · ` : ""}
                        confidence{" "}
                        {doc.confidence == null
                          ? "unknown"
                          : doc.confidence.toFixed(2)}
                      </p>
                    </div>
                    <a
                      href={`/api/documents/${doc.id}/download`}
                      className="text-xs font-medium text-brand-700 hover:underline"
                    >
                      Open file
                    </a>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <label className="block">
                      <span className="text-xs font-medium text-slate-600">
                        Category
                      </span>
                      <select
                        value={draft.category}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [doc.id]: { ...draft, category: e.target.value as Category },
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        {CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-xs font-medium text-slate-600">
                        Document date
                      </span>
                      <input
                        type="date"
                        value={draft.documentDate}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [doc.id]: { ...draft, documentDate: e.target.value },
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-medium text-slate-600">
                        Amount (₹)
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={draft.amount}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [doc.id]: { ...draft, amount: e.target.value },
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </label>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => save(doc)}
                      disabled={savingId === doc.id}
                      className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                    >
                      {savingId === doc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      )}
                      Save
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}

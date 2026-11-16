"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Download,
  FileSearch,
  HelpCircle,
  Loader2,
  ScanSearch,
} from "lucide-react";

import type { CollectionJob } from "@/lib/collect/job";
import type { AppMode } from "@/lib/env";
import { PackPreview } from "@/components/collect/PackPreview";

interface CollectResponse {
  job: CollectionJob;
  businessName: string;
  periodFromNote?: string | null;
  error?: { message: string };
}

export function CollectClient({
  initialFrom,
  initialTo,
  mode,
}: {
  initialFrom: string;
  initialTo: string;
  mode: AppMode;
}) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [allDates, setAllDates] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [job, setJob] = useState<CollectionJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [periodNote, setPeriodNote] = useState<string | null>(null);

  function payload(download = false) {
    return {
      from,
      to,
      minAmount: minAmount.trim() ? Number(minAmount) : null,
      maxAmount: maxAmount.trim() ? Number(maxAmount) : null,
      note,
      allDates,
      download,
    };
  }

  async function collect() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const data = (await res.json()) as CollectResponse;
      if (!res.ok) {
        setError(data?.error?.message ?? "Could not collect. Please try again.");
        return;
      }
      setJob(data.job);
      setPeriodNote(data.periodFromNote ?? null);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch("/api/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload(true)),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error?.message ?? "Could not build the pack.");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const encoded = /filename\*=UTF-8''([^;]+)/.exec(disposition)?.[1];
      const name = encoded ? decodeURIComponent(encoded) : "BusinessVault.zip";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      const duplicates = Number(
        res.headers.get("X-BusinessVault-Duplicates") ?? "0",
      );
      if (duplicates > 0) {
        setNotice(
          `Removed ${duplicates} duplicate file(s) with identical content.`,
        );
      }
    } catch {
      setError("Could not build the pack. Please try again.");
    } finally {
      setDownloading(false);
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
          <span className="text-sm font-semibold text-slate-900">Collect</span>
        </div>
      </header>

      {mode === "dev-fallback" && (
        <div className="border-b border-amber-200 bg-amber-50">
          <p className="mx-auto max-w-4xl px-4 py-2 text-xs text-amber-800">
            <strong>Development fallback mode.</strong> Auth and storage are
            local for testing and are not production-secure.
          </p>
        </div>
      )}

      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Collect documents
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Pick the period, say what your CA asked for, and collect. You will see
          what was found, what needs your confirmation, and what is missing.
        </p>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">From</span>
              <input
                type="date"
                value={from}
                disabled={allDates}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-400"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">To</span>
              <input
                type="date"
                value={to}
                disabled={allDates}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-400"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">
                Amount from (optional)
              </span>
              <input
                type="number"
                min={0}
                inputMode="decimal"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                placeholder="any"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">
                Amount to (optional)
              </span>
              <input
                type="number"
                min={0}
                inputMode="decimal"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                placeholder="any"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={allDates}
              onChange={(event) => setAllDates(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Any date — ignore the period and collect everything
          </label>

          <label className="mt-4 block">
            <span className="text-xs font-medium text-slate-600">
              What does your CA need? (optional)
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="e.g. electricity bill, rent receipt, purchase invoices, UPI proofs, bank statement"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-slate-500">
              Leave it empty to collect everything in the period.
            </span>
          </label>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={collect}
              disabled={busy}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ScanSearch className="h-4 w-4" aria-hidden="true" />
              )}
              {busy ? "Collecting…" : "Collect"}
            </button>
            <span className="text-xs text-slate-500">
              Documents with no readable amount are kept and labelled, never
              dropped.
            </span>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
        </section>

        {job && (
          <>
            {notice && (
              <p
                role="status"
                className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
              >
                {notice}
              </p>
            )}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="In the period" value={job.counts.inPeriod} />
              <Stat label="Ready to send" value={job.counts.included} />
              <Stat label="Needs you" value={job.counts.needsReview} />
              <Stat label="Left out" value={job.counts.excluded} />
            </div>

            {job.counts.amountUnread > 0 && (
              <p className="mt-2 text-xs text-slate-500">
                {job.counts.amountUnread} document(s) have no readable amount, so
                the amount range was not applied to them. They are kept, not
                dropped.
              </p>
            )}

            {periodNote && (
              <p className="mt-2 text-xs text-slate-500">
                Period read from your note ({periodNote}): {job.periodLabel}.
              </p>
            )}

            <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  What the CA asked for
                </h2>
                {job.counts.included > 0 && (
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    Preview
                  </button>
                )}
              </div>
              {job.checklist.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600">
                  No specific items — the pack contains everything found in{" "}
                  {job.periodLabel}.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {job.checklist.map((row) => (
                    <li key={row.id} className="flex items-start gap-2 text-sm">
                      {row.status === "found" && (
                        <CheckCircle2
                          className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                          aria-hidden="true"
                        />
                      )}
                      {row.status === "missing" && (
                        <AlertCircle
                          className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                          aria-hidden="true"
                        />
                      )}
                      {row.status === "review" && (
                        <FileSearch
                          className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                          aria-hidden="true"
                        />
                      )}
                      {row.status === "download" && (
                        <HelpCircle
                          className="mt-0.5 h-4 w-4 shrink-0 text-sky-600"
                          aria-hidden="true"
                        />
                      )}
                      {row.status === "cannot" && (
                        <HelpCircle
                          className="mt-0.5 h-4 w-4 shrink-0 text-rose-600"
                          aria-hidden="true"
                        />
                      )}
                      <span className="flex-1">
                        <span className="font-medium text-slate-800">
                          {row.label}
                        </span>
                        <span className="ml-2 text-slate-600">
                          {row.status === "found" && `${row.count} file(s)`}
                          {row.status === "missing" && "not found"}
                          {row.status === "review" &&
                            `${row.count} file(s) — ${row.hint ?? "needs your confirmation"}`}
                          {row.status === "download" && row.hint}
                          {row.status === "cannot" && row.hint}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={download}
                  disabled={downloading || job.counts.included === 0}
                  className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {downloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="h-4 w-4" aria-hidden="true" />
                  )}
                  {downloading ? "Building…" : "Download pack"}
                </button>
                <span className="text-xs text-slate-500">
                  {job.periodLabel} · {job.counts.included} document(s)
                </span>
              </div>
            </section>

            {job.counts.needsReview > 0 && (
              <section className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                  <FileSearch className="h-4 w-4" aria-hidden="true" />
                  Needs your confirmation ({job.counts.needsReview})
                </h2>
                <p className="mt-1 text-xs text-amber-800">
                  These have no confirmed category, so they are kept out of the
                  pack until someone says what they are.
                </p>
                <ul className="mt-3 space-y-1 text-sm text-amber-900">
                  {job.items
                    .filter((item) => item.decision === "review")
                    .map((item) => (
                      <li key={item.id} className="truncate">
                        {item.filename}
                      </li>
                    ))}
                </ul>
              </section>
            )}

            {job.counts.included > 0 && (
              <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-slate-900">
                  In this pack ({job.counts.included})
                </h2>
                <ul className="mt-3 divide-y divide-slate-100">
                  {job.items
                    .filter((item) => item.decision === "include")
                    .map((item) => (
                      <li
                        key={item.id}
                        className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm"
                      >
                        <span className="min-w-0 truncate font-medium text-slate-800">
                          {item.filename}
                        </span>
                        <span className="text-xs text-slate-500">
                          {item.category} · {item.date || "date unknown"}
                          {item.amount != null
                            ? ` · ₹${item.amount.toLocaleString("en-IN")}`
                            : ""}
                        </span>
                      </li>
                    ))}
                </ul>
              </section>
            )}

            {job.items.some((item) => item.decision === "excluded") && (
              <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-slate-900">
                  Left out ({job.counts.excluded})
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Nothing was deleted. Each file says why it is not in the pack.
                </p>
                <ul className="mt-3 divide-y divide-slate-100">
                  {job.items
                    .filter((item) => item.decision === "excluded")
                    .map((item) => (
                      <li
                        key={item.id}
                        className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm"
                      >
                        <span className="min-w-0 truncate font-medium text-slate-800">
                          {item.filename}
                        </span>
                        <span className="text-xs text-slate-500">
                          {item.reasons[0] ?? "not selected"}
                        </span>
                      </li>
                    ))}
                </ul>
              </section>
            )}

            {job.items.some((item) => item.decision === "duplicate") && (
              <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-slate-900">
                  Duplicates ({job.items.filter((i) => i.decision === "duplicate").length})
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Identical files. One copy is in the pack; these were not added
                  again.
                </p>
                <ul className="mt-3 divide-y divide-slate-100">
                  {job.items
                    .filter((item) => item.decision === "duplicate")
                    .map((item) => (
                      <li
                        key={item.id}
                        className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm"
                      >
                        <span className="min-w-0 truncate font-medium text-slate-800">
                          {item.filename}
                        </span>
                        <span className="text-xs text-slate-500">
                          {item.reasons[0]}
                        </span>
                      </li>
                    ))}
                </ul>
              </section>
            )}

            {previewOpen && (
              <PackPreview
                items={job.items.filter((item) => item.decision === "include")}
                onClose={() => setPreviewOpen(false)}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

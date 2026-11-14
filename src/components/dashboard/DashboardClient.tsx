"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import {
  AlertCircle,
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Database,
  Download,
  FileArchive,
  FileText,
  FolderOpen,
  Info,
  Loader2,
  LogOut,
  PackageOpen,
  Search,
  Upload,
  X,
} from "lucide-react";

import { Logo } from "@/components/Logo";
import { ConfirmDialog } from "@/components/dashboard/ConfirmDialog";
import { DocumentList } from "@/components/dashboard/DocumentList";
import { PreviewModal } from "@/components/dashboard/PreviewModal";
import { UploadPanel } from "@/components/dashboard/UploadPanel";
import { CATEGORIES, MAX_SEARCH_LENGTH, type Category } from "@/lib/config";
import {
  formatDateDisplay,
  MONTH_NAMES,
  monthLabel,
  todayUtcDate,
} from "@/lib/dates";
import type { AppMode } from "@/lib/env";
import {
  filterDocuments,
  type DocumentSummary,
} from "@/lib/filters";
import type { DocumentRecord } from "@/lib/types";

const YEAR_OPTIONS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

interface ListResponse {
  documents: DocumentRecord[];
  summary: DocumentSummary;
  error?: { code: string; message: string };
}

export function DashboardClient({
  user,
  businessName,
  mode,
  initialMonth,
  initialYear,
}: {
  user: { email: string; fullName: string | null };
  businessName: string;
  mode: AppMode;
  initialMonth: number;
  initialYear: number;
}) {
  const router = useRouter();

  const [allDocs, setAllDocs] = useState<DocumentRecord[]>([]);
  const [summary, setSummary] = useState<DocumentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // Filters. Initial month/year come from the server (UTC "today") so the
  // server-rendered HTML and the first client render always match.
  const [month, setMonth] = useState<number | "all">(initialMonth);
  const [year, setYear] = useState<number>(initialYear);
  const [category, setCategory] = useState<Category | "all">("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentRecord | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [samplesBusy, setSamplesBusy] = useState(false);

  /* ----------------------------- data load ---------------------------- */

  const load = useCallback(
    () =>
      fetch("/api/documents")
        .then((res) =>
          res
            .json()
            .then((data: ListResponse) => ({ ok: res.ok, data }))
            .catch(() => ({ ok: false, data: null })),
        )
        .then(({ ok, data }) => {
          if (!ok || !data) {
            setListError(
              data?.error?.message ??
                "Could not load documents. Please try again.",
            );
            return;
          }
          setAllDocs(data.documents);
          setSummary(data.summary);
          setListError(null);
        })
        .catch(() => {
          setListError("Could not reach the server. Please try again.");
        })
        .finally(() => {
          setLoading(false);
        }),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Debounced search → applied client-side via shared filter logic.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filtered = useMemo(
    () =>
      filterDocuments(allDocs, {
        month: month === "all" ? null : month,
        year,
        category: category === "all" ? null : category,
        search: search || null,
      }),
    [allDocs, month, year, category, search],
  );

  const exportCount = useMemo(
    () =>
      month === "all"
        ? 0
        : filterDocuments(allDocs, { month, year }).length,
    [allDocs, month, year],
  );

  const filtersActive =
    month !== "all" || category !== "all" || search.length > 0;

  /* ------------------------------ actions ----------------------------- */

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setBannerError(null);
    try {
      const res = await fetch(`/api/documents/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBannerError(
          data?.error?.message ?? "Could not delete the document.",
        );
      } else {
        setNotice(`Deleted “${deleteTarget.originalFilename}”.`);
        setDeleteTarget(null);
        await load();
      }
    } catch {
      setBannerError("Could not reach the server. Please try again.");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function handleExport() {
    if (month === "all" || exporting) return;
    setExporting(true);
    setBannerError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setBannerError(
          data?.error?.message ?? "Export failed. Please try again.",
        );
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `BusinessVault_${MONTH_NAMES[month - 1]}_${year}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice(
        `Downloaded ${link.download} with ${res.headers.get("X-BusinessVault-Documents") ?? exportCount} document(s).`,
      );
    } catch {
      setBannerError("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  async function handleLoadSamples() {
    setSamplesBusy(true);
    setBannerError(null);
    try {
      const res = await fetch("/api/dev/load-samples", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBannerError(data?.error?.message ?? "Could not load samples.");
        return;
      }
      const count = data.documents?.length ?? 0;
      const skipped = data.skipped?.length ?? 0;
      setNotice(
        `Sample documents ready: ${count} loaded${skipped > 0 ? `, ${skipped} already present` : ""}.`,
      );
      await load();
    } catch {
      setBannerError("Could not reach the server. Please try again.");
    } finally {
      setSamplesBusy(false);
    }
  }

  async function handleSignOut() {
    await fetch("/api/auth/sign-out", { method: "POST" }).catch(() => null);
    router.push("/");
    router.refresh();
  }

  /* ------------------------------- render ----------------------------- */

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Logo />
            <span className="hidden truncate rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 sm:inline-block">
              {businessName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden max-w-[14rem] truncate text-sm text-slate-500 md:inline-block">
              {user.fullName ?? user.email}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      {mode === "dev-fallback" && (
        <div className="border-b border-amber-200 bg-amber-50">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 text-xs text-amber-800">
            <span className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              Development fallback mode
            </span>
            <span className="flex-1">
              Auth and storage are local for testing and are{" "}
              <strong>not production-secure</strong>. Configure Supabase (see
              README) for the real setup.
            </span>
            <button
              type="button"
              onClick={handleLoadSamples}
              disabled={samplesBusy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-60"
            >
              {samplesBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Database className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Load sample documents
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Page title */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Upload, organize and export your business documents.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            Upload documents
          </button>
        </div>

        {/* Stat cards */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={FileText}
            label="Total documents"
            value={summary ? String(summary.total) : "—"}
          />
          <StatCard
            icon={CalendarRange}
            label="This month (UTC)"
            value={summary ? String(summary.currentMonthCount) : "—"}
            hint={formatDateDisplay(todayUtcDate())}
          />
          <StatCard
            icon={FolderOpen}
            label="Categories used"
            value={
              summary
                ? String(
                    CATEGORIES.filter((c) => summary.byCategory[c] > 0).length,
                  )
                : "—"
            }
            hint={`of ${CATEGORIES.length} categories`}
          />
          <StatCard
            icon={PackageOpen}
            label="Latest upload"
            value={
              summary && summary.recent.length > 0
                ? formatDateDisplay(summary.recent[0].createdAt)
                : "—"
            }
            hint={
              summary && summary.recent.length > 0
                ? summary.recent[0].originalFilename
                : "Nothing uploaded yet"
            }
          />
        </div>

        {/* Category summary + recent uploads */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section
            aria-label="Category summary"
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <h2 className="text-sm font-semibold text-slate-900">
              Category summary
            </h2>
            <ul className="mt-3 space-y-2">
              {CATEGORIES.map((c) => {
                const count = summary?.byCategory[c] ?? 0;
                const pct = summary && summary.total > 0 ? (count / summary.total) * 100 : 0;
                return (
                  <li key={c} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 text-xs text-slate-600">
                      {c}
                    </span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <span
                        className="block h-full rounded-full bg-brand-500"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                    <span className="w-6 text-right text-xs font-medium text-slate-700">
                      {count}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section
            aria-label="Recent uploads"
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <h2 className="text-sm font-semibold text-slate-900">
              Recent uploads
            </h2>
            {summary && summary.recent.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {summary.recent.map((doc) => (
                  <li key={doc.id} className="flex items-center gap-3">
                    <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                      {doc.originalFilename}
                    </span>
                    <span className="whitespace-nowrap text-xs text-slate-500">
                      {formatDateDisplay(doc.documentDate ?? doc.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                No uploads yet. Your latest documents will appear here.
              </p>
            )}
          </section>
        </div>

        {/* Export panel */}
        <section
          aria-label="Monthly export"
          className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4"
        >
          <FileArchive className="h-5 w-5 text-brand-700" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-brand-900">
              Monthly ZIP export
              {month !== "all" && ` — ${monthLabel(month, year)}`}
            </p>
            <p className="text-xs text-brand-800">
              {month === "all"
                ? "Pick a month above to export its documents for your CA."
                : `Includes all ${exportCount} document(s) of ${monthLabel(month, year)} (category and search filters don't apply to the export).`}
            </p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={month === "all" || exporting || exportCount === 0}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            {exporting
              ? "Preparing ZIP…"
              : month === "all"
                ? "Export ZIP"
                : `Export ${monthLabel(month, year)} (${exportCount})`}
          </button>
        </section>

        {/* Filters */}
        <section
          aria-label="Filters"
          className="mt-6 flex flex-wrap items-end gap-3"
        >
          <div className="relative min-w-[14rem] flex-1">
            <label
              htmlFor="search"
              className="block text-xs font-medium text-slate-600"
            >
              Search filenames
            </label>
            <Search
              className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="search"
              type="search"
              value={searchInput}
              maxLength={MAX_SEARCH_LENGTH}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setSearchInput(e.target.value)
              }
              placeholder="e.g. invoice, electricity…"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div>
            <label
              htmlFor="filter-month"
              className="block text-xs font-medium text-slate-600"
            >
              Month
            </label>
            <select
              id="filter-month"
              value={String(month)}
              onChange={(e) =>
                setMonth(e.target.value === "all" ? "all" : Number(e.target.value))
              }
              className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="all">All months</option>
              {MONTH_NAMES.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-year"
              className="block text-xs font-medium text-slate-600"
            >
              Year
            </label>
            <select
              id="filter-year"
              value={String(year)}
              onChange={(e) => setYear(Number(e.target.value))}
              className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-category"
              className="block text-xs font-medium text-slate-600"
            >
              Category
            </label>
            <select
              id="filter-category"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as Category | "all")
              }
              className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="all">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {filtersActive && (
            <button
              type="button"
              onClick={() => {
                setMonth("all");
                setCategory("all");
                setSearchInput("");
                setSearch("");
              }}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Clear filters
            </button>
          )}
        </section>

        {/* Banners */}
        {notice && (
          <p
            role="status"
            className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Dismiss"
              className="rounded p-0.5 hover:bg-emerald-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </p>
        )}
        {bannerError && (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{bannerError}</span>
            <button
              type="button"
              onClick={() => setBannerError(null)}
              aria-label="Dismiss"
              className="rounded p-0.5 hover:bg-red-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </p>
        )}

        {/* Result count */}
        {!loading && !listError && (
          <p className="mt-5 text-xs text-slate-500" aria-live="polite">
            Showing {filtered.length} of {allDocs.length} document(s)
            {month !== "all" ? ` for ${monthLabel(month, year)}` : ""}
            {category !== "all" ? ` · ${category}` : ""}
            {search ? ` · “${search}”` : ""}.
          </p>
        )}

        {/* Document list */}
        <div className="mt-2">
          <DocumentList
            documents={filtered}
            loading={loading}
            error={listError}
            onPreview={setPreviewDoc}
            onDelete={setDeleteTarget}
            onRetry={() => {
              setLoading(true);
              setListError(null);
              void load();
            }}
          />
        </div>

        {listError && (
          <p className="mt-3 flex items-start gap-2 text-xs text-slate-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Your documents are safe — this is only a loading problem.
          </p>
        )}
      </main>

      {/* Modals */}
      {uploadOpen && (
        <UploadPanel
          onClose={() => setUploadOpen(false)}
          onUploaded={async ({ created, notice: uploadNotice }) => {
            setNotice(
              `${created.length} document(s) uploaded.${uploadNotice ? ` ${uploadNotice}` : ""}`,
            );
            await load();
          }}
        />
      )}
      {previewDoc && (
        <PreviewModal
          key={previewDoc.id}
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete document?"
          message={`“${deleteTarget.originalFilename}” will be permanently deleted, including its stored file. This cannot be undone.`}
          confirmLabel="Delete"
          busy={deleteBusy}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Icon className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="truncate text-xl font-semibold text-slate-900">{value}</p>
          {hint && <p className="truncate text-xs text-slate-400">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

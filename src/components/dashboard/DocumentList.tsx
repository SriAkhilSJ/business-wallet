"use client";

import {
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  Inbox,
  Loader2,
  Trash2,
} from "lucide-react";

import { CATEGORIES, type Category } from "@/lib/config";
import { formatBytes, formatDateDisplay } from "@/lib/dates";
import type { DocumentRecord } from "@/lib/types";

const CATEGORY_STYLES: Record<Category, string> = {
  "Sales Invoice": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Purchase Invoice": "bg-sky-50 text-sky-700 border-sky-200",
  Expense: "bg-amber-50 text-amber-700 border-amber-200",
  Receipt: "bg-violet-50 text-violet-700 border-violet-200",
  "Utility Bill": "bg-orange-50 text-orange-700 border-orange-200",
  "Payment Proof": "bg-teal-50 text-teal-700 border-teal-200",
  Other: "bg-slate-100 text-slate-600 border-slate-200",
};

function CategoryBadge({ category }: { category: Category }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${CATEGORY_STYLES[category] ?? CATEGORY_STYLES.Other}`}
    >
      {category}
    </span>
  );
}

function FileIcon({ mimeType }: { mimeType: string }) {
  return mimeType === "application/pdf" ? (
    <FileText className="h-5 w-5 shrink-0 text-red-500" aria-hidden="true" />
  ) : (
    <ImageIcon className="h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
  );
}

export function DocumentList({
  documents,
  loading,
  error,
  onPreview,
  onDelete,
  onRetry,
}: {
  documents: DocumentRecord[];
  loading: boolean;
  error: string | null;
  onPreview: (doc: DocumentRecord) => void;
  onDelete: (doc: DocumentRecord) => void;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-12 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        Loading documents…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-white p-8 text-center">
        <p className="font-medium text-red-700">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Try again
        </button>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <Inbox className="h-10 w-10 text-slate-300" aria-hidden="true" />
        <p className="mt-3 font-medium text-slate-700">No documents found</p>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          Upload bills, invoices or receipts, or adjust the filters above to see
          documents from another month or category.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* Desktop table */}
      <table className="hidden w-full text-left text-sm md:table">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="px-4 py-3">Document</th>
            <th scope="col" className="px-4 py-3">Category</th>
            <th scope="col" className="px-4 py-3">Document date</th>
            <th scope="col" className="px-4 py-3">Amount</th>
            <th scope="col" className="px-4 py-3">Uploaded</th>
            <th scope="col" className="px-4 py-3">Size</th>
            <th scope="col" className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {documents.map((doc) => (
            <tr key={doc.id} className="hover:bg-slate-50/70">
              <td className="max-w-[20rem] px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <FileIcon mimeType={doc.mimeType} />
                  <div className="min-w-0">
                    <span className="block truncate font-medium text-slate-900">
                      {doc.originalFilename}
                    </span>
                    {doc.vendor && (
                      <span className="block truncate text-xs text-slate-500">
                        {doc.vendor}
                      </span>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <CategoryBadge category={doc.category} />
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                {doc.documentDate ? (
                  formatDateDisplay(doc.documentDate)
                ) : (
                  <span className="text-slate-400">date unknown</span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                {doc.amount == null ? (
                  <span className="text-slate-400">—</span>
                ) : (
                  `₹${doc.amount.toLocaleString("en-IN")}`
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                {formatDateDisplay(doc.createdAt)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                {formatBytes(doc.fileSize)}
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => onPreview(doc)}
                    title="Preview"
                    aria-label={`Preview ${doc.originalFilename}`}
                    className="rounded-lg p-2 text-slate-500 hover:bg-brand-50 hover:text-brand-700"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <a
                    href={`/api/documents/${doc.id}/download`}
                    title="Download"
                    aria-label={`Download ${doc.originalFilename}`}
                    className="rounded-lg p-2 text-slate-500 hover:bg-brand-50 hover:text-brand-700"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => onDelete(doc)}
                    title="Delete"
                    aria-label={`Delete ${doc.originalFilename}`}
                    className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile cards */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {documents.map((doc) => (
          <li key={doc.id} className="p-4">
            <div className="flex items-start gap-2.5">
              <FileIcon mimeType={doc.mimeType} />
              <div className="min-w-0 flex-1">
                <p className="break-all font-medium text-slate-900">
                  {doc.originalFilename}
                </p>
                {doc.vendor && (
                  <p className="truncate text-xs text-slate-500">{doc.vendor}</p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <CategoryBadge category={doc.category} />
                  <span className="text-xs text-slate-500">
                    {doc.documentDate ? formatDateDisplay(doc.documentDate) : "date unknown"}
                  </span>
                  {doc.amount != null && (
                    <span className="text-xs font-medium text-slate-700">
                      ₹{doc.amount.toLocaleString("en-IN")}
                    </span>
                  )}
                  <span className="text-xs text-slate-400">
                    {formatBytes(doc.fileSize)}
                  </span>
                </div>
                <div className="mt-2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => onPreview(doc)}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600"
                    aria-label={`Preview ${doc.originalFilename}`}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <a
                    href={`/api/documents/${doc.id}/download`}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600"
                    aria-label={`Download ${doc.originalFilename}`}
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => onDelete(doc)}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600"
                    aria-label={`Delete ${doc.originalFilename}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function categoryLabel(value: string): Category | null {
  return (CATEGORIES as readonly string[]).includes(value)
    ? (value as Category)
    : null;
}

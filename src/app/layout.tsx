import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { APP_NAME } from "@/lib/config";

import "./globals.css";

export const metadata: Metadata = {
  title: `${APP_NAME} — Business Financial Document Management`,
  description:
    "Collect bills, invoices and receipts in one place. Filter by month, download a ZIP and share it with your CA.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {new Date().getFullYear()} {APP_NAME} — Proof of Concept. Not a
              commercial product.
            </p>
            <p>
              <Link href="/sign-in" className="text-brand-700 hover:underline">
                Sign in
              </Link>
              <span aria-hidden="true" className="mx-2 text-slate-300">
                ·
              </span>
              <Link href="/sign-up" className="text-brand-700 hover:underline">
                Get started
              </Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}

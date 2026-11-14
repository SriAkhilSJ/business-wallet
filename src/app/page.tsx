import Link from "next/link";
import {
  ArrowRight,
  CalendarRange,
  FileArchive,
  FolderOpen,
  Mail,
  MessageSquare,
  Receipt,
  Search,
  ShieldCheck,
  Smartphone,
  Upload,
  Wallet,
} from "lucide-react";

import { Logo } from "@/components/Logo";
import { APP_NAME } from "@/lib/config";

const SCATTERED = [
  { icon: Smartphone, label: "Phone gallery" },
  { icon: MessageSquare, label: "WhatsApp chats" },
  { icon: Mail, label: "Email attachments" },
  { icon: Receipt, label: "Paper receipts" },
  { icon: FolderOpen, label: "PDF folders" },
  { icon: Wallet, label: "SMS messages" },
];

const STEPS = [
  {
    icon: Upload,
    title: "Upload",
    text: "Drag in bills, invoices and receipts — PDF, JPG or PNG. Tag each one with a category and date.",
  },
  {
    icon: CalendarRange,
    title: "Organize by month",
    text: "Everything is grouped by document date, so November's paperwork stays in November.",
  },
  {
    icon: Search,
    title: "Filter & find",
    text: "Jump to any month, year or category in seconds. Search by filename when you know what you need.",
  },
  {
    icon: FileArchive,
    title: "Download one ZIP",
    text: `Export a whole month as a single ${APP_NAME} archive — clean filenames, ready to send.`,
  },
  {
    icon: ShieldCheck,
    title: "Share with your CA",
    text: "Send the ZIP through whatever channel you already use. Your CA gets everything in one handover.",
  },
];

const FEATURES = [
  {
    icon: Upload,
    title: "Fast multi-file upload",
    text: "Add many documents at once with per-file category and date. Server-side validation keeps everything safe.",
  },
  {
    icon: CalendarRange,
    title: "Monthly filtering",
    text: "Month and year selectors plus category filters make month-end collection painless.",
  },
  {
    icon: FileArchive,
    title: "Real ZIP export",
    text: "One click produces a real archive with original filenames, de-duplicated and manifest included.",
  },
  {
    icon: ShieldCheck,
    title: "Private by default",
    text: "Documents live in private storage. Only you can access your business documents.",
  },
  {
    icon: FolderOpen,
    title: "Preview & manage",
    text: "Preview images and PDFs, check dates and sizes, and delete what you no longer need.",
  },
  {
    icon: Wallet,
    title: "Built for month-end",
    text: "The workflow matches what CAs actually ask for: this month's bills, receipts and proofs.",
  },
];

export default function LandingPage() {
  return (
    <main className="flex-1">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/sign-in"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-600" aria-hidden="true" />
            Proof of Concept — problem hypothesis under validation
          </p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            All your business documents, ready for your CA — every month.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-600">
            {APP_NAME} collects your bills, invoices and receipts in one
            organized place. Filter by month, download a single ZIP, and share
            it with your Chartered Accountant in minutes instead of hours.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              Get started free
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              See how it works
            </Link>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Month-end shouldn&apos;t mean a scavenger hunt
        </h2>
        <p className="mt-3 max-w-2xl text-slate-600">
          Financial documents end up scattered everywhere. When your CA asks
          for last month&apos;s paperwork, the search begins across every app
          and folder you own.
        </p>
        <ul className="mt-6 flex flex-wrap gap-2.5">
          {SCATTERED.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-600 shadow-sm"
            >
              <Icon className="h-4 w-4 text-slate-400" aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            How the monthly workflow works
          </h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((step, index) => (
              <li key={step.title} className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                  <step.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-brand-700">
                  Step {index + 1}
                </p>
                <h3 className="mt-1 font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-1.5 text-sm text-slate-600">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Everything you need for this POC workflow
        </h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
              <p className="mt-1.5 text-sm text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-600">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Make next month-end the easy one
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-brand-100">
            Try the {APP_NAME} proof of concept: upload a few documents,
            filter by month, and download your first CA handover ZIP.
          </p>
          <Link
            href="/sign-up"
            className="mt-7 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-brand-700 shadow-sm hover:bg-brand-50"
          >
            Get started free
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}

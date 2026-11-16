"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AlertCircle, Info, Loader2 } from "lucide-react";

import { Logo } from "@/components/Logo";
import type { AppMode } from "@/lib/env";

interface AuthResponse {
  user: { id: string; email: string; fullName: string | null } | null;
  business: { id: string; businessName: string } | null;
  emailConfirmationRequired?: boolean;
  error?: { code: string; message: string };
}

export function AuthForm({
  variant,
  mode,
}: {
  variant: "sign-in" | "sign-up";
  mode: AppMode;
}) {
  const router = useRouter();
  const isSignUp = variant === "sign-up";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [aiConsent, setAiConsent] = useState(false);
const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${isSignUp ? "sign-up" : "sign-in"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isSignUp
            ? { email, password, fullName, businessName, aiConsent }
            : { email, password },
        ),
      });
      const data = (await res.json()) as AuthResponse;
      if (!res.ok) {
        setError(data.error?.message ?? "Something went wrong. Please try again.");
        return;
      }
      if (data.emailConfirmationRequired) {
        setInfo(
          "Account created. Check your inbox to confirm your email, then sign in.",
        );
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-semibold text-slate-900">
            {isSignUp ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {isSignUp
              ? "Start organizing your business documents in minutes."
              : "Sign in to your BusinessVault dashboard."}
          </p>

          {mode === "dev-fallback" && (
            <p className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                <strong>Development mode.</strong> Authentication is a local
                fallback (any email and password of 8+ characters works) and is{" "}
                <strong>not production-secure</strong>. Configure Supabase to
                use real authentication.
              </span>
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {isSignUp && (
              <>
                <div>
                  <label
                    htmlFor="fullName"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Full name
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    required
                    maxLength={120}
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600"
                    placeholder="Priya Sharma"
                  />
                </div>
                <div>
                  <label
                    htmlFor="businessName"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Business name
                  </label>
                  <input
                    id="businessName"
                    type="text"
                    required
                    maxLength={160}
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600"
                    placeholder="Sharma Traders"
                  />
                </div>
              </>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600"
                placeholder="you@business.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                maxLength={72}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600"
                placeholder="At least 8 characters"
              />
            </div>

            {isSignUp && (
              <label className="flex items-start gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  required
                  checked={aiConsent}
                  onChange={(e) => setAiConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />
                <span>
                  I consent to BusinessVault sending my document text to an AI
                  provider for classification and extraction. (Required)
                </span>
              </label>
            )}

            {error && (
              <p
                role="alert"
                className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {error}
              </p>
            )}
            {info && (
              <p
                role="status"
                className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
              >
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {info}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {isSignUp ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            {isSignUp ? (
              <>
                Already have an account?{" "}
                <Link href="/sign-in" className="font-medium text-brand-700 hover:underline">
                  Sign in
                </Link>
              </>
            ) : (
              <>
                New to BusinessVault?{" "}
                <Link href="/sign-up" className="font-medium text-brand-700 hover:underline">
                  Create an account
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </main>
  );
}

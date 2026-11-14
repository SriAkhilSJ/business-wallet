import Link from "next/link";

import { APP_NAME } from "@/lib/config";

/** BusinessVault logo mark + wordmark. */
export function Logo({
  size = "md",
  href = "/",
}: {
  size?: "sm" | "md" | "lg";
  href?: string | null;
}) {
  const text =
    size === "lg"
      ? "text-2xl"
      : size === "sm"
        ? "text-base"
        : "text-xl";
  const box = size === "lg" ? "h-10 w-10" : size === "sm" ? "h-7 w-7" : "h-8 w-8";

  const mark = (
    <span className="flex items-center gap-2.5">
      <span
        className={`flex ${box} items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-[60%] w-[60%]"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2.5 4.5 5.5v5.2c0 4.6 3 8.4 7.5 10.3 4.5-1.9 7.5-5.7 7.5-10.3V5.5L12 2.5Z" />
          <path d="M9 11.8l2.2 2.2L15.4 9.6" />
        </svg>
      </span>
      <span className={`font-semibold tracking-tight text-slate-900 ${text}`}>
        {APP_NAME}
      </span>
    </span>
  );

  if (!href) return mark;
  return (
    <Link href={href} aria-label={`${APP_NAME} home`} className="shrink-0">
      {mark}
    </Link>
  );
}

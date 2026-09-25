"use client";

import Link from "next/link";
import type { AppLocale } from "@/i18n/routing";

interface HeaderUserMenuProps {
  locale: AppLocale;
  user: {
    displayName: string;
    email: string;
    roles: string[];
  };
  labels: {
    dashboard: string;
    logout?: string;
  };
}

export function HeaderUserMenu({ locale, user, labels }: HeaderUserMenuProps) {
  // Role-based destination
  let dashboardHref = `/${locale}/orders`;
  if (user.roles?.includes("admin")) {
    dashboardHref = `/${locale}/admin`;
  } else if (user.roles?.includes("creator")) {
    dashboardHref = `/${locale}/creator/orders`;
  }

  const primaryRole = user.roles?.includes("admin")
    ? "Admin"
    : user.roles?.includes("creator")
      ? "Creator"
      : "Client";

  const initial = user.displayName
    ? user.displayName.charAt(0).toUpperCase()
    : "U";

  return (
    <Link
      href={dashboardHref}
      className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/40 transition-all text-xs group"
      title={labels.dashboard}
      aria-label={labels.dashboard}
    >
      <div className="w-8 h-8 sm:w-6 sm:h-6 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center font-bold text-xs sm:text-[11px] text-white shadow-sm ring-1 ring-white/20 group-hover:ring-blue-400 group-hover:scale-105 transition-all shrink-0">
        {initial}
      </div>
      <div className="hidden sm:flex flex-col text-left leading-none max-w-[120px]">
        <span className="truncate font-semibold text-white/90 text-xs group-hover:text-white">
          {user.displayName || "User"}
        </span>
        <span className="text-[10px] text-blue-400 uppercase tracking-wider font-mono">
          {primaryRole}
        </span>
      </div>
    </Link>
  );
}

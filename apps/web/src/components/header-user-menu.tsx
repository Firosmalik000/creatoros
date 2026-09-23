"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutDashboard, LogOut, Loader2 } from "lucide-react";
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
    logout: string;
  };
}

export function HeaderUserMenu({ locale, user, labels }: HeaderUserMenuProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

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

  async function handleLogout() {
    try {
      setLoggingOut(true);
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      router.push(`/${locale}`);
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  const initial = user.displayName
    ? user.displayName.charAt(0).toUpperCase()
    : "U";

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {/* Dashboard Shortcut Button */}
      <Link
        href={dashboardHref}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 text-xs sm:text-sm font-semibold transition-all duration-200 hover:border-blue-500/40"
      >
        <LayoutDashboard size={15} className="shrink-0" />
        <span className="hidden sm:inline">{labels.dashboard}</span>
      </Link>

      {/* User Info Capsule */}
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs">
        <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center font-bold text-[11px] text-white shadow-sm shrink-0">
          {initial}
        </div>
        <div className="hidden md:flex flex-col text-left leading-none max-w-[120px]">
          <span className="truncate font-semibold text-white/90 text-xs">
            {user.displayName || "User"}
          </span>
          <span className="text-[10px] text-white/40 uppercase tracking-wider font-mono">
            {primaryRole}
          </span>
        </div>
      </div>

      {/* Quick Sign Out Action */}
      <button
        onClick={handleLogout}
        disabled={loggingOut}
        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
        title={labels.logout}
        aria-label={labels.logout}
      >
        {loggingOut ? (
          <Loader2 size={16} className="animate-spin text-rose-400" />
        ) : (
          <LogOut size={16} />
        )}
      </button>
    </div>
  );
}

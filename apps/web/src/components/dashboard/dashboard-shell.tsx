"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import type { AppLocale } from "@/i18n/routing";
import { DashboardSidebar } from "./dashboard-sidebar";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { NotificationBell } from "@/components/communication/notification-bell";

interface DashboardShellProps {
  children: React.ReactNode;
  locale: AppLocale;
  role: "admin" | "creator" | "client";
  user?: {
    email?: string;
    displayName?: string;
    roles?: string[];
  } | null;
  labels?: {
    overview?: string;
    commerce?: string;
    finance?: string;
    management?: string;
    system?: string;
    orders?: string;
    campaigns?: string;
    disputes?: string;
    services?: string;
    wallet?: string;
    users?: string;
    verifications?: string;
    categories?: string;
    announcements?: string;
    audit?: string;
    settings?: string;
    profileAndSocial?: string;
    backToMarketplace?: string;
    logout?: string;
    language?: string;
    notificationsTitle?: string;
    markAllRead?: string;
    emptyNotifications?: string;
    viewAllNotifications?: string;
  };
}

export function DashboardShell({
  children,
  locale,
  role,
  user,
  labels = {},
}: DashboardShellProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#070a10] text-slate-100 flex flex-col antialiased">
      {/* Sidebar */}
      <DashboardSidebar
        locale={locale}
        role={role}
        user={user}
        labels={labels}
        isOpenMobile={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Main Workspace Layout (Offset by Sidebar width on lg) */}
      <div className="flex-1 flex flex-col lg:pl-72 transition-all duration-300">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 h-16 bg-[#070a10]/80 backdrop-blur-md border-b border-white/10 px-4 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setIsMobileOpen(true)}
              className="p-2 -ml-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 lg:hidden transition-colors"
              aria-label="Open sidebar navigation"
            >
              <Menu size={20} />
            </button>

            {/* Quick Live System Indicator */}
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-medium text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Network Live · SLA 99.9%</span>
            </div>
          </div>

          {/* Right Utilities */}
          <div className="flex items-center gap-3 sm:gap-4">
            <NotificationBell
              locale={locale}
              labels={{
                title: labels.notificationsTitle ?? "Notifications",
                markAllRead: labels.markAllRead ?? "Mark all as read",
                empty: labels.emptyNotifications ?? "No notifications yet",
                viewAll: labels.viewAllNotifications ?? "View all notifications",
              }}
            />

            <LocaleSwitcher
              locale={locale}
              label={labels.language ?? "Language"}
            />

            {/* Role Badge Chip */}
            <div className="hidden md:flex items-center gap-2 pl-3 border-l border-white/10">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center font-bold text-xs text-white shadow-sm">
                {user?.displayName ? user.displayName.charAt(0) : "U"}
              </div>
              <div className="text-left leading-tight">
                <p className="text-xs font-semibold text-white">
                  {user?.displayName || "Operator"}
                </p>
                <p className="text-[10px] uppercase tracking-wider font-mono text-white/40">
                  {role}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content Canvas */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

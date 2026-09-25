"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import type { AppLocale } from "@/i18n/routing";
import { DashboardSidebar } from "./dashboard-sidebar";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { NotificationBell } from "@/components/communication/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";

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
    <div className="min-h-screen bg-slate-50 dark:bg-[#070a10] text-slate-900 dark:text-slate-100 flex flex-col antialiased transition-colors duration-200">
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
      <div className="flex-1 flex flex-col lg:pl-72 transition-all duration-300 min-w-0">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 h-16 bg-white/85 dark:bg-[#070a10]/85 backdrop-blur-md border-b border-slate-200/80 dark:border-white/10 px-3 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile Hamburger Toggle (Touch target min 44px) */}
            <button
              onClick={() => setIsMobileOpen(true)}
              className="p-2.5 -ml-1.5 rounded-xl text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 lg:hidden transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu size={20} />
            </button>

            {/* Quick Live System Indicator */}
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
              <span className="hidden md:inline">Network Live · SLA 99.9%</span>
              <span className="md:hidden">SLA 99.9%</span>
            </div>
          </div>

          {/* Right Utilities */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Dark / Light Mode Switch */}
            <ThemeToggle />

            {/* Notifications */}
            <NotificationBell
              locale={locale}
              labels={{
                title: labels.notificationsTitle ?? "Notifications",
                markAllRead: labels.markAllRead ?? "Mark all as read",
                empty: labels.emptyNotifications ?? "No notifications yet",
                viewAll: labels.viewAllNotifications ?? "View all notifications",
              }}
            />

            {/* Language Switcher */}
            <LocaleSwitcher
              locale={locale}
              label={labels.language ?? "Language"}
            />

            {/* Role Badge Chip */}
            <div className="hidden md:flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-white/10">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-xs text-white shadow-xs">
                {user?.displayName ? user.displayName.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="text-left leading-tight">
                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate max-w-[120px]">
                  {user?.displayName || "Brand Hub"}
                </p>
                <p className="text-[10px] uppercase tracking-wider font-mono text-slate-400 dark:text-white/40">
                  {role}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content Canvas */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}

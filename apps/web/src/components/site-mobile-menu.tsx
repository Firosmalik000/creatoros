"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, ArrowUpRight, LayoutDashboard, LogOut, Loader2 } from "lucide-react";
import type { AppLocale } from "@/i18n/routing";

export interface SiteMobileMenuProps {
  locale: AppLocale;
  labels: {
    discover: string;
    campaigns?: string;
    how: string;
    brands: string;
    creators: string;
    login: string;
    start: string;
    dashboard?: string;
    logout?: string;
  };
  currentUser?: {
    displayName: string;
    email: string;
    roles: string[];
  } | null;
}

export function SiteMobileMenu({
  locale,
  labels,
  currentUser,
}: SiteMobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Reset menu when route changes
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setIsOpen(false);
  }

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen]);

  let dashboardHref = `/${locale}/orders`;
  if (currentUser?.roles?.includes("admin")) {
    dashboardHref = `/${locale}/admin`;
  } else if (currentUser?.roles?.includes("creator")) {
    dashboardHref = `/${locale}/creator/orders`;
  }

  async function handleLogout() {
    try {
      setLoggingOut(true);
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      setIsOpen(false);
      router.push(`/${locale}`);
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <>
      <button
        className="mobile-menu"
        type="button"
        aria-label={isOpen ? "Tutup navigasi" : "Buka navigasi"}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {isOpen ? (
          <X aria-hidden="true" size={22} />
        ) : (
          <Menu aria-hidden="true" size={22} />
        )}
      </button>

      {isOpen && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 top-[73px] z-40 bg-black/70 backdrop-blur-sm md:hidden"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Mobile menu container */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation"
            className="absolute top-full left-0 right-0 w-full z-50 bg-[#070a10]/95 backdrop-blur-xl border-b border-white/10 shadow-2xl p-6 flex flex-col gap-4 max-h-[calc(100vh-73px)] overflow-y-auto md:hidden animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <nav className="flex flex-col gap-2" aria-label="Mobile Primary Navigation">
              <Link
                href={`/${locale}/creators`}
                onClick={() => setIsOpen(false)}
                className="px-3 py-2.5 rounded-lg text-slate-200 hover:text-white hover:bg-white/5 font-semibold text-base transition-colors"
              >
                {labels.discover}
              </Link>
              {labels.campaigns && (
                <Link
                  href={`/${locale}/campaigns/explore`}
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-2.5 rounded-lg text-slate-200 hover:text-white hover:bg-white/5 font-semibold text-base transition-colors"
                >
                  {labels.campaigns}
                </Link>
              )}
              <Link
                href={`/${locale}#workflow`}
                onClick={() => setIsOpen(false)}
                className="px-3 py-2.5 rounded-lg text-slate-200 hover:text-white hover:bg-white/5 font-semibold text-base transition-colors"
              >
                {labels.how}
              </Link>
              <Link
                href={`/${locale}#agency`}
                onClick={() => setIsOpen(false)}
                className="px-3 py-2.5 rounded-lg text-slate-200 hover:text-white hover:bg-white/5 font-semibold text-base transition-colors"
              >
                {labels.brands}
              </Link>
              <Link
                href={`/${locale}#join`}
                onClick={() => setIsOpen(false)}
                className="px-3 py-2.5 rounded-lg text-slate-200 hover:text-white hover:bg-white/5 font-semibold text-base transition-colors"
              >
                {labels.creators}
              </Link>
            </nav>

            <div className="h-px bg-white/10 my-1" />

            {/* Actions Section */}
            <div className="flex flex-col gap-3">
              {currentUser ? (
                <>
                  <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center font-bold text-xs text-white shrink-0">
                      {currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : "U"}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="font-semibold text-white text-sm truncate">
                        {currentUser.displayName || "User"}
                      </span>
                      <span className="text-xs text-slate-400 truncate">
                        {currentUser.email}
                      </span>
                    </div>
                  </div>

                  <Link
                    href={dashboardHref}
                    onClick={() => setIsOpen(false)}
                    className="button button--signal w-full justify-center text-sm font-semibold"
                  >
                    <LayoutDashboard size={16} />
                    <span>{labels.dashboard ?? "Dashboard"}</span>
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="button button--quiet w-full justify-center text-sm font-semibold text-rose-400 hover:text-rose-300 hover:border-rose-500/30"
                  >
                    {loggingOut ? (
                      <Loader2 size={16} className="animate-spin text-rose-400" />
                    ) : (
                      <LogOut size={16} />
                    )}
                    <span>{labels.logout ?? "Keluar"}</span>
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href={`/${locale}/auth/login`}
                    onClick={() => setIsOpen(false)}
                    className="button button--quiet w-full justify-center text-sm font-semibold"
                  >
                    {labels.login}
                  </Link>
                  <Link
                    href={`/${locale}/auth/register`}
                    onClick={() => setIsOpen(false)}
                    className="button button--dark w-full justify-center text-sm font-semibold shadow-md"
                  >
                    <span>{labels.start}</span>
                    <ArrowUpRight aria-hidden="true" size={17} />
                  </Link>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  ShoppingBag,
  Megaphone,
  AlertTriangle,
  Landmark,
  BadgeCheck,
  Users,
  FolderTree,
  Radio,
  ScrollText,
  PackageCheck,
  Sparkles,
  WalletCards,
  Settings,
  ArrowUpRight,
  LogOut,
  X,
  ShieldCheck,
  Building2,
  Palette,
  Compass,
} from "lucide-react";
import type { AppLocale } from "@/i18n/routing";

export type NavGroup = {
  title: string;
  items: {
    href: string;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    badge?: string | number;
    badgeColor?: "warning" | "danger" | "info" | "success";
    exact?: boolean;
  }[];
};

interface DashboardSidebarProps {
  locale: AppLocale;
  role: "admin" | "creator" | "client";
  user?: {
    email?: string;
    displayName?: string;
    roles?: string[];
  } | null;
  labels: {
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
    exploreCampaigns?: string;
    logout?: string;
  };
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export function DashboardSidebar({
  locale,
  role,
  user,
  labels,
  isOpenMobile,
  onCloseMobile,
}: DashboardSidebarProps) {
  const pathname = usePathname();

  // Define Navigation Groups based on Role
  let groups: NavGroup[] = [];

  if (role === "admin") {
    groups = [
      {
        title: labels.overview || "Overview",
        items: [
          {
            href: `/${locale}/admin`,
            label: "Dashboard",
            icon: LayoutDashboard,
            exact: true,
          },
        ],
      },
      {
        title: labels.commerce || "Operations & Orders",
        items: [
          {
            href: `/${locale}/admin/orders`,
            label: labels.orders || "Orders",
            icon: ShoppingBag,
          },
          {
            href: `/${locale}/admin/campaigns`,
            label: labels.campaigns || "Campaigns",
            icon: Megaphone,
          },
          {
            href: `/${locale}/admin/disputes`,
            label: labels.disputes || "Disputes",
            icon: AlertTriangle,
          },
        ],
      },
      {
        title: labels.finance || "Financials & Ledger",
        items: [
          {
            href: `/${locale}/admin/finance`,
            label: labels.finance || "Escrow & Ledger",
            icon: Landmark,
          },
        ],
      },
      {
        title: labels.management || "Talent & Users",
        items: [
          {
            href: `/${locale}/admin/creator-verifications`,
            label: labels.verifications || "Verifications",
            icon: BadgeCheck,
          },
          {
            href: `/${locale}/admin/users`,
            label: labels.users || "Users Directory",
            icon: Users,
          },
        ],
      },
      {
        title: labels.system || "Platform Configuration",
        items: [
          {
            href: `/${locale}/admin/categories`,
            label: labels.categories || "Categories",
            icon: FolderTree,
          },
          {
            href: `/${locale}/admin/announcements`,
            label: labels.announcements || "Announcements",
            icon: Radio,
          },
          {
            href: `/${locale}/admin/audit`,
            label: labels.audit || "Audit Logs",
            icon: ScrollText,
          },
        ],
      },
    ];
  } else if (role === "creator") {
    groups = [
      {
        title: "Studio",
        items: [
          {
            href: `/${locale}/creator/orders`,
            label: labels.orders || "Active Orders",
            icon: PackageCheck,
          },
          {
            href: `/${locale}/creator/services`,
            label: labels.services || "My Services",
            icon: Sparkles,
          },
          {
            href: `/${locale}/settings?tab=profile`,
            label: labels.profileAndSocial || "Profil & Medsos",
            icon: BadgeCheck,
          },
        ],
      },
      {
        title: "Opportunities",
        items: [
          {
            href: `/${locale}/creator/campaigns`,
            label: labels.campaigns || "Campaign Invites",
            icon: Megaphone,
          },
          {
            href: `/${locale}/campaigns/explore`,
            label: labels.exploreCampaigns || "Explore Campaigns",
            icon: Compass,
          },
        ],
      },
      {
        title: "Financials",
        items: [
          {
            href: `/${locale}/creator/wallet`,
            label: labels.wallet || "Wallet & Payouts",
            icon: WalletCards,
          },
        ],
      },
    ];
  } else {
    groups = [
      {
        title: "Workspace",
        items: [
          {
            href: `/${locale}/orders`,
            label: labels.orders || "Orders",
            icon: ShoppingBag,
          },
          {
            href: `/${locale}/campaigns`,
            label: labels.campaigns || "Campaigns",
            icon: Megaphone,
          },
        ],
      },
      {
        title: "Explore",
        items: [
          {
            href: `/${locale}/creators`,
            label: "Discover Talent",
            icon: Users,
          },
          {
            href: `/${locale}/campaigns/explore`,
            label: labels.exploreCampaigns || "Explore Campaigns",
            icon: Compass,
          },
        ],
      },
    ];
  }

  // Lock body scroll and listen for Escape key when mobile drawer is open
  useEffect(() => {
    if (isOpenMobile) {
      document.body.style.overflow = "hidden";
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" && onCloseMobile) {
          onCloseMobile();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = "";
        window.removeEventListener("keydown", handleKeyDown);
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [isOpenMobile, onCloseMobile]);

  const roleBadges: Record<string, { label: string; icon: React.ComponentType<{ size?: number }>; color: string }> = {
    admin: { label: "Agency Admin", icon: ShieldCheck, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
    creator: { label: "Creator Studio", icon: Palette, color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" },
    client: { label: "Brand Hub", icon: Building2, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  };

  const currentBadge = roleBadges[role] || roleBadges.admin;
  const BadgeIcon = currentBadge.icon;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/50 dark:bg-black/75 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-white dark:bg-[#090d16] border-r border-slate-200 dark:border-white/10 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/${locale}`}
              className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5"
            >
              <span>Creator</span>
              <span className="text-blue-600 dark:text-[#3b82f6]">OS</span>
            </Link>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${currentBadge.color}`}
            >
              <BadgeIcon size={12} />
              {currentBadge.label}
            </span>
          </div>

          {/* Close button on mobile */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="p-2 -mr-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/10 lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
              aria-label="Close sidebar"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Scrollable Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-6 custom-scrollbar">
          {groups.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-1.5">
              <h3 className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/40 mb-2">
                {group.title}
              </h3>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const itemPath = item.href.split("?")[0];
                  const isActive = item.exact
                    ? pathname === item.href
                    : pathname === itemPath || pathname.startsWith(`${itemPath}/`);
                  const Icon = item.icon;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onCloseMobile}
                        className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                          isActive
                            ? "bg-blue-50 dark:bg-[#1e293b] text-blue-600 dark:text-white shadow-xs border border-blue-100 dark:border-white/10"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/[0.04]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon
                            size={18}
                            className={`transition-colors ${
                              isActive
                                ? "text-blue-600 dark:text-[#60a5fa]"
                                : "text-slate-400 group-hover:text-slate-700 dark:text-white/40 dark:group-hover:text-white/80"
                            }`}
                          />
                          <span>{item.label}</span>
                        </div>

                        {item.badge !== undefined && (
                          <span
                            className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                              item.badgeColor === "danger"
                                ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                                : item.badgeColor === "warning"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Bottom User Profile / Quick Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.01] space-y-3">
          <Link
            href={`/${locale}/settings`}
            className="flex items-center justify-between p-2.5 rounded-xl text-xs font-medium text-slate-700 dark:text-white/70 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-white/[0.03] hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors border border-slate-200/80 dark:border-white/5 shadow-xs"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs">
                {user?.displayName ? user.displayName.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="truncate max-w-[130px]">
                <p className="font-semibold text-slate-900 dark:text-white truncate text-xs">
                  {user?.displayName || "Account"}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-white/40 truncate">
                  {user?.email || "Signed In"}
                </p>
              </div>
            </div>
            <Settings size={15} className="text-slate-400 dark:text-white/40 group-hover:text-slate-700 dark:group-hover:text-white" />
          </Link>

          <div className="flex items-center justify-between px-2 pt-1">
            <Link
              href={`/${locale}`}
              className="text-[11px] font-medium text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 transition-colors"
            >
              Marketplace
              <ArrowUpRight size={12} />
            </Link>
            <Link
              href={`/${locale}/auth/login`}
              className="text-[11px] font-medium text-red-500 dark:text-red-400/80 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1 transition-colors"
            >
              <LogOut size={12} />
              Exit
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}

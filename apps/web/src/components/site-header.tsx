import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { AppLocale } from "@/i18n/routing";
import { LocaleSwitcher } from "./locale-switcher";
import { getCurrentUser, type CurrentUser } from "@/lib/auth-server";
import { HeaderUserMenu } from "./header-user-menu";
import { SiteMobileMenu } from "./site-mobile-menu";

type HeaderLabels = {
  discover: string;
  campaigns?: string;
  how: string;
  brands: string;
  creators: string;
  login: string;
  start: string;
  language: string;
  dashboard?: string;
  logout?: string;
  notificationsTitle?: string;
  markAllRead?: string;
  emptyNotifications?: string;
  viewAllNotifications?: string;
};

export async function SiteHeader({
  locale,
  labels,
  currentUser: providedUser,
}: {
  locale: AppLocale;
  labels: HeaderLabels;
  currentUser?: CurrentUser | null;
}) {
  const currentUser =
    providedUser !== undefined ? providedUser : await getCurrentUser();

  return (
    <header className="site-header">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="shell header-inner">
        <Link
          className="wordmark"
          href={`/${locale}`}
          aria-label="CreatorOS home"
        >
          Creator<span>OS</span>
        </Link>
        <nav className="desktop-nav" aria-label="Primary navigation">
          <Link href={`/${locale}/creators`}>{labels.discover}</Link>
          <Link href={`/${locale}#workflow`}>{labels.how}</Link>
          <Link href={`/${locale}#agency`}>{labels.brands}</Link>
          <Link href={`/${locale}#join`}>{labels.creators}</Link>
        </nav>
        <div className="header-actions">
          <LocaleSwitcher locale={locale} label={labels.language} />
          {currentUser ? (
            <HeaderUserMenu
              locale={locale}
              user={{
                displayName: currentUser.display_name,
                email: currentUser.email,
                roles: currentUser.roles,
              }}
              labels={{
                dashboard: labels.dashboard ?? "Dashboard",
                logout: labels.logout ?? "Keluar",
              }}
            />
          ) : (
            <>
              <Link
                className="text-link desktop-only"
                href={`/${locale}/auth/login`}
              >
                {labels.login}
              </Link>
              <Link
                className="button button--dark desktop-only"
                href={`/${locale}/auth/register`}
              >
                {labels.start}
                <ArrowUpRight aria-hidden="true" size={17} />
              </Link>
            </>
          )}
          <SiteMobileMenu
            locale={locale}
            labels={{
              discover: labels.discover,
              campaigns: labels.campaigns,
              how: labels.how,
              brands: labels.brands,
              creators: labels.creators,
              login: labels.login,
              start: labels.start,
              dashboard: labels.dashboard,
              logout: labels.logout,
            }}
            currentUser={
              currentUser
                ? {
                    displayName: currentUser.display_name,
                    email: currentUser.email,
                    roles: currentUser.roles,
                  }
                : null
            }
          />
        </div>
      </div>
    </header>
  );
}

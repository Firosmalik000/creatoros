import { ArrowUpRight, Menu } from "lucide-react";
import Link from "next/link";
import type { AppLocale } from "@/i18n/routing";
import { LocaleSwitcher } from "./locale-switcher";

type HeaderLabels = {
  discover: string;
  how: string;
  brands: string;
  creators: string;
  login: string;
  start: string;
  language: string;
};

export function SiteHeader({
  locale,
  labels,
}: {
  locale: AppLocale;
  labels: HeaderLabels;
}) {
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
          <Link className="text-link desktop-only" href={`/${locale}#login`}>
            {labels.login}
          </Link>
          <Link
            className="button button--dark desktop-only"
            href={`/${locale}#start`}
          >
            {labels.start}
            <ArrowUpRight aria-hidden="true" size={17} />
          </Link>
          <button
            className="mobile-menu"
            type="button"
            aria-label="Open navigation menu"
          >
            <Menu aria-hidden="true" size={22} />
          </button>
        </div>
      </div>
    </header>
  );
}

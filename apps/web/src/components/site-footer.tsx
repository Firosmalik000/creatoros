import Link from "next/link";
import type { AppLocale } from "@/i18n/routing";

export type FooterLabels = {
  tagline: string;
  platform: string;
  discoverCreators: string;
  campaigns?: string;
  howItWorks: string;
  pricing: string;
  forBrands: string;
  forCreators: string;
  legal: string;
  termsOfService: string;
  privacyPolicy: string;
  creatorAgreement: string;
  clientAgreement: string;
  cookiePolicy: string;
  support: string;
  contactSupport: string;
  status: string;
  rightsReserved: string;
};

export function SiteFooter({
  locale,
  labels,
}: {
  locale: AppLocale;
  labels: FooterLabels;
}) {
  const currentYear = new Date().getUTCFullYear();

  return (
    <footer className="site-footer bg-[#090d16] text-white border-t border-white/10 pt-16 pb-12 mt-20">
      <div className="shell max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-white/10">
          {/* Brand Col */}
          <div className="space-y-4">
            <Link
              href={`/${locale}`}
              className="text-2xl font-bold tracking-tight text-white inline-block"
            >
              Creator<span className="text-[#3b82f6]">OS</span>
            </Link>
            <p className="text-sm text-white/60 leading-relaxed max-w-xs">
              {labels.tagline}
            </p>
            <div className="flex items-center gap-2 pt-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-mono text-white/60">
                {labels.status}: 100% Operational
              </span>
            </div>
          </div>

          {/* Platform Col */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-4">
              {labels.platform}
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link
                  href={`/${locale}/creators`}
                  className="text-white/70 hover:text-white transition-colors"
                >
                  {labels.discoverCreators}
                </Link>
              </li>
              <li>
                <Link
                  href={`/${locale}/campaigns/explore`}
                  className="text-white/70 hover:text-white transition-colors"
                >
                  {labels.campaigns ?? "Brand Campaigns"}
                </Link>
              </li>
              <li>
                <Link
                  href={`/${locale}#workflow`}
                  className="text-white/70 hover:text-white transition-colors"
                >
                  {labels.howItWorks}
                </Link>
              </li>
              <li>
                <Link
                  href={`/${locale}#agency`}
                  className="text-white/70 hover:text-white transition-colors"
                >
                  {labels.forBrands}
                </Link>
              </li>
              <li>
                <Link
                  href={`/${locale}#join`}
                  className="text-white/70 hover:text-white transition-colors"
                >
                  {labels.forCreators}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal & Compliance Col */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-4">
              {labels.legal}
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link
                  href={`/${locale}/legal/terms`}
                  className="text-white/70 hover:text-white transition-colors"
                >
                  {labels.termsOfService}
                </Link>
              </li>
              <li>
                <Link
                  href={`/${locale}/legal/privacy`}
                  className="text-white/70 hover:text-white transition-colors"
                >
                  {labels.privacyPolicy}
                </Link>
              </li>
              <li>
                <Link
                  href={`/${locale}/legal/creator-agreement`}
                  className="text-white/70 hover:text-white transition-colors"
                >
                  {labels.creatorAgreement}
                </Link>
              </li>
              <li>
                <Link
                  href={`/${locale}/legal/client-agreement`}
                  className="text-white/70 hover:text-white transition-colors"
                >
                  {labels.clientAgreement}
                </Link>
              </li>
              <li>
                <Link
                  href={`/${locale}/legal/cookies`}
                  className="text-white/70 hover:text-white transition-colors"
                >
                  {labels.cookiePolicy}
                </Link>
              </li>
            </ul>
          </div>

          {/* Support Col */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-4">
              {labels.support}
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link
                  href={`/${locale}/support`}
                  className="text-white/70 hover:text-white transition-colors"
                >
                  {labels.contactSupport}
                </Link>
              </li>
              <li className="pt-2">
                <p className="text-xs text-white/40 mb-1">Direct Helpdesk</p>
                <a
                  href="mailto:support@creatoros.agency"
                  className="text-sm font-mono text-[#60a5fa] hover:underline"
                >
                  support@creatoros.agency
                </a>
              </li>
              <li className="text-xs text-white/40 pt-1">
                Mon - Fri · 09:00 - 18:00 (WIB/SGT)
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-white/40 gap-4">
          <p>© {currentYear} CreatorOS Platform. {labels.rightsReserved}</p>
          <p className="text-white/30">
            Escrow protected · Double-entry verified · Agency quality managed
          </p>
        </div>
      </div>
    </footer>
  );
}

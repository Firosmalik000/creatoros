import type { Metadata } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";

export const metadata: Metadata = {
  title: "404 — Page Not Found | CreatorOS",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  const t = useTranslations("NotFound");

  return (
    <div className="not-found-screen">
      <div className="shell not-found-screen__inner">
        <span className="not-found-screen__code">404</span>
        <h1 className="not-found-screen__title">{t("title")}</h1>
        <p className="not-found-screen__desc">{t("description")}</p>
        <div className="not-found-screen__actions">
          <Link href="/" className="btn btn--primary">
            {t("backHome")}
          </Link>
          <Link href="/creators" className="btn btn--secondary">
            {t("browseCreators")}
          </Link>
        </div>
      </div>
    </div>
  );
}

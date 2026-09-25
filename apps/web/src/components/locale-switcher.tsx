import { Languages } from "lucide-react";
import Link from "next/link";
import type { AppLocale } from "@/i18n/routing";

const localeLabels: Record<AppLocale, string> = {
  id: "ID",
  en: "EN",
  ms: "MY",
};

export function LocaleSwitcher({
  locale,
  label,
  className,
}: {
  locale: AppLocale;
  label: string;
  className?: string;
}) {
  return (
    <div className={`locale-switcher ${className ?? ""}`.trim()} aria-label={label}>
      <Languages aria-hidden="true" size={16} strokeWidth={2} />
      {Object.entries(localeLabels).map(([code, text]) => (
        <Link
          className={code === locale ? "locale-link is-active" : "locale-link"}
          href={`/${code}`}
          hrefLang={code === "id" ? "id-ID" : code === "ms" ? "ms-MY" : "en"}
          key={code}
        >
          {text}
        </Link>
      ))}
    </div>
  );
}

"use client";

import {
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  MapPin,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { creatorRequest } from "@/lib/creator-client";
import type { CatalogItem, DirectoryCreator } from "@/lib/creator-types";

type DirectoryPayload = {
  data: DirectoryCreator[];
  meta: { page: number; per_page: number; total: number };
};

type Props = {
  initial: DirectoryPayload;
  categories: CatalogItem[];
  fixedCategory?: string;
};

const countryCodes = ["ID", "MY", "SG"] as const;

export function CreatorDirectory({
  initial,
  categories,
  fixedCategory,
}: Props) {
  const t = useTranslations("Creators");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const effectiveQueryString = useMemo(() => {
    if (!fixedCategory || searchParams.get("category")) return queryString;
    const params = new URLSearchParams(queryString);
    params.set("category", fixedCategory);
    return params.toString();
  }, [fixedCategory, queryString, searchParams]);
  const didMount = useRef(false);
  const [items, setItems] = useState(initial.data);
  const [meta, setMeta] = useState(initial.meta);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  const filters = useMemo(
    () => ({
      category: searchParams.get("category") ?? fixedCategory ?? "",
      language: searchParams.get("language") ?? "",
      country: searchParams.get("country") ?? "",
      sort: searchParams.get("sort") ?? "featured",
    }),
    [fixedCategory, searchParams],
  );

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    let active = true;
    setLoading(true);
    setError(false);
    creatorRequest<DirectoryPayload>(
      `directory?locale=${locale}&${effectiveQueryString}`,
    )
      .then((response) => {
        if (!active) return;
        setItems(response.data);
        setMeta(response.meta);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [effectiveQueryString, locale]);

  function updateFilters(next: Record<string, string>) {
    const params = new URLSearchParams(queryString);
    Object.entries(next).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateFilters({ q: query.trim() });
  }

  function setPage(page: number) {
    const params = new URLSearchParams(queryString);
    params.set("page", String(page));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const totalPages = Math.max(1, Math.ceil(meta.total / meta.per_page));
  const currentPage = Math.min(meta.page, totalPages);

  return (
    <div className="directory-workspace">
      <form className="directory-toolbar" onSubmit={submitSearch} role="search">
        <label className="directory-search">
          <span className="sr-only">{t("searchLabel")}</span>
          <Search aria-hidden="true" size={19} />
          <input
            aria-label={t("searchLabel")}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            value={query}
          />
        </label>
        <button
          className="button button--dark directory-search-button"
          type="submit"
        >
          {t("searchAction")}
        </button>
      </form>

      <div className="directory-controls">
        <div className="directory-filter-label">
          <SlidersHorizontal aria-hidden="true" size={16} />
          {t("filterLabel")}
        </div>
        <label className="directory-select">
          <span>{t("categoryLabel")}</span>
          <select
            onChange={(event) =>
              updateFilters({ category: event.target.value })
            }
            value={filters.category}
          >
            <option value="">{t("allCategories")}</option>
            {categories.map((category) => (
              <option key={category.code} value={category.code}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="directory-select">
          <span>{t("languageLabel")}</span>
          <select
            onChange={(event) =>
              updateFilters({ language: event.target.value })
            }
            value={filters.language}
          >
            <option value="">{t("allLanguages")}</option>
            <option value="id">{t("languages.id")}</option>
            <option value="en">{t("languages.en")}</option>
            <option value="ms">{t("languages.ms")}</option>
          </select>
        </label>
        <label className="directory-select">
          <span>{t("countryLabel")}</span>
          <select
            onChange={(event) => updateFilters({ country: event.target.value })}
            value={filters.country}
          >
            <option value="">{t("allCountries")}</option>
            {countryCodes.map((country) => (
              <option key={country} value={country}>
                {t(`countries.${country}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="directory-select directory-sort">
          <span>{t("sortLabel")}</span>
          <select
            onChange={(event) => updateFilters({ sort: event.target.value })}
            value={filters.sort}
          >
            <option value="featured">{t("sort.featured")}</option>
            <option value="newest">{t("sort.newest")}</option>
            <option value="followers">{t("sort.followers")}</option>
            <option value="engagement">{t("sort.engagement")}</option>
          </select>
        </label>
        {queryString.length > 0 && (
          <button
            className="button button--quiet directory-reset"
            onClick={() => router.replace(pathname)}
            type="button"
          >
            {t("reset")}
          </button>
        )}
      </div>

      <div aria-live="polite" className="directory-summary">
        <span>{t("resultCount", { count: meta.total })}</span>
        {loading && (
          <span className="directory-loading">
            <LoaderCircle aria-hidden="true" className="spin" size={15} />
            {t("loading")}
          </span>
        )}
      </div>

      {error ? (
        <div className="directory-state directory-state--error" role="alert">
          <strong>{t("errorTitle")}</strong>
          <p>{t("errorBody")}</p>
          <button
            className="button button--quiet"
            onClick={() => router.refresh()}
            type="button"
          >
            {t("retry")}
          </button>
        </div>
      ) : items.length === 0 && !loading ? (
        <div className="directory-state">
          <strong>{t("emptyTitle")}</strong>
          <p>{t("emptyBody")}</p>
          <button
            className="button button--quiet"
            onClick={() => router.replace(pathname)}
            type="button"
          >
            {t("reset")}
          </button>
        </div>
      ) : (
        <div
          className={`creator-grid marketplace-grid ${loading ? "is-loading" : ""}`}
        >
          {items.map((creator) => (
            <DirectoryCard
              key={creator.slug}
              creator={creator}
              locale={locale}
              t={t}
              onNotice={setNotice}
            />
          ))}
        </div>
      )}

      {notice && (
        <div className="directory-toast" role="status">
          {notice}
        </div>
      )}
      {totalPages > 1 && (
        <nav aria-label={t("paginationLabel")} className="directory-pagination">
          <button
            aria-label={t("previousPage")}
            className="icon-button"
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
            type="button"
          >
            <ChevronLeft aria-hidden="true" size={18} />
          </button>
          <span>{t("pageOf", { page: currentPage, total: totalPages })}</span>
          <button
            aria-label={t("nextPage")}
            className="icon-button"
            disabled={currentPage >= totalPages}
            onClick={() => setPage(currentPage + 1)}
            type="button"
          >
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        </nav>
      )}
    </div>
  );
}

function DirectoryCard({
  creator,
  locale,
  t,
  onNotice,
}: {
  creator: DirectoryCreator;
  locale: string;
  t: ReturnType<typeof useTranslations>;
  onNotice: (message: string) => void;
}) {
  const [favorite, setFavorite] = useState(creator.is_favorite);
  const [saving, setSaving] = useState(false);
  const country = t(`countries.${creator.country_code as "ID" | "MY" | "SG"}`);
  const languageNames = creator.languages
    .map((language) => t(`languages.${language as "id" | "en" | "ms"}`))
    .join(" · ");
  const numberLocale =
    locale === "en" ? "en-US" : locale === "ms" ? "ms-MY" : "id-ID";
  const followers = new Intl.NumberFormat(numberLocale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(creator.followers);
  const engagement = `${(creator.engagement_bps / 100).toLocaleString(numberLocale, { maximumFractionDigits: 2 })}%`;

  async function toggleFavorite() {
    setSaving(true);
    try {
      await creatorRequest<void>(`favorites/${creator.slug}`, {
        method: favorite ? "DELETE" : "POST",
      });
      setFavorite(!favorite);
      onNotice(t(favorite ? "favoriteRemoved" : "favoriteSaved"));
    } catch (caught) {
      const code =
        typeof caught === "object" && caught && "code" in caught
          ? String(caught.code)
          : "";
      onNotice(
        code === "unauthenticated" ? t("favoriteLogin") : t("favoriteError"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="marketplace-card">
      <Link
        className="marketplace-card__visual"
        href={`/${locale}/creators/${creator.slug}`}
        aria-label={t("viewProfile", { name: creator.display_name })}
      >
        {creator.cover_url ? (
          // Directory cover URLs are user-managed external HTTPS assets.
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" src={creator.cover_url} />
        ) : (
          <span aria-hidden="true">
            {creator.display_name
              .split(" ")
              .map((part) => part[0])
              .slice(0, 2)
              .join("")}
          </span>
        )}
        <span className="marketplace-card__stamp">
          <Check aria-hidden="true" size={13} />
          {t("verified")}
        </span>
      </Link>
      <div className="marketplace-card__body">
        <div className="marketplace-card__heading">
          <div>
            <h2>
              <Link href={`/${locale}/creators/${creator.slug}`}>
                {creator.display_name}
              </Link>
            </h2>
            <p>{creator.headline}</p>
          </div>
          <button
            aria-pressed={favorite}
            aria-label={t(favorite ? "removeFavorite" : "addFavorite")}
            className={`favorite-button ${favorite ? "is-active" : ""}`}
            disabled={saving}
            onClick={toggleFavorite}
            type="button"
          >
            <Bookmark
              aria-hidden="true"
              fill={favorite ? "currentColor" : "none"}
              size={18}
            />
          </button>
        </div>
        <p className="creator-location">
          <MapPin aria-hidden="true" size={14} />
          {creator.city}, {country}
        </p>
        <div className="marketplace-tags">
          {creator.categories.slice(0, 2).map((category) => (
            <span key={category.code}>{category.name}</span>
          ))}
        </div>
        <dl className="creator-metrics">
          <div>
            <dt>{t("followers")}</dt>
            <dd>{followers}</dd>
          </div>
          <div>
            <dt>{t("engagement")}</dt>
            <dd>{engagement}</dd>
          </div>
        </dl>
        <p className="marketplace-languages">{languageNames}</p>
        <Link
          className="text-link marketplace-card__link"
          href={`/${locale}/creators/${creator.slug}`}
        >
          {t("viewProfileShort")} <ArrowUpRight aria-hidden="true" size={15} />
        </Link>
      </div>
    </article>
  );
}

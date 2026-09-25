"use client";

import {
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Globe,
  LoaderCircle,
  MapPin,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.category && !fixedCategory) count++;
    if (filters.language) count++;
    if (filters.country) count++;
    if (filters.sort && filters.sort !== "featured") count++;
    if (searchParams.get("q")) count++;
    return count;
  }, [filters, fixedCategory, searchParams]);

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

  function handleCategoryClick(catCode: string) {
    if (filters.category === catCode) {
      updateFilters({ category: "" });
    } else {
      updateFilters({ category: catCode });
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateFilters({ q: query.trim() });
  }

  function clearSearch() {
    setQuery("");
    updateFilters({ q: "" });
  }

  function setPage(page: number) {
    const params = new URLSearchParams(queryString);
    params.set("page", String(page));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const totalPages = Math.max(1, Math.ceil(meta.total / meta.per_page));
  const currentPage = Math.min(meta.page, totalPages);

  return (
    <div className="space-y-8">
      {/* Category Pills Slider */}
      {!fixedCategory && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => updateFilters({ category: "" })}
              className={`shrink-0 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 border ${
                filters.category === ""
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 border-blue-400/40"
                  : "bg-white/5 hover:bg-white/10 text-slate-300 border-white/10 hover:border-white/20"
              }`}
            >
              {t("allCategories")}
            </button>
            {categories.map((cat) => {
              const isSelected = filters.category === cat.code;
              return (
                <button
                  key={cat.code}
                  onClick={() => handleCategoryClick(cat.code)}
                  className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 border ${
                    isSelected
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 border-blue-400/40"
                      : "bg-white/5 hover:bg-white/10 text-slate-300 border-white/10 hover:border-white/20"
                  }`}
                >
                  <span>{cat.name}</span>
                  {isSelected && <Check size={14} className="shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Modern Filter Command Bar */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0d1424]/90 backdrop-blur-xl border border-white/10 shadow-xl space-y-4">
        {/* Search Input Row */}
        <form onSubmit={submitSearch} className="flex gap-2 sm:gap-3" role="search">
          <div className="relative flex-1">
            <Search
              aria-hidden="true"
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              aria-label={t("searchLabel")}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              value={query}
              className="w-full h-11 pl-10 pr-9 rounded-xl bg-black/40 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
            {query && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-5 h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold transition-colors shadow-md shadow-blue-600/20 shrink-0"
          >
            {t("searchAction")}
          </button>
        </form>

        {/* Secondary Filter Dropdowns & Sort */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider pr-2">
              <SlidersHorizontal size={14} />
              <span>{t("filterLabel")}</span>
            </div>

            {/* Country Selector */}
            <select
              aria-label={t("countryLabel")}
              onChange={(e) => updateFilters({ country: e.target.value })}
              value={filters.country}
              className="h-9 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-200 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
            >
              <option value="" className="bg-white dark:bg-[#0e1424] text-slate-900 dark:text-white">
                {t("allCountries")}
              </option>
              {countryCodes.map((code) => (
                <option key={code} value={code} className="bg-white dark:bg-[#0e1424] text-slate-900 dark:text-white">
                  {t(`countries.${code}`)}
                </option>
              ))}
            </select>

            {/* Language Selector */}
            <select
              aria-label={t("languageLabel")}
              onChange={(e) => updateFilters({ language: e.target.value })}
              value={filters.language}
              className="h-9 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-200 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
            >
              <option value="" className="bg-white dark:bg-[#0e1424] text-slate-900 dark:text-white">
                {t("allLanguages")}
              </option>
              <option value="id" className="bg-white dark:bg-[#0e1424] text-slate-900 dark:text-white">
                {t("languages.id")}
              </option>
              <option value="en" className="bg-white dark:bg-[#0e1424] text-slate-900 dark:text-white">
                {t("languages.en")}
              </option>
              <option value="ms" className="bg-white dark:bg-[#0e1424] text-slate-900 dark:text-white">
                {t("languages.ms")}
              </option>
            </select>

            {/* Sort Selector */}
            <select
              aria-label={t("sortLabel")}
              onChange={(e) => updateFilters({ sort: e.target.value })}
              value={filters.sort}
              className="h-9 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-200 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
            >
              <option value="featured" className="bg-white dark:bg-[#0e1424] text-slate-900 dark:text-white">
                {t("sort.featured")}
              </option>
              <option value="newest" className="bg-white dark:bg-[#0e1424] text-slate-900 dark:text-white">
                {t("sort.newest")}
              </option>
              <option value="followers" className="bg-white dark:bg-[#0e1424] text-slate-900 dark:text-white">
                {t("sort.followers")}
              </option>
              <option value="engagement" className="bg-white dark:bg-[#0e1424] text-slate-900 dark:text-white">
                {t("sort.engagement")}
              </option>
            </select>
          </div>

          {/* Reset Filters & Active Count */}
          {activeFiltersCount > 0 && (
            <button
              onClick={() => {
                setQuery("");
                router.replace(pathname);
              }}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-colors"
            >
              <RotateCcw size={13} />
              <span>{t("reset")}</span>
              <span className="ml-1 w-4 h-4 rounded-full bg-rose-500/20 text-rose-300 text-[10px] flex items-center justify-center">
                {activeFiltersCount}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Directory Summary & Live Indicator */}
      <div className="flex items-center justify-between text-xs sm:text-sm text-slate-400 font-medium px-1">
        <span>{t("resultCount", { count: meta.total })}</span>
        {loading && (
          <span className="inline-flex items-center gap-2 text-blue-400 font-medium">
            <LoaderCircle size={14} className="animate-spin" />
            <span>{t("loading")}</span>
          </span>
        )}
      </div>

      {/* Content Canvas */}
      {error ? (
        <div className="p-10 rounded-2xl bg-rose-950/20 border border-rose-500/20 text-center space-y-4">
          <p className="text-base font-bold text-rose-400">{t("errorTitle")}</p>
          <p className="text-sm text-slate-400 max-w-md mx-auto">{t("errorBody")}</p>
          <button
            onClick={() => router.refresh()}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors"
          >
            {t("retry")}
          </button>
        </div>
      ) : items.length === 0 && !loading ? (
        <div className="p-12 sm:p-16 rounded-3xl bg-[#0d1424]/60 border border-white/10 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 mx-auto flex items-center justify-center text-slate-400">
            <Users size={24} />
          </div>
          <p className="text-lg font-bold text-white">{t("emptyTitle")}</p>
          <p className="text-sm text-slate-400 max-w-md mx-auto">{t("emptyBody")}</p>
          <button
            onClick={() => {
              setQuery("");
              router.replace(pathname);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors shadow-md shadow-blue-500/20"
          >
            <RotateCcw size={14} />
            <span>{t("reset")}</span>
          </button>
        </div>
      ) : (
        /* Bento Creator Cards Grid */
        <motion.div
          layout
          className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${
            loading ? "opacity-60 transition-opacity" : ""
          }`}
        >
          <AnimatePresence mode="popLayout">
            {items.map((creator) => (
              <DirectoryCard
                key={creator.slug}
                creator={creator}
                locale={locale}
                t={t}
                onNotice={setNotice}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Toast Notification */}
      {notice && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-slate-900 border border-white/20 shadow-2xl text-xs font-semibold text-white animate-fade-in flex items-center gap-2">
          <Sparkles size={14} className="text-blue-400" />
          <span>{notice}</span>
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <nav
          aria-label={t("paginationLabel")}
          className="flex items-center justify-center gap-3 pt-6"
        >
          <button
            aria-label={t("previousPage")}
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs sm:text-sm font-semibold text-slate-400 px-3">
            {t("pageOf", { page: currentPage, total: totalPages })}
          </span>
          <button
            aria-label={t("nextPage")}
            disabled={currentPage >= totalPages}
            onClick={() => setPage(currentPage + 1)}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronRight size={16} />
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
    .map((lang) => t(`languages.${lang as "id" | "en" | "ms"}`))
    .join(" · ");
  const numberLocale =
    locale === "en" ? "en-US" : locale === "ms" ? "ms-MY" : "id-ID";
  const followers = new Intl.NumberFormat(numberLocale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(creator.followers);
  const engagement = `${(creator.engagement_bps / 100).toLocaleString(
    numberLocale,
    { maximumFractionDigits: 2 },
  )}%`;

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

  const initials = creator.display_name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");

  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileHover={{ y: -6, transition: { duration: 0.2, ease: "easeOut" } }}
      className="group relative flex flex-col rounded-3xl bg-gradient-to-b from-[#0e1628] to-[#0a0f1d] border border-white/10 hover:border-blue-500/40 hover:shadow-2xl hover:shadow-blue-500/10 overflow-hidden transition-all duration-300"
    >
      {/* Visual Header / Cover */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900">
        <Link
          href={`/${locale}/creators/${creator.slug}`}
          className="block w-full h-full"
          aria-label={t("viewProfile", { name: creator.display_name })}
        >
          {creator.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={creator.display_name}
              src={creator.cover_url}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-blue-900/60 to-indigo-900/60 text-white/80 font-black text-4xl">
              {initials}
            </div>
          )}
        </Link>

        {/* Ambient Gradient Vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0e1628] via-transparent to-black/30 pointer-events-none" />

        {/* Verified Badge */}
        <div className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 backdrop-blur-md text-emerald-300 border border-emerald-400/30 shadow-md">
          <Check size={12} className="stroke-[3]" />
          <span>{t("verified")}</span>
        </div>

        {/* Favorite Bookmark Button */}
        <button
          aria-pressed={favorite}
          aria-label={t(favorite ? "removeFavorite" : "addFavorite")}
          disabled={saving}
          onClick={toggleFavorite}
          className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md transition-all duration-200 border ${
            favorite
              ? "bg-amber-500/20 border-amber-400/50 text-amber-300 scale-105"
              : "bg-black/40 border-white/20 text-white/70 hover:text-white hover:bg-black/60"
          }`}
        >
          <Bookmark
            size={15}
            fill={favorite ? "currentColor" : "none"}
            className={favorite ? "text-amber-400" : ""}
          />
        </button>
      </div>

      {/* Card Content Body */}
      <div className="flex-1 p-5 sm:p-6 flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          {/* Creator Name & Title */}
          <div>
            <h2 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
              <Link href={`/${locale}/creators/${creator.slug}`}>
                {creator.display_name}
              </Link>
            </h2>
            <p className="mt-1 text-xs text-slate-400 line-clamp-2 leading-relaxed">
              {creator.headline}
            </p>
          </div>

          {/* Location */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 pt-1">
            <MapPin size={13} className="text-slate-500 shrink-0" />
            <span>
              {creator.city}, {country}
            </span>
          </div>

          {/* Category Badges */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {creator.categories.slice(0, 3).map((category) => (
              <span
                key={category.code}
                className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-white/5 border border-white/10 text-slate-300"
              >
                {category.name}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-3 pt-3 border-t border-white/5">
          {/* Metrics Bento Row */}
          <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-black/30 border border-white/5 text-center">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold flex items-center justify-center gap-1">
                <Users size={11} />
                <span>{t("followers")}</span>
              </span>
              <p className="text-sm font-bold text-white font-mono">{followers}</p>
            </div>
            <div className="space-y-0.5 border-l border-white/5">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold flex items-center justify-center gap-1">
                <TrendingUp size={11} />
                <span>{t("engagement")}</span>
              </span>
              <p className="text-sm font-bold text-emerald-400 font-mono">
                {engagement}
              </p>
            </div>
          </div>

          {/* Languages Supported */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate">
            <Globe size={12} className="shrink-0" />
            <span className="truncate">{languageNames}</span>
          </div>

          {/* View Profile Action */}
          <Link
            href={`/${locale}/creators/${creator.slug}`}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/5 group-hover:bg-blue-600/20 text-xs font-semibold text-slate-300 group-hover:text-blue-300 border border-white/10 group-hover:border-blue-500/30 transition-all duration-200"
          >
            <span>{t("viewProfileShort")}</span>
            <ArrowUpRight
              size={14}
              className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
            />
          </Link>
        </div>
      </div>
    </motion.article>
  );
}

"use client";

import {
  ArrowUpRight,
  CirclePlus,
  Edit2,
  Eye,
  EyeOff,
  Layers,
  LoaderCircle,
  PackagePlus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { FormEvent, useEffect, useState } from "react";
import type { ApiError } from "@/lib/auth-client";
import {
  creatorRequest,
  normalizeCreatorErrorCode,
} from "@/lib/creator-client";
import type {
  CreatorService,
  ServiceEnvelope,
  ServicePackage,
} from "@/lib/service-types";

const emptyPackage = (): ServicePackage => ({
  name: "",
  description: "",
  price_minor: 0,
  currency: "IDR",
  delivery_days: 7,
  revision_limit: 1,
  sort_order: 0,
});

const emptyService = (): CreatorService => ({
  id: "",
  creator_slug: "",
  creator_display_name: "",
  slug: "",
  title: "",
  description: "",
  status: "draft",
  packages: [emptyPackage()],
  published_at: null,
  created_at: "",
  updated_at: "",
});

function currencyFactor(currency: ServicePackage["currency"]) {
  return currency === "IDR" ? 1 : 100;
}

export function ServiceManager() {
  const t = useTranslations("CreatorServices");
  const locale = useLocale();
  const [items, setItems] = useState<CreatorService[]>([]);
  const [draft, setDraft] = useState<CreatorService>(emptyService);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [transitioningId, setTransitioningId] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let active = true;
    creatorRequest<ServiceEnvelope<CreatorService[]>>("services")
      .then((response) => {
        if (!active) return;
        setItems(response.data);
      })
      .catch((caught: ApiError) => active && setError(caught))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  function update(patch: Partial<CreatorService>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function updatePackage(index: number, patch: Partial<ServicePackage>) {
    update({
      packages: draft.packages.map((item, itemIndex) =>
        index === itemIndex ? { ...item, ...patch } : item,
      ),
    });
  }

  function openCreate() {
    setDraft(emptyService());
    setError(null);
    setIsDrawerOpen(true);
  }

  function openEdit(item: CreatorService) {
    setDraft(JSON.parse(JSON.stringify(item)));
    setError(null);
    setIsDrawerOpen(true);
  }

  function closeDrawer() {
    setIsDrawerOpen(false);
    setError(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await creatorRequest<ServiceEnvelope<CreatorService>>(
        draft.id ? `services/${draft.id}` : "services",
        {
          method: draft.id ? "PUT" : "POST",
          body: JSON.stringify({
            slug: draft.slug,
            title: draft.title,
            description: draft.description,
            packages: draft.packages.map((item, index) => ({
              name: item.name,
              description: item.description,
              price_minor: item.price_minor,
              currency: item.currency,
              delivery_days: item.delivery_days,
              revision_limit: item.revision_limit,
              sort_order: index,
            })),
          }),
        },
      );
      setItems((current) => {
        const exists = current.some((item) => item.id === response.data.id);
        return exists
          ? current.map((item) =>
              item.id === response.data.id ? response.data : item,
            )
          : [response.data, ...current];
      });
      closeDrawer();
    } catch (caught) {
      setError(caught as ApiError);
    } finally {
      setSaving(false);
    }
  }

  async function togglePublication(service: CreatorService) {
    const nextAction =
      service.status === "published" ? "unpublish" : "publish";
    setTransitioningId(service.id);
    setError(null);
    try {
      const response = await creatorRequest<ServiceEnvelope<CreatorService>>(
        `services/${service.id}/${nextAction}`,
        { method: "POST" },
      );
      setItems((current) =>
        current.map((item) =>
          item.id === response.data.id ? response.data : item,
        ),
      );
      if (draft.id === service.id) {
        setDraft(response.data);
      }
    } catch (caught) {
      setError(caught as ApiError);
    } finally {
      setTransitioningId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center text-slate-500 dark:text-white/50">
        <LoaderCircle className="animate-spin text-blue-500 mb-3" size={32} />
        <p className="text-sm">{t("loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Global API Error Notice */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-sm">
          {t(`errors.${normalizeCreatorErrorCode(error.code)}`)}
        </div>
      )}

      {/* Action Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200/90 dark:border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400">
            {items.length} {t("listLabel")}
          </span>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all min-h-[44px]"
          type="button"
        >
          <CirclePlus size={18} aria-hidden="true" />
          <span>{t("newService")}</span>
        </button>
      </div>

      {/* Main Content: Services List or Empty State */}
      {items.length === 0 ? (
        <div className="bg-white dark:bg-[#0e1424]/60 border border-slate-200/90 dark:border-white/10 rounded-2xl p-8 sm:p-12 text-center max-w-lg mx-auto space-y-4 my-8 shadow-sm transition-colors">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
            <PackagePlus size={24} aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t("emptyTitle")}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {t("emptyBody")}
            </p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all min-h-[44px] mt-2"
            type="button"
          >
            <CirclePlus size={18} aria-hidden="true" />
            <span>{t("newService")}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((service) => {
            const firstPackage = service.packages[0];
            const startingPrice = firstPackage
              ? new Intl.NumberFormat(locale, {
                  style: "currency",
                  currency: firstPackage.currency,
                  maximumFractionDigits:
                    firstPackage.currency === "IDR" ? 0 : 2,
                }).format(
                  firstPackage.price_minor /
                    currencyFactor(firstPackage.currency),
                )
              : null;
            const isPublished = service.status === "published";
            const isToggling = transitioningId === service.id;

            return (
              <div
                key={service.id}
                className="bg-white dark:bg-[#0e1424] border border-slate-200/90 dark:border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col justify-between hover:border-blue-500/40 shadow-sm transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-semibold inline-flex items-center gap-1.5 ${
                        isPublished
                          ? "bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                          : "bg-slate-100 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-600/30 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isPublished ? "bg-emerald-500 dark:bg-emerald-400" : "bg-slate-400"
                        }`}
                      />
                      {t(`statuses.${service.status}`)}
                    </span>
                    {service.packages.length > 0 && (
                      <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Layers size={13} className="text-slate-400 dark:text-slate-500" />
                        {service.packages.length} Packages
                      </span>
                    )}
                  </div>

                  <h3
                    onClick={() => openEdit(service)}
                    className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors cursor-pointer line-clamp-1"
                  >
                    {service.title}
                  </h3>

                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                    {service.description}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-white/10 flex items-center justify-between">
                  <div>
                    {startingPrice && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        From{" "}
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          {startingPrice}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isPublished && (
                      <Link
                        href={`/${locale}/creators/${service.creator_slug}/services/${service.slug}`}
                        target="_blank"
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                        title={t("viewPublic")}
                      >
                        <ArrowUpRight size={16} />
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => togglePublication(service)}
                      disabled={isToggling}
                      className="p-2 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50 min-h-[36px] min-w-[36px] flex items-center justify-center"
                      title={
                        isPublished ? t("unpublish") : t("publish")
                      }
                    >
                      {isToggling ? (
                        <LoaderCircle className="animate-spin" size={16} />
                      ) : isPublished ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(service)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg transition-colors min-h-[36px]"
                    >
                      <Edit2 size={13} />
                      <span>{t("editTitle")}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Slide-over Drawer for Creating / Editing Service */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={closeDrawer}
          />

          <div className="fixed inset-y-0 right-0 max-w-2xl w-full flex pl-10">
            <div className="w-full bg-white dark:bg-[#0a0e1a] border-l border-slate-200 dark:border-white/10 shadow-2xl flex flex-col transition-colors">
              {/* Drawer Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0e1424]">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {draft.id ? t("editTitle") : t("createTitle")}
                  </h2>
                  {draft.id && (
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                        draft.status === "published"
                          ? "bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                          : "bg-slate-100 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-600/30 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {t(`statuses.${draft.status}`)}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Drawer Scrollable Body */}
              <form id="service-drawer-form" onSubmit={save} className="flex-1 overflow-y-auto p-6 space-y-6">
                {error && (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-sm">
                    {t(`errors.${normalizeCreatorErrorCode(error.code)}`)}
                  </div>
                )}

                {/* Section 1: Overview */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-400 mb-1.5">
                      {t("fields.title")}
                    </label>
                    <input
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0e1424] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#0e1424] transition-colors text-sm min-h-[44px]"
                      maxLength={120}
                      minLength={3}
                      onChange={(e) => update({ title: e.target.value })}
                      required
                      placeholder="e.g. TikTok UGC Video Creation"
                      value={draft.title}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-400 mb-1.5">
                      {t("fields.slug")}
                    </label>
                    <input
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0e1424] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#0e1424] transition-colors text-sm font-mono min-h-[44px]"
                      maxLength={80}
                      onChange={(e) => update({ slug: e.target.value })}
                      pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                      required
                      placeholder="e.g. tiktok-ugc-video"
                      value={draft.slug}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-400 mb-1.5">
                      {t("fields.description")}
                    </label>
                    <textarea
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0e1424] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#0e1424] transition-colors text-sm resize-none"
                      maxLength={3000}
                      minLength={20}
                      onChange={(e) => update({ description: e.target.value })}
                      required
                      rows={4}
                      placeholder="Describe what the client receives, your process, and deliverables..."
                      value={draft.description}
                    />
                  </div>
                </div>

                {/* Section 2: Pricing Packages */}
                <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-white/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        {t("packagesTitle")}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {draft.packages.length} of 3 tiers
                      </p>
                    </div>
                    {draft.packages.length < 3 && (
                      <button
                        type="button"
                        onClick={() =>
                          update({
                            packages: [...draft.packages, emptyPackage()],
                          })
                        }
                        className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-blue-500/10 border border-blue-500/20 transition-colors min-h-[36px]"
                      >
                        <CirclePlus size={14} />
                        <span>{t("addPackage")}</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    {draft.packages.map((item, index) => {
                      const factor = currencyFactor(item.currency);
                      return (
                        <div
                          key={`${item.id ?? "new"}-${index}`}
                          className="bg-slate-50 dark:bg-[#0e1424] border border-slate-200/90 dark:border-white/10 rounded-xl p-4 space-y-3 transition-colors"
                        >
                          <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/5 pb-2.5">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                              {t("packageNumber", { number: index + 1 })}
                            </span>
                            {draft.packages.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  update({
                                    packages: draft.packages.filter(
                                      (_, i) => i !== index,
                                    ),
                                  })
                                }
                                className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 p-1 rounded transition-colors"
                                title={t("removePackage", {
                                  number: index + 1,
                                })}
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>

                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                                {t("fields.packageName")}
                              </label>
                              <input
                                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#131b2e] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 text-sm min-h-[40px]"
                                maxLength={80}
                                minLength={2}
                                onChange={(e) =>
                                  updatePackage(index, { name: e.target.value })
                                }
                                required
                                placeholder="e.g. Standard 60s Video"
                                value={item.name}
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                                  {t("fields.currency")}
                                </label>
                                <select
                                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#131b2e] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 text-sm cursor-pointer min-h-[40px]"
                                  value={item.currency}
                                  onChange={(e) => {
                                    const currency = e.target
                                      .value as ServicePackage["currency"];
                                    updatePackage(index, {
                                      currency,
                                      price_minor: 0,
                                    });
                                  }}
                                >
                                  <option value="IDR">IDR</option>
                                  <option value="MYR">MYR</option>
                                  <option value="USD">USD</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                                  {t("fields.price")}
                                </label>
                                <input
                                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#131b2e] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 text-sm min-h-[40px]"
                                  min={factor === 1 ? 1 : 0.01}
                                  step={factor === 1 ? 1 : 0.01}
                                  type="number"
                                  required
                                  placeholder="0"
                                  value={item.price_minor / factor || ""}
                                  onChange={(e) =>
                                    updatePackage(index, {
                                      price_minor: Math.round(
                                        Number(e.target.value) * factor,
                                      ),
                                    })
                                  }
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                                  {t("fields.delivery")}
                                </label>
                                <input
                                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#131b2e] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 text-sm min-h-[40px]"
                                  max={365}
                                  min={1}
                                  type="number"
                                  required
                                  value={item.delivery_days}
                                  onChange={(e) =>
                                    updatePackage(index, {
                                      delivery_days: Number(e.target.value),
                                    })
                                  }
                                />
                              </div>

                              <div>
                                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                                  {t("fields.revisions")}
                                </label>
                                <input
                                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#131b2e] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 text-sm min-h-[40px]"
                                  max={20}
                                  min={0}
                                  type="number"
                                  required
                                  value={item.revision_limit}
                                  onChange={(e) =>
                                    updatePackage(index, {
                                      revision_limit: Number(e.target.value),
                                    })
                                  }
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                                {t("fields.packageDescription")}
                              </label>
                              <textarea
                                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#131b2e] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 text-sm resize-none"
                                maxLength={1000}
                                rows={2}
                                placeholder="What is included in this package..."
                                value={item.description}
                                onChange={(e) =>
                                  updatePackage(index, {
                                    description: e.target.value,
                                  })
                                }
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </form>

              {/* Drawer Sticky Footer */}
              <div className="p-5 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0e1424] flex items-center justify-between">
                <div>
                  {draft.id && (
                    <button
                      type="button"
                      onClick={() => togglePublication(draft)}
                      disabled={saving || transitioningId === draft.id}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 border border-slate-300 dark:border-white/10 transition-colors min-h-[44px]"
                    >
                      {transitioningId === draft.id ? (
                        <LoaderCircle className="animate-spin" size={14} />
                      ) : draft.status === "published" ? (
                        <EyeOff size={14} />
                      ) : (
                        <Eye size={14} />
                      )}
                      <span>
                        {draft.status === "published"
                          ? t("unpublish")
                          : t("publish")}
                      </span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={closeDrawer}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-white/5 text-slate-700 dark:text-white/60 dark:hover:text-white border border-slate-300 dark:border-white/10 transition-colors min-h-[44px]"
                  >
                    Cancel
                  </button>
                  <button
                    form="service-drawer-form"
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all disabled:opacity-50 min-h-[44px]"
                  >
                    {saving ? (
                      <LoaderCircle className="animate-spin" size={16} />
                    ) : (
                      <Save size={16} />
                    )}
                    <span>{saving ? t("saving") : t("save")}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

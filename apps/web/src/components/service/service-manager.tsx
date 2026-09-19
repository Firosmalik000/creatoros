"use client";

import {
  ArrowUpRight,
  CirclePlus,
  Eye,
  EyeOff,
  LoaderCircle,
  PackagePlus,
  Save,
  Trash2,
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let active = true;
    creatorRequest<ServiceEnvelope<CreatorService[]>>("services")
      .then((response) => {
        if (!active) return;
        setItems(response.data);
        if (response.data[0]) setDraft(response.data[0]);
      })
      .catch((caught: ApiError) => active && setError(caught))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  function update(patch: Partial<CreatorService>) {
    setDraft((current) => ({ ...current, ...patch }));
    setSaved(false);
  }

  function updatePackage(index: number, patch: Partial<ServicePackage>) {
    update({
      packages: draft.packages.map((item, itemIndex) =>
        index === itemIndex ? { ...item, ...patch } : item,
      ),
    });
  }

  function select(item: CreatorService) {
    setDraft(item);
    setError(null);
    setSaved(false);
  }

  function startNew() {
    setDraft(emptyService());
    setError(null);
    setSaved(false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
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
      setDraft(response.data);
      setItems((current) => {
        const exists = current.some((item) => item.id === response.data.id);
        return exists
          ? current.map((item) =>
              item.id === response.data.id ? response.data : item,
            )
          : [response.data, ...current];
      });
      setSaved(true);
    } catch (caught) {
      setError(caught as ApiError);
    } finally {
      setSaving(false);
    }
  }

  async function changePublication(action: "publish" | "unpublish") {
    if (!draft.id) return;
    setTransitioning(true);
    setError(null);
    try {
      const response = await creatorRequest<ServiceEnvelope<CreatorService>>(
        `services/${draft.id}/${action}`,
        { method: "POST" },
      );
      setDraft(response.data);
      setItems((current) =>
        current.map((item) =>
          item.id === response.data.id ? response.data : item,
        ),
      );
    } catch (caught) {
      setError(caught as ApiError);
    } finally {
      setTransitioning(false);
    }
  }

  if (loading) {
    return (
      <div className="creator-state" role="status">
        <LoaderCircle className="spin" aria-hidden="true" /> {t("loading")}
      </div>
    );
  }

  if (error?.code === "unauthenticated" || error?.code === "forbidden") {
    return (
      <div className="creator-state creator-state--blocked">
        <p>{t(`errors.${normalizeCreatorErrorCode(error.code)}`)}</p>
        <Link className="button button--dark" href={`/${locale}/auth/login`}>
          {t("loginAction")}
        </Link>
      </div>
    );
  }

  return (
    <div className="service-studio">
      <aside className="service-index" aria-label={t("listLabel")}>
        <button className="service-index__new" onClick={startNew} type="button">
          <CirclePlus aria-hidden="true" size={19} /> {t("newService")}
        </button>
        {items.length ? (
          <div className="service-index__items">
            {items.map((item) => (
              <button
                className={item.id === draft.id ? "is-active" : ""}
                key={item.id}
                onClick={() => select(item)}
                type="button"
              >
                <span>{item.title}</span>
                <small>{t(`statuses.${item.status}`)}</small>
              </button>
            ))}
          </div>
        ) : (
          <div className="service-index__empty">
            <PackagePlus aria-hidden="true" />
            <strong>{t("emptyTitle")}</strong>
            <p>{t("emptyBody")}</p>
          </div>
        )}
      </aside>

      <form className="service-editor" onSubmit={save}>
        <header className="service-editor__header">
          <div>
            <h2>{draft.id ? t("editTitle") : t("createTitle")}</h2>
            <p>{t("editorBody")}</p>
          </div>
          <span className={`service-status service-status--${draft.status}`}>
            {t(`statuses.${draft.status}`)}
          </span>
        </header>

        {error ? (
          <div className="form-status form-status--error" role="alert">
            {t(`errors.${normalizeCreatorErrorCode(error.code)}`)}
          </div>
        ) : null}
        {saved ? (
          <div className="form-status form-status--success" role="status">
            {t("saved")}
          </div>
        ) : null}

        <div className="service-editor__fields">
          <label>
            <span>{t("fields.title")}</span>
            <input
              maxLength={120}
              minLength={3}
              onChange={(event) => update({ title: event.target.value })}
              required
              value={draft.title}
            />
          </label>
          <label>
            <span>{t("fields.slug")}</span>
            <input
              maxLength={80}
              onChange={(event) => update({ slug: event.target.value })}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              required
              value={draft.slug}
            />
            <small>{t("fields.slugHelp")}</small>
          </label>
          <label className="service-editor__wide">
            <span>{t("fields.description")}</span>
            <textarea
              maxLength={3000}
              minLength={20}
              onChange={(event) => update({ description: event.target.value })}
              required
              rows={5}
              value={draft.description}
            />
          </label>
        </div>

        <section className="package-builder">
          <div className="package-builder__heading">
            <div>
              <h3>{t("packagesTitle")}</h3>
              <p>{t("packagesBody")}</p>
            </div>
            {draft.packages.length < 3 ? (
              <button
                className="button button--quiet"
                onClick={() =>
                  update({ packages: [...draft.packages, emptyPackage()] })
                }
                type="button"
              >
                <CirclePlus aria-hidden="true" size={17} /> {t("addPackage")}
              </button>
            ) : null}
          </div>
          <div className="package-builder__list">
            {draft.packages.map((item, index) => {
              const factor = currencyFactor(item.currency);
              return (
                <fieldset
                  className="package-row"
                  key={`${item.id ?? "new"}-${index}`}
                >
                  <legend>{t("packageNumber", { number: index + 1 })}</legend>
                  {draft.packages.length > 1 ? (
                    <button
                      aria-label={t("removePackage", { number: index + 1 })}
                      className="package-row__remove"
                      onClick={() =>
                        update({
                          packages: draft.packages.filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                        })
                      }
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={17} />
                    </button>
                  ) : null}
                  <label>
                    <span>{t("fields.packageName")}</span>
                    <input
                      maxLength={80}
                      minLength={2}
                      onChange={(event) =>
                        updatePackage(index, { name: event.target.value })
                      }
                      required
                      value={item.name}
                    />
                  </label>
                  <label className="package-row__description">
                    <span>{t("fields.packageDescription")}</span>
                    <textarea
                      maxLength={1000}
                      onChange={(event) =>
                        updatePackage(index, {
                          description: event.target.value,
                        })
                      }
                      rows={3}
                      value={item.description}
                    />
                  </label>
                  <label>
                    <span>{t("fields.currency")}</span>
                    <select
                      onChange={(event) => {
                        const currency = event.target
                          .value as ServicePackage["currency"];
                        updatePackage(index, { currency, price_minor: 0 });
                      }}
                      value={item.currency}
                    >
                      <option value="IDR">IDR</option>
                      <option value="MYR">MYR</option>
                      <option value="USD">USD</option>
                    </select>
                  </label>
                  <label>
                    <span>{t("fields.price")}</span>
                    <input
                      min={factor === 1 ? 1 : 0.01}
                      onChange={(event) =>
                        updatePackage(index, {
                          price_minor: Math.round(
                            Number(event.target.value) * factor,
                          ),
                        })
                      }
                      required
                      step={factor === 1 ? 1 : 0.01}
                      type="number"
                      value={item.price_minor / factor || ""}
                    />
                  </label>
                  <label>
                    <span>{t("fields.delivery")}</span>
                    <input
                      max={365}
                      min={1}
                      onChange={(event) =>
                        updatePackage(index, {
                          delivery_days: Number(event.target.value),
                        })
                      }
                      required
                      type="number"
                      value={item.delivery_days}
                    />
                  </label>
                  <label>
                    <span>{t("fields.revisions")}</span>
                    <input
                      max={20}
                      min={0}
                      onChange={(event) =>
                        updatePackage(index, {
                          revision_limit: Number(event.target.value),
                        })
                      }
                      required
                      type="number"
                      value={item.revision_limit}
                    />
                  </label>
                </fieldset>
              );
            })}
          </div>
        </section>

        <footer className="service-editor__actions">
          <button
            className="button button--signal"
            disabled={saving}
            type="submit"
          >
            {saving ? (
              <LoaderCircle className="spin" aria-hidden="true" />
            ) : (
              <Save aria-hidden="true" size={18} />
            )}
            {saving ? t("saving") : t("save")}
          </button>
          {draft.id ? (
            <button
              className="button button--dark"
              disabled={saving || transitioning}
              onClick={() =>
                changePublication(
                  draft.status === "published" ? "unpublish" : "publish",
                )
              }
              type="button"
            >
              {transitioning ? (
                <LoaderCircle className="spin" aria-hidden="true" />
              ) : draft.status === "published" ? (
                <EyeOff aria-hidden="true" size={18} />
              ) : (
                <Eye aria-hidden="true" size={18} />
              )}
              {transitioning
                ? t("updatingStatus")
                : t(draft.status === "published" ? "unpublish" : "publish")}
            </button>
          ) : null}
          {draft.status === "published" ? (
            <Link
              className="service-editor__public-link"
              href={`/${locale}/creators/${draft.creator_slug}/services/${draft.slug}`}
            >
              {t("viewPublic")} <ArrowUpRight aria-hidden="true" size={17} />
            </Link>
          ) : null}
        </footer>
      </form>
    </div>
  );
}

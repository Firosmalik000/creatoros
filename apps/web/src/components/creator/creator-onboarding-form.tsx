"use client";

import {
  ArrowUpRight,
  BadgeCheck,
  LoaderCircle,
  Plus,
  Save,
  Send,
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
  ApiEnvelope,
  CreatorCatalog,
  CreatorProfile,
  PortfolioItem,
  SocialAccount,
} from "@/lib/creator-types";

const emptySocial = (): SocialAccount => ({
  platform_code: "",
  handle: "",
  profile_url: "",
  follower_count: 0,
  average_views: 0,
  engagement_bps: 0,
});

const emptyPortfolio = (): PortfolioItem => ({
  title: "",
  description: "",
  media_url: "",
  thumbnail_url: "",
  sort_order: 0,
});

const emptyProfile: CreatorProfile = {
  user_id: "",
  display_name: "",
  slug: "",
  headline: "",
  bio: "",
  city: "",
  country_code: "ID",
  verification_status: "draft",
  submitted_at: null,
  reviewed_at: null,
  categories: [],
  languages: [],
  social_accounts: [],
  portfolio: [],
  complete: false,
  missing_fields: [],
};

export function CreatorOnboardingForm() {
  const t = useTranslations("CreatorOnboarding");
  const locale = useLocale();
  const [profile, setProfile] = useState(emptyProfile);
  const [catalog, setCatalog] = useState<CreatorCatalog>({
    platforms: [],
    categories: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      creatorRequest<ApiEnvelope<CreatorProfile>>(
        `onboarding?locale=${locale}`,
      ),
      creatorRequest<ApiEnvelope<CreatorCatalog>>(`catalog?locale=${locale}`),
    ])
      .then(([profileResponse, catalogResponse]) => {
        if (!active) return;
        setProfile(profileResponse.data);
        setCatalog(catalogResponse.data);
      })
      .catch((caught: ApiError) => {
        if (active) setError(caught);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [locale]);

  function update<K extends keyof CreatorProfile>(
    key: K,
    value: CreatorProfile[K],
  ) {
    setProfile((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function updateSocial(index: number, patch: Partial<SocialAccount>) {
    update(
      "social_accounts",
      profile.social_accounts.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  }

  function updatePortfolio(index: number, patch: Partial<PortfolioItem>) {
    update(
      "portfolio",
      profile.portfolio.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const response = await creatorRequest<ApiEnvelope<CreatorProfile>>(
        `onboarding?locale=${locale}`,
        {
          method: "PUT",
          body: JSON.stringify({
            slug: profile.slug,
            headline: profile.headline,
            bio: profile.bio,
            city: profile.city,
            country_code: profile.country_code,
            category_codes: profile.categories.map((item) => item.code),
            languages: profile.languages,
            social_accounts: profile.social_accounts,
            portfolio: profile.portfolio,
          }),
        },
      );
      setProfile(response.data);
      setSaved(true);
    } catch (caught) {
      setError(caught as ApiError);
    } finally {
      setSaving(false);
    }
  }

  async function submitVerification() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await creatorRequest<ApiEnvelope<CreatorProfile>>(
        `submit?locale=${locale}`,
        { method: "POST" },
      );
      setProfile(response.data);
      setSaved(false);
    } catch (caught) {
      setError(caught as ApiError);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="creator-state" role="status">
        <LoaderCircle className="spin" aria-hidden="true" />
        {t("loading")}
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
    <form className="creator-onboarding" onSubmit={save}>
      <aside className="onboarding-progress" aria-label={t("progressLabel")}>
        <div className="creator-status-mark">
          {profile.verification_status === "verified" ? (
            <BadgeCheck aria-hidden="true" />
          ) : (
            <span aria-hidden="true">{profile.display_name.slice(0, 1)}</span>
          )}
        </div>
        <div>
          <strong>{t(`statuses.${profile.verification_status}`)}</strong>
          <p>{t(`statusHelp.${profile.verification_status}`)}</p>
        </div>
        <ol>
          {["profile", "categories", "social_accounts", "portfolio"].map(
            (item) => (
              <li
                className={
                  !profile.missing_fields?.includes(item) ? "is-complete" : ""
                }
                key={item}
              >
                <span aria-hidden="true" />
                {t(`steps.${item}`)}
              </li>
            ),
          )}
        </ol>
        {profile.verification_status === "verified" && profile.slug ? (
          <Link
            className="onboarding-public-link"
            href={`/${locale}/creators/${profile.slug}`}
          >
            {t("viewPublic")}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        ) : null}
      </aside>

      <div className="onboarding-sections">
        {error ? (
          <div className="form-status form-status--error" role="alert">
            <p>{t(`errors.${normalizeCreatorErrorCode(error.code)}`)}</p>
          </div>
        ) : null}
        {saved ? (
          <div className="form-status form-status--success" role="status">
            <p>{t("saved")}</p>
          </div>
        ) : null}
        {profile.review_note ? (
          <div className="review-note">
            <strong>{t("reviewNote")}</strong>
            <p>{profile.review_note}</p>
          </div>
        ) : null}

        <section className="onboarding-section" aria-labelledby="profile-title">
          <div className="onboarding-section__heading">
            <h2 id="profile-title">{t("profileTitle")}</h2>
          </div>
          <div className="onboarding-field-grid">
            <label className="field field--wide">
              <span>{t("headlineLabel")}</span>
              <input
                maxLength={120}
                minLength={3}
                onChange={(event) => update("headline", event.target.value)}
                required
                placeholder="e.g. Tech Reviewer & Storyteller"
                value={profile.headline}
              />
            </label>
            <label className="field field--wide">
              <span>{t("bioLabel")}</span>
              <textarea
                maxLength={2000}
                minLength={20}
                onChange={(event) => update("bio", event.target.value)}
                required
                rows={4}
                placeholder="Introduce yourself, your audience, and your creative style..."
                value={profile.bio}
              />
            </label>
            <label className="field">
              <span>{t("slugLabel")}</span>
              <input
                maxLength={80}
                onChange={(event) => update("slug", event.target.value)}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                required
                placeholder="username-or-handle"
                value={profile.slug}
              />
            </label>
            <label className="field">
              <span>{t("cityLabel")}</span>
              <input
                maxLength={100}
                minLength={2}
                onChange={(event) => update("city", event.target.value)}
                required
                placeholder="e.g. Jakarta"
                value={profile.city}
              />
            </label>
            <label className="field">
              <span>{t("countryLabel")}</span>
              <select
                onChange={(event) => update("country_code", event.target.value)}
                required
                value={profile.country_code}
              >
                <option value="">{t("selectCountry")}</option>
                <option value="ID">{t("countries.ID")}</option>
                <option value="MY">{t("countries.MY")}</option>
                <option value="SG">{t("countries.SG")}</option>
              </select>
            </label>
          </div>
        </section>

        <section className="onboarding-section" aria-labelledby="fit-title">
          <div className="onboarding-section__heading">
            <h2 id="fit-title">{t("fitTitle")}</h2>
          </div>
          <fieldset className="choice-fieldset">
            <legend>{t("categoriesLabel")}</legend>
            <div className="choice-grid">
              {catalog.categories.map((category) => {
                const checked = profile.categories.some(
                  (item) => item.code === category.code,
                );
                return (
                  <label key={category.code}>
                    <input
                      checked={checked}
                      onChange={(event) =>
                        update(
                          "categories",
                          event.target.checked
                            ? [...profile.categories, category]
                            : profile.categories.filter(
                                (item) => item.code !== category.code,
                              ),
                        )
                      }
                      type="checkbox"
                    />
                    <span>{category.name}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <fieldset className="choice-fieldset">
            <legend>{t("languagesLabel")}</legend>
            <div className="choice-grid choice-grid--compact">
              {(["id", "en", "ms"] as const).map((language) => (
                <label key={language}>
                  <input
                    checked={profile.languages.includes(language)}
                    onChange={(event) =>
                      update(
                        "languages",
                        event.target.checked
                          ? [...profile.languages, language]
                          : profile.languages.filter(
                              (item) => item !== language,
                            ),
                      )
                    }
                    type="checkbox"
                  />
                  <span>{t(`languages.${language}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="onboarding-section" aria-labelledby="social-title">
          <div className="onboarding-section__heading onboarding-section__heading--action">
            <div>
              <h2 id="social-title">{t("socialTitle")}</h2>
            </div>
            <button
              className="button button--quiet"
              onClick={() =>
                update("social_accounts", [
                  ...profile.social_accounts,
                  emptySocial(),
                ])
              }
              type="button"
            >
              <Plus size={17} aria-hidden="true" />
              {t("addSocial")}
            </button>
          </div>
          {profile.social_accounts.length === 0 ? (
            <p className="onboarding-empty">{t("socialEmpty")}</p>
          ) : (
            <div className="repeater-list">
              {profile.social_accounts.map((account, index) => (
                <div
                  className="repeater-row"
                  key={`${account.platform_code}-${index}`}
                >
                  <label className="field">
                    <span>{t("platformLabel")}</span>
                    <select
                      onChange={(event) =>
                        updateSocial(index, {
                          platform_code: event.target.value,
                        })
                      }
                      required
                      value={account.platform_code}
                    >
                      <option value="">{t("selectPlatform")}</option>
                      {catalog.platforms.map((platform) => (
                        <option key={platform.code} value={platform.code}>
                          {platform.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>{t("handleLabel")}</span>
                    <input
                      onChange={(event) =>
                        updateSocial(index, { handle: event.target.value })
                      }
                      required
                      value={account.handle}
                    />
                  </label>
                  <label className="field field--wide">
                    <span>{t("profileUrlLabel")}</span>
                    <input
                      onChange={(event) =>
                        updateSocial(index, { profile_url: event.target.value })
                      }
                      required
                      type="url"
                      value={account.profile_url}
                    />
                  </label>
                  <label className="field">
                    <span>{t("followersLabel")}</span>
                    <input
                      min={0}
                      onChange={(event) =>
                        updateSocial(index, {
                          follower_count: Number(event.target.value),
                        })
                      }
                      type="number"
                      value={account.follower_count}
                    />
                  </label>
                  <label className="field">
                    <span>{t("viewsLabel")}</span>
                    <input
                      min={0}
                      onChange={(event) =>
                        updateSocial(index, {
                          average_views: Number(event.target.value),
                        })
                      }
                      type="number"
                      value={account.average_views}
                    />
                  </label>
                  <label className="field">
                    <span>{t("engagementLabel")}</span>
                    <input
                      max={100}
                      min={0}
                      onChange={(event) =>
                        updateSocial(index, {
                          engagement_bps: Math.round(
                            Number(event.target.value) * 100,
                          ),
                        })
                      }
                      step="0.01"
                      type="number"
                      value={account.engagement_bps / 100}
                    />
                  </label>
                  <button
                    aria-label={t("removeSocial")}
                    className="icon-button"
                    onClick={() =>
                      update(
                        "social_accounts",
                        profile.social_accounts.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      )
                    }
                    type="button"
                  >
                    <Trash2 size={17} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section
          className="onboarding-section"
          aria-labelledby="portfolio-title"
        >
          <div className="onboarding-section__heading onboarding-section__heading--action">
            <div>
              <h2 id="portfolio-title">{t("portfolioTitle")}</h2>
            </div>
            <button
              className="button button--quiet"
              onClick={() =>
                update("portfolio", [...profile.portfolio, emptyPortfolio()])
              }
              type="button"
            >
              <Plus size={17} aria-hidden="true" />
              {t("addPortfolio")}
            </button>
          </div>
          {profile.portfolio.length === 0 ? (
            <p className="onboarding-empty">{t("portfolioEmpty")}</p>
          ) : (
            <div className="portfolio-editor-list">
              {profile.portfolio.map((item, index) => (
                <div
                  className="portfolio-editor"
                  key={`${item.id ?? "new"}-${index}`}
                >
                  <span className="portfolio-editor__index" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="onboarding-field-grid">
                    <label className="field">
                      <span>{t("portfolioTitleLabel")}</span>
                      <input
                        onChange={(event) =>
                          updatePortfolio(index, { title: event.target.value })
                        }
                        required
                        value={item.title}
                      />
                    </label>
                    <label className="field">
                      <span>{t("mediaUrlLabel")}</span>
                      <input
                        onChange={(event) =>
                          updatePortfolio(index, {
                            media_url: event.target.value,
                          })
                        }
                        required
                        type="url"
                        value={item.media_url}
                      />
                    </label>
                    <label className="field field--wide">
                      <span>{t("portfolioDescriptionLabel")}</span>
                      <textarea
                        maxLength={1000}
                        onChange={(event) =>
                          updatePortfolio(index, {
                            description: event.target.value,
                          })
                        }
                        rows={3}
                        value={item.description}
                      />
                    </label>
                  </div>
                  <button
                    aria-label={t("removePortfolio")}
                    className="icon-button"
                    onClick={() =>
                      update(
                        "portfolio",
                        profile.portfolio.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      )
                    }
                    type="button"
                  >
                    <Trash2 size={17} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="onboarding-actions">
          <div>
            <strong>
              {profile.complete ? t("readyTitle") : t("notReadyTitle")}
            </strong>
            <p>
              {profile.complete
                ? t("readyBody")
                : t("missingBody", {
                    fields:
                      profile.missing_fields
                        ?.map((field) => t(`steps.${field}`))
                        .join(", ") || t("saveFirst"),
                  })}
            </p>
          </div>
          <div className="onboarding-action-buttons">
            <button
              className="button button--dark"
              disabled={saving || submitting}
              type="submit"
            >
              {saving ? (
                <LoaderCircle className="spin" aria-hidden="true" />
              ) : (
                <Save size={17} aria-hidden="true" />
              )}
              {saving ? t("saving") : t("save")}
            </button>
            <button
              className="button button--signal"
              disabled={
                saving ||
                submitting ||
                !profile.complete ||
                ["submitted", "under_review", "verified"].includes(
                  profile.verification_status,
                )
              }
              onClick={submitVerification}
              type="button"
            >
              {submitting ? (
                <LoaderCircle className="spin" aria-hidden="true" />
              ) : (
                <Send size={17} aria-hidden="true" />
              )}
              {submitting ? t("submitting") : t("submit")}
            </button>
          </div>
        </footer>
      </div>
    </form>
  );
}

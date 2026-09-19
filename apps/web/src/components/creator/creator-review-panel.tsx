"use client";

import { BadgeCheck, LoaderCircle, RefreshCw, Send } from "lucide-react";
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
  CreatorProfile,
  CreatorReviewItem,
} from "@/lib/creator-types";

type QueueResponse = ApiEnvelope<CreatorReviewItem[]>;

export function CreatorReviewPanel() {
  const t = useTranslations("CreatorReview");
  const locale = useLocale();
  const [queue, setQueue] = useState<CreatorReviewItem[]>([]);
  const [selected, setSelected] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [success, setSuccess] = useState("");

  async function loadQueue() {
    setLoading(true);
    setError(null);
    try {
      const response = await creatorRequest<QueueResponse>(
        "admin?status=submitted",
      );
      setQueue(response.data);
      setSelected(null);
    } catch (caught) {
      setError(caught as ApiError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    creatorRequest<QueueResponse>("admin?status=submitted")
      .then((response) => {
        if (active) setQueue(response.data);
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
  }, []);

  async function inspect(userID: string) {
    setDetailLoading(true);
    setError(null);
    try {
      const response = await creatorRequest<ApiEnvelope<CreatorProfile>>(
        `admin/${userID}?locale=${locale}`,
      );
      setSelected(response.data);
    } catch (caught) {
      setError(caught as ApiError);
    } finally {
      setDetailLoading(false);
    }
  }

  async function decide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    setSuccess("");
    try {
      const decision = String(form.get("decision"));
      await creatorRequest(
        `admin/${selected.user_id}/decision?locale=${locale}`,
        {
          method: "POST",
          body: JSON.stringify({ decision, note: String(form.get("note")) }),
        },
      );
      setQueue((items) =>
        items.filter((item) => item.user_id !== selected.user_id),
      );
      setSelected(null);
      setSuccess(t(`decisionSuccess.${decision}`));
    } catch (caught) {
      setError(caught as ApiError);
    } finally {
      setSubmitting(false);
    }
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
    <div className="review-workspace">
      <section className="review-queue" aria-labelledby="review-queue-title">
        <div className="review-queue__heading">
          <div>
            <h2 id="review-queue-title">{t("queueTitle")}</h2>
            <p>{t("queueCount", { count: queue.length })}</p>
          </div>
          <button
            aria-label={t("refresh")}
            className="icon-button"
            disabled={loading}
            onClick={loadQueue}
            type="button"
          >
            <RefreshCw className={loading ? "spin" : ""} size={17} />
          </button>
        </div>
        {loading ? (
          <div className="review-empty" role="status">
            <LoaderCircle className="spin" /> {t("loading")}
          </div>
        ) : queue.length === 0 ? (
          <div className="review-empty">
            <BadgeCheck aria-hidden="true" />
            <strong>{t("emptyTitle")}</strong>
            <p>{t("emptyBody")}</p>
          </div>
        ) : (
          <div className="review-list">
            {queue.map((item) => (
              <button
                className={
                  selected?.user_id === item.user_id ? "is-selected" : ""
                }
                key={item.user_id}
                onClick={() => inspect(item.user_id)}
                type="button"
              >
                <strong>{item.display_name}</strong>
                <span>{item.headline}</span>
                <small>
                  {item.city}, {item.country_code}
                </small>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="review-detail" aria-live="polite">
        {error ? (
          <div className="form-status form-status--error" role="alert">
            {t(`errors.${normalizeCreatorErrorCode(error.code)}`)}
          </div>
        ) : null}
        {success ? (
          <div className="form-status form-status--success" role="status">
            {success}
          </div>
        ) : null}
        {detailLoading ? (
          <div className="review-detail__placeholder" role="status">
            <LoaderCircle className="spin" /> {t("loadingProfile")}
          </div>
        ) : selected ? (
          <div className="review-sheet">
            <header>
              <div>
                <h2>{selected.display_name}</h2>
                <p>{selected.headline}</p>
              </div>
              <span>{t(`statuses.${selected.verification_status}`)}</span>
            </header>
            <dl className="review-facts">
              <div>
                <dt>{t("location")}</dt>
                <dd>
                  {selected.city}, {selected.country_code}
                </dd>
              </div>
              <div>
                <dt>{t("categories")}</dt>
                <dd>
                  {selected.categories.map((item) => item.name).join(", ")}
                </dd>
              </div>
              <div>
                <dt>{t("languages")}</dt>
                <dd>{selected.languages.join(", ").toUpperCase()}</dd>
              </div>
              <div>
                <dt>{t("evidence")}</dt>
                <dd>
                  {t("evidenceCount", {
                    socials: selected.social_accounts.length,
                    portfolio: selected.portfolio.length,
                  })}
                </dd>
              </div>
            </dl>
            <div className="review-bio">
              <h3>{t("about")}</h3>
              <p>{selected.bio}</p>
            </div>
            <div className="review-links">
              {selected.social_accounts.map((account) => (
                <a
                  href={account.profile_url}
                  key={account.platform_code}
                  rel="noreferrer"
                  target="_blank"
                >
                  {account.platform_name} · @{account.handle}
                </a>
              ))}
              {selected.portfolio.map((item) => (
                <a
                  href={item.media_url}
                  key={item.id ?? item.title}
                  rel="noreferrer"
                  target="_blank"
                >
                  {item.title}
                </a>
              ))}
            </div>
            <form className="review-decision" onSubmit={decide}>
              <label className="field">
                <span>{t("decisionLabel")}</span>
                <select defaultValue="verified" name="decision">
                  <option value="verified">{t("decisions.verified")}</option>
                  <option value="revision_required">
                    {t("decisions.revision_required")}
                  </option>
                  <option value="rejected">{t("decisions.rejected")}</option>
                </select>
              </label>
              <label className="field">
                <span>{t("noteLabel")}</span>
                <textarea maxLength={1000} name="note" rows={4} />
                <small>{t("noteHelp")}</small>
              </label>
              <button className="button button--signal" disabled={submitting}>
                {submitting ? (
                  <LoaderCircle className="spin" />
                ) : (
                  <Send size={17} />
                )}
                {submitting ? t("submitting") : t("submitDecision")}
              </button>
            </form>
          </div>
        ) : (
          <div className="review-detail__placeholder">
            <strong>{t("selectTitle")}</strong>
            <p>{t("selectBody")}</p>
          </div>
        )}
      </section>
    </div>
  );
}

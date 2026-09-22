"use client";

import {
  cancelCampaign,
  completeCampaign,
  publishCampaign,
} from "@/lib/campaign-client";
import type { Campaign, CampaignMatchedCreator } from "@/lib/campaign-types";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { CreatorMatcher } from "./creator-matcher";
import { InvitationList } from "./invitation-list";

type CampaignDetailViewProps = {
  initialCampaign: Campaign;
  initialMatches: CampaignMatchedCreator[];
  locale: string;
};

export function CampaignDetailView({
  initialCampaign,
  initialMatches,
  locale,
}: CampaignDetailViewProps) {
  const t = useTranslations("Campaign");
  const [campaign, setCampaign] = useState<Campaign>(initialCampaign);
  const [matches] = useState<CampaignMatchedCreator[]>(initialMatches);
  const [activeTab, setActiveTab] = useState<
    "overview" | "matches" | "invites" | "applicants"
  >("overview");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePublish = async () => {
    setErrorMessage(null);
    setActionLoading("publish");
    try {
      const updated = await publishCampaign(campaign.id);
      setCampaign(updated);
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setErrorMessage(
        errObj.message || "Failed to publish campaign. Please try again.",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm("Are you sure you want to cancel this campaign?"))
      return;
    setErrorMessage(null);
    setActionLoading("cancel");
    try {
      const updated = await cancelCampaign(campaign.id);
      setCampaign(updated);
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setErrorMessage(
        errObj.message || "Failed to cancel campaign. Please try again.",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleComplete = async () => {
    setErrorMessage(null);
    setActionLoading("complete");
    try {
      const updated = await completeCampaign(campaign.id);
      setCampaign(updated);
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setErrorMessage(
        errObj.message || "Failed to complete campaign. Please try again.",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const formatBudget = (budgetMinor: number, currency: string) => {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "IDR" ? 0 : 2,
    }).format(budgetMinor / (currency === "IDR" ? 1 : 100));
  };

  const invitations = campaign.invitations ?? [];

  const applicants = invitations.filter((i) => i.status === "applied");
  const directInvites = invitations.filter((i) => i.status !== "applied");

  return (
    <div className="campaign-detail">
      <div className="campaign-detail__breadcrumb">
        <Link href={`/${locale}/campaigns`}>← {t("backToCampaigns")}</Link>
      </div>

      {errorMessage && (
        <div className="campaign-detail__error" role="alert">
          {errorMessage}
        </div>
      )}

      {/* Header Banner */}
      <header className="campaign-detail__header">
        <div className="campaign-detail__title-box">
          <div className="campaign-detail__badge-row">
            <span
              className={`campaign-card__badge campaign-card__badge--${campaign.status}`}
            >
              {campaign.status === "draft" && t("statusDraft")}
              {campaign.status === "active" && t("statusActive")}
              {campaign.status === "completed" && t("statusCompleted")}
              {campaign.status === "cancelled" && t("statusCancelled")}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                campaign.visibility === "public"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                  : "bg-blue-500/15 text-blue-400 border border-blue-500/20"
              }`}
            >
              {campaign.visibility === "public" ? "🌐 Publik (Terbuka)" : "🔒 Privat (Undangan)"}
            </span>
            <span className="campaign-detail__created">
              {new Date(campaign.created_at).toLocaleDateString(locale)}
            </span>
          </div>
          <h1 className="campaign-detail__title">{campaign.title}</h1>
          <p className="campaign-detail__description">{campaign.description}</p>
        </div>

        <div className="campaign-detail__actions">
          {campaign.status === "draft" && (
            <>
              <button
                type="button"
                className="campaign-btn campaign-btn--primary"
                disabled={actionLoading !== null}
                onClick={handlePublish}
              >
                {actionLoading === "publish" ? t("publishing") : t("publish")}
              </button>
              <button
                type="button"
                className="campaign-btn campaign-btn--danger"
                disabled={actionLoading !== null}
                onClick={handleCancel}
              >
                {actionLoading === "cancel" ? t("cancelling") : t("cancel")}
              </button>
            </>
          )}

          {campaign.status === "active" && (
            <>
              <button
                type="button"
                className="campaign-btn campaign-btn--primary"
                disabled={actionLoading !== null}
                onClick={handleComplete}
              >
                {actionLoading === "complete" ? t("completing") : t("complete")}
              </button>
              <button
                type="button"
                className="campaign-btn campaign-btn--danger"
                disabled={actionLoading !== null}
                onClick={handleCancel}
              >
                {actionLoading === "cancel" ? t("cancelling") : t("cancel")}
              </button>
            </>
          )}
        </div>
      </header>

      {/* Key Metrics Strip */}
      <div className="campaign-detail__metrics">
        <div className="campaign-detail__metric-item">
          <span className="campaign-detail__metric-label">{t("budget")}</span>
          <span className="campaign-detail__metric-val">
            {formatBudget(campaign.budget_minor, campaign.currency)}
          </span>
        </div>
        <div className="campaign-detail__metric-item">
          <span className="campaign-detail__metric-label">{t("target")}</span>
          <span className="campaign-detail__metric-val">
            {t("creatorsCount", { count: campaign.target_creators })}
          </span>
        </div>
        <div className="campaign-detail__metric-item">
          <span className="campaign-detail__metric-label">{t("deadline")}</span>
          <span className="campaign-detail__metric-val">
            {new Date(campaign.deadline).toLocaleDateString(locale)}
          </span>
        </div>
        <div className="campaign-detail__metric-item">
          <span className="campaign-detail__metric-label">
            {t("invitations")}
          </span>
          <span className="campaign-detail__metric-val">
            {directInvites.length}
          </span>
        </div>
        <div className="campaign-detail__metric-item">
          <span className="campaign-detail__metric-label">
            Pelamar
          </span>
          <span className="campaign-detail__metric-val">
            {applicants.length}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="campaign-detail__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "overview"}
          className={`campaign-detail__tab ${activeTab === "overview" ? "is-active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          {t("overview")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "matches"}
          className={`campaign-detail__tab ${activeTab === "matches" ? "is-active" : ""}`}
          onClick={() => setActiveTab("matches")}
        >
          {t("matchedCreators")} ({matches.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "invites"}
          className={`campaign-detail__tab ${activeTab === "invites" ? "is-active" : ""}`}
          onClick={() => setActiveTab("invites")}
        >
          {t("invitations")} ({directInvites.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "applicants"}
          className={`campaign-detail__tab ${activeTab === "applicants" ? "is-active" : ""}`}
          onClick={() => setActiveTab("applicants")}
        >
          Pelamar Masuk ({applicants.length})
        </button>
      </div>

      {/* Tab Panels */}
      <div className="campaign-detail__panel">
        {activeTab === "overview" && (
          <div className="campaign-overview">
            <h2 className="campaign-section-title">{t("requirements")}</h2>
            <div className="campaign-requirements-grid">
              {campaign.requirements.map((req, i) => (
                <div key={req.id || i} className="campaign-requirement-card">
                  <div className="campaign-requirement-card__top">
                    <span className="campaign-requirement-card__deliverable">
                      {req.deliverable_type}
                    </span>
                    <span className="campaign-badge campaign-badge--qty">
                      x{req.quantity}
                    </span>
                  </div>
                  <dl className="campaign-requirement-card__dl">
                    <div>
                      <dt>{t("platformLabel")}</dt>
                      <dd>{req.platform_name || t("allPlatforms")}</dd>
                    </div>
                    <div>
                      <dt>{t("categoryLabel")}</dt>
                      <dd>{req.category_name || t("allCategories")}</dd>
                    </div>
                    <div>
                      <dt>{t("minFollowersLabel")}</dt>
                      <dd>{req.min_followers.toLocaleString(locale)}</dd>
                    </div>
                    <div>
                      <dt>{t("minEngagementLabel")}</dt>
                      <dd>{req.min_engagement_rate.toFixed(1)}%</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "matches" && (
          <CreatorMatcher
            campaignID={campaign.id}
            campaignStatus={campaign.status}
            matchedCreators={matches}
            invitations={invitations}
            locale={locale}
            onInviteSuccess={() => {
              // update invitations count or refetch if needed
            }}
          />
        )}

        {activeTab === "invites" && (
          <InvitationList
            campaignID={campaign.id}
            invitations={directInvites}
            currency={campaign.currency}
            locale={locale}
          />
        )}

        {activeTab === "applicants" && (
          <InvitationList
            campaignID={campaign.id}
            invitations={applicants}
            currency={campaign.currency}
            locale={locale}
          />
        )}
      </div>
    </div>
  );
}

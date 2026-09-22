"use client";

import { createCampaignInvitation } from "@/lib/campaign-client";
import type {
  CampaignInvitation,
  CampaignMatchedCreator,
} from "@/lib/campaign-types";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

type CreatorMatcherProps = {
  campaignID: string;
  campaignStatus?: string;
  matchedCreators: CampaignMatchedCreator[];
  invitations: CampaignInvitation[];
  locale: string;
  onInviteSuccess?: () => void;
};

export function CreatorMatcher({
  campaignID,
  campaignStatus,
  matchedCreators,
  invitations,
  locale,
  onInviteSuccess,
}: CreatorMatcherProps) {
  const t = useTranslations("Campaign");
  const isDraft = campaignStatus === "draft";
  const canInvite = campaignStatus === "active";
  const [invitedUserIDs, setInvitedUserIDs] = useState<Set<string>>(
    () => new Set(invitations.map((inv) => inv.creator_user_id)),
  );
  const [invitingID, setInvitingID] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleInvite = async (creatorUserID: string) => {
    if (!canInvite) return;
    setErrorMessage(null);
    setInvitingID(creatorUserID);
    try {
      await createCampaignInvitation(campaignID, creatorUserID);
      setInvitedUserIDs((prev) => new Set([...prev, creatorUserID]));
      if (onInviteSuccess) onInviteSuccess();
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setErrorMessage(
        errObj.message || "Failed to send invitation. Please try again.",
      );
    } finally {
      setInvitingID(null);
    }
  };

  if (matchedCreators.length === 0) {
    return (
      <div className="campaign-empty-box">
        <p>{t("noMatches")}</p>
      </div>
    );
  }

  return (
    <div className="campaign-matcher">
      {isDraft && (
        <div
          className="campaign-matcher__draft-notice"
          role="status"
          style={{
            padding: "0.75rem 1rem",
            marginBottom: "1rem",
            backgroundColor: "#fef3c7",
            color: "#92400e",
            borderRadius: "0.375rem",
            fontSize: "0.875rem",
          }}
        >
          {t("draftNotice")}
        </div>
      )}

      {errorMessage && (
        <div className="campaign-matcher__error" role="alert">
          {errorMessage}
        </div>
      )}

      <div className="campaign-matcher__grid">
        {matchedCreators.map((creator) => {
          const isInvited = invitedUserIDs.has(creator.creator_user_id);
          const isPending = invitingID === creator.creator_user_id;

          return (
            <div
              key={creator.creator_user_id}
              className="campaign-creator-card"
            >
              <div className="campaign-creator-card__header">
                <div className="campaign-creator-card__avatar">
                  {creator.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={creator.avatar_url}
                      alt={creator.display_name}
                      className="campaign-creator-card__img"
                    />
                  ) : (
                    <span className="campaign-creator-card__initial">
                      {creator.display_name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="campaign-creator-card__info">
                  <Link
                    href={`/${locale}/creators/${creator.slug}`}
                    className="campaign-creator-card__name"
                    target="_blank"
                  >
                    {creator.display_name}
                  </Link>
                  <span className="campaign-creator-card__meta">
                    {creator.category_name || "Creator"}
                    {creator.platform_name ? ` • ${creator.platform_name}` : ""}
                  </span>
                </div>
                <div
                  className="campaign-creator-card__score"
                  title={t("matchScore")}
                >
                  <span>{creator.match_score}%</span>
                </div>
              </div>

              <div className="campaign-creator-card__stats">
                <div>
                  <span className="campaign-creator-card__stat-label">
                    {t("followers")}
                  </span>
                  <span className="campaign-creator-card__stat-value">
                    {creator.follower_count.toLocaleString(locale)}
                  </span>
                </div>
                <div>
                  <span className="campaign-creator-card__stat-label">
                    {t("engagement")}
                  </span>
                  <span className="campaign-creator-card__stat-value">
                    {creator.engagement_rate.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="campaign-creator-card__action">
                {isInvited ? (
                  <span className="campaign-badge campaign-badge--invited">
                    ✓ {t("alreadyInvited")}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="campaign-btn campaign-btn--primary-sm"
                    disabled={isPending || !canInvite}
                    title={!canInvite ? t("publishToInvite") : undefined}
                    onClick={() => handleInvite(creator.creator_user_id)}
                  >
                    {isPending ? t("inviting") : t("invite")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

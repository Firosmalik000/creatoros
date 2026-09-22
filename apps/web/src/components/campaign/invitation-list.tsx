"use client";

import { selectCampaignCreator } from "@/lib/campaign-client";
import type { CampaignInvitation } from "@/lib/campaign-types";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

type InvitationListProps = {
  campaignID: string;
  invitations: CampaignInvitation[];
  currency: string;
  locale: string;
  onSelectSuccess?: () => void;
};

export function InvitationList({
  campaignID,
  invitations: initialInvitations,
  currency,
  locale,
  onSelectSuccess,
}: InvitationListProps) {
  const t = useTranslations("Campaign");
  const [invitations, setInvitations] =
    useState<CampaignInvitation[]>(initialInvitations);
  const [selectingID, setSelectingID] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSelect = async (invitationID: string) => {
    setErrorMessage(null);
    setSelectingID(invitationID);
    try {
      const updated = await selectCampaignCreator(campaignID, invitationID);
      setInvitations((prev) =>
        prev.map((inv) => (inv.id === invitationID ? updated : inv)),
      );
      if (onSelectSuccess) onSelectSuccess();
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setErrorMessage(
        errObj.message || "Failed to select creator. Please try again.",
      );
    } finally {
      setSelectingID(null);
    }
  };

  const formatRate = (rateMinor: number | null | undefined) => {
    if (!rateMinor) return null;
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "IDR" ? 0 : 2,
    }).format(rateMinor / (currency === "IDR" ? 1 : 100));
  };

  if (invitations.length === 0) {
    return (
      <div className="campaign-empty-box">
        <p>{t("noInvitations")}</p>
      </div>
    );
  }

  return (
    <div className="campaign-invitations">
      {errorMessage && (
        <div className="campaign-invitations__error" role="alert">
          {errorMessage}
        </div>
      )}

      <div className="campaign-invitations__list">
        {invitations.map((inv) => {
          const isAccepted = inv.status === "accepted";
          const isSelected = inv.status === "selected";
          const isDeclined = inv.status === "declined";
          const isPending = selectingID === inv.id;

          return (
            <div key={inv.id} className="campaign-invitation-card">
              <div className="campaign-invitation-card__top">
                <div className="campaign-invitation-card__creator">
                  {inv.creator_slug ? (
                    <Link
                      href={`/${locale}/creators/${inv.creator_slug}`}
                      className="campaign-invitation-card__name"
                      target="_blank"
                    >
                      {inv.creator_name || "Creator"}
                    </Link>
                  ) : (
                    <span className="campaign-invitation-card__name">
                      {inv.creator_name || "Creator"}
                    </span>
                  )}
                  <span className="campaign-invitation-card__date">
                    {new Date(inv.created_at).toLocaleDateString(locale)}
                  </span>
                </div>

                <div className="campaign-invitation-card__status">
                  {isSelected && (
                    <span className="campaign-badge campaign-badge--selected">
                      ★ {t("selectedBadge")}
                    </span>
                  )}
                  {isAccepted && (
                    <span className="campaign-badge campaign-badge--accepted">
                      ✓ {t("acceptedBadge")}
                    </span>
                  )}
                  {isDeclined && (
                    <span className="campaign-badge campaign-badge--declined">
                      ✕ {t("declinedBadge")}
                    </span>
                  )}
                  {inv.status === "applied" && (
                    <span className="campaign-badge bg-blue-500/15 text-blue-400 border border-blue-500/20">
                      📩 Pelamar Masuk
                    </span>
                  )}
                  {inv.status === "invited" && (
                    <span className="campaign-badge campaign-badge--invited">
                      ⏳ {t("invitedBadge")}
                    </span>
                  )}
                </div>
              </div>

              {(inv.pitch || inv.pitch_note) && (
                <div className="campaign-invitation-card__pitch">
                  <strong>Proposal / Pitch:</strong> {inv.pitch || inv.pitch_note}
                </div>
              )}

              {(inv.proposed_rate_minor || inv.offered_fee_minor) && (
                <div className="campaign-invitation-card__rate">
                  <strong>Tawaran Biaya:</strong>{" "}
                  {formatRate(inv.proposed_rate_minor || inv.offered_fee_minor)}
                </div>
              )}

              {(isAccepted || inv.status === "applied") && (
                <div className="campaign-invitation-card__actions">
                  <button
                    type="button"
                    className="campaign-btn campaign-btn--primary-sm"
                    disabled={isPending}
                    onClick={() => handleSelect(inv.id)}
                  >
                    {isPending ? t("selecting") : "Terima & Rekrut"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

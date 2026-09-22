"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, Clock, LoaderCircle, X, Megaphone, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { respondCampaignInvitation } from "@/lib/campaign-client";
import type { CampaignInvitation } from "@/lib/campaign-types";

type CreatorInvitesInboxProps = {
  invitations: CampaignInvitation[];
  locale: string;
};

export function CreatorInvitesInbox({
  invitations: initialInvitations,
  locale,
}: CreatorInvitesInboxProps) {
  const t = useTranslations("Campaign");
  const [invitations, setInvitations] =
    useState<CampaignInvitation[]>(initialInvitations);
  const [activeTab, setActiveTab] = useState<"invitations" | "applications">(
    "invitations",
  );
  const [respondingID, setRespondingID] = useState<string | null>(null);
  const [activeModalInvite, setActiveModalInvite] =
    useState<CampaignInvitation | null>(null);
  const [pitch, setPitch] = useState("");
  const [proposedRate, setProposedRate] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRespond = async (
    invitation: CampaignInvitation,
    action: "accept" | "decline",
  ) => {
    setErrorMessage(null);
    setRespondingID(invitation.id);
    try {
      const currency = invitation.campaign_currency || "IDR";
      let proposedRateMinor: number | undefined;
      if (action === "accept" && proposedRate) {
        const rateNum = Number(proposedRate);
        if (rateNum > 0) {
          proposedRateMinor =
            currency === "IDR"
              ? Math.round(rateNum)
              : Math.round(rateNum * 100);
        }
      }

      const updated = await respondCampaignInvitation(invitation.id, {
        action,
        pitch: action === "accept" ? pitch : undefined,
        proposed_rate_minor: proposedRateMinor,
      });

      setInvitations((prev) =>
        prev.map((inv) => (inv.id === invitation.id ? updated : inv)),
      );
      setActiveModalInvite(null);
      setPitch("");
      setProposedRate("");
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setErrorMessage(
        errObj.message || "Failed to submit response. Please try again.",
      );
    } finally {
      setRespondingID(null);
    }
  };

  const formatBudget = (
    budgetMinor: number | null | undefined,
    currency: string | null | undefined,
  ) => {
    if (!budgetMinor || !currency) return null;
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "IDR" ? 0 : 2,
    }).format(budgetMinor / (currency === "IDR" ? 1 : 100));
  };

  const inboundInvites = invitations.filter((i) => i.status !== "applied");
  const myApplications = invitations.filter((i) => i.status === "applied" || i.status === "selected" || i.status === "rejected");
  const activeList = activeTab === "invitations" ? inboundInvites : myApplications;

  return (
    <div className="space-y-6">
      {/* Top Toolbar with Tabs and Explore Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("invitations")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "invitations"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                : "bg-white/5 text-white/60 hover:text-white border border-white/10"
            }`}
          >
            Undangan Brand ({inboundInvites.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("applications")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "applications"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                : "bg-white/5 text-white/60 hover:text-white border border-white/10"
            }`}
          >
            Lamaran Terkirim ({myApplications.length})
          </button>
        </div>

        <Link
          href={`/${locale}/campaigns/explore`}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/15 text-xs font-semibold text-blue-400 border border-blue-500/20 transition-colors"
        >
          <Megaphone size={14} />
          <span>Jelajahi Campaign Terbuka</span>
          <span>→</span>
        </Link>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {activeList.length === 0 ? (
        <div className="bg-[#0e1424]/60 border border-white/10 rounded-2xl p-12 text-center max-w-md mx-auto space-y-3 my-8">
          <Clock className="w-10 h-10 text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-white">
            {activeTab === "invitations"
              ? t("noCreatorInvites")
              : "Belum ada lamaran yang diajukan"}
          </h3>
          <p className="text-xs text-white/50">
            {activeTab === "invitations"
              ? "Undangan langsung dari brand yang tertarik dengan portofolio Anda akan muncul di sini."
              : "Anda dapat mencari proyek konten yang sedang membuka lowongan dan melamar secara langsung."}
          </p>
          {activeTab === "applications" && (
            <div className="pt-2">
              <Link
                href={`/${locale}/campaigns/explore`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors"
              >
                <Send size={13} />
                <span>Cari Campaign Sekarang</span>
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {activeList.map((inv) => {
            const isInvited = inv.status === "invited";
            const isResponding = respondingID === inv.id;
            const budgetFormatted = formatBudget(
              inv.campaign_budget_minor || inv.offered_fee_minor,
              inv.campaign_currency || inv.currency || "IDR",
            );

            return (
              <div
                key={inv.id}
                className="bg-[#0e1424] border border-white/10 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-bold text-white">
                      {inv.campaign_title || "Campaign"}
                    </h3>
                    <div>
                      {inv.status === "selected" && (
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                          ★ {t("selectedBadge")}
                        </span>
                      )}
                      {inv.status === "accepted" && (
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          ✓ {t("acceptedBadge")}
                        </span>
                      )}
                      {inv.status === "declined" && (
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-slate-700/30 text-slate-400 border border-slate-600/30">
                          ✕ {t("declinedBadge")}
                        </span>
                      )}
                      {inv.status === "rejected" && (
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
                          ✕ Tidak Terpilih
                        </span>
                      )}
                      {inv.status === "applied" && (
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                          ⏳ Lamaran Dikirim (Menunggu Review)
                        </span>
                      )}
                      {inv.status === "invited" && (
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          ⏳ {t("invitedBadge")}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                    {budgetFormatted && (
                      <span>
                        Tawaran / Fee:{" "}
                        <strong className="text-slate-200">
                          {budgetFormatted}
                        </strong>
                      </span>
                    )}
                    {inv.campaign_deadline && (
                      <span>
                        Deadline:{" "}
                        <strong className="text-slate-200">
                          {new Date(inv.campaign_deadline).toLocaleDateString(locale)}
                        </strong>
                      </span>
                    )}
                  </div>

                  {(inv.pitch || inv.pitch_note) && (
                    <p className="text-xs text-slate-400 bg-[#131b2e] p-2.5 rounded-lg border border-white/5 mt-2">
                      <span className="text-slate-300 font-semibold">
                        Proposal / Pitch:
                      </span>{" "}
                      {inv.pitch || inv.pitch_note}
                    </p>
                  )}
                </div>

                {isInvited && (
                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModalInvite(inv);
                        setPitch("");
                        setProposedRate(
                          inv.campaign_budget_minor && inv.campaign_currency
                            ? (
                                inv.campaign_budget_minor /
                                (inv.campaign_currency === "IDR" ? 1 : 100)
                              ).toString()
                            : "",
                        );
                      }}
                      className="button button--signal px-4 py-2 text-xs font-semibold"
                    >
                      {t("acceptInvitation")}
                    </button>
                    <button
                      type="button"
                      disabled={isResponding}
                      onClick={() => handleRespond(inv, "decline")}
                      className="button button--quiet px-4 py-2 text-xs font-semibold text-slate-400 hover:text-red-400 hover:border-red-500/30"
                    >
                      {isResponding ? t("declining") : t("declineInvitation")}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Accept Campaign Invitation */}
      {activeModalInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setActiveModalInvite(null)}
          />
          <div className="relative w-full max-w-lg bg-[#0a0e1a] border border-white/10 rounded-2xl shadow-2xl p-6 space-y-5 z-10">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white">{t("acceptInvitation")}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {activeModalInvite.campaign_title || "Campaign Invitation"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalInvite(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  {t("pitch")}
                </label>
                <textarea
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0e1424] border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
                  rows={4}
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value)}
                  placeholder={t("pitchPlaceholder")}
                  maxLength={2000}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  {t("proposedRate")} ({activeModalInvite.campaign_currency || "IDR"})
                </label>
                <input
                  type="number"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0e1424] border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                  value={proposedRate}
                  onChange={(e) => setProposedRate(e.target.value)}
                  placeholder={t("ratePlaceholder")}
                  min="0"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setActiveModalInvite(null)}
                className="button button--quiet px-4 py-2 text-xs"
              >
                {t("prevStep")}
              </button>
              <button
                type="button"
                disabled={respondingID === activeModalInvite.id}
                onClick={() => handleRespond(activeModalInvite, "accept")}
                className="button button--signal px-5 py-2 text-xs font-bold inline-flex items-center gap-2"
              >
                {respondingID === activeModalInvite.id && <LoaderCircle className="spin" size={14} />}
                <span>{respondingID === activeModalInvite.id ? t("accepting") : t("acceptInvitation")}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

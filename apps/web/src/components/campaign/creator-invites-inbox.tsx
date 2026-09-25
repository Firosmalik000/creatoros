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
  const myApplications = invitations.filter(
    (i) => i.status === "applied" || i.status === "selected" || i.status === "rejected",
  );
  const activeList = activeTab === "invitations" ? inboundInvites : myApplications;

  return (
    <div className="space-y-6">
      {/* Top Toolbar with Tabs and Explore Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/90 dark:border-white/10">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("invitations")}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all min-h-[44px] ${
              activeTab === "invitations"
                ? "bg-blue-600 text-white shadow-sm font-semibold"
                : "bg-slate-100 hover:bg-slate-200 dark:bg-white/5 text-slate-700 dark:text-white/60 dark:hover:text-white border border-slate-200 dark:border-white/10"
            }`}
          >
            Undangan Brand ({inboundInvites.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("applications")}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all min-h-[44px] ${
              activeTab === "applications"
                ? "bg-blue-600 text-white shadow-sm font-semibold"
                : "bg-slate-100 hover:bg-slate-200 dark:bg-white/5 text-slate-700 dark:text-white/60 dark:hover:text-white border border-slate-200 dark:border-white/10"
            }`}
          >
            Lamaran Terkirim ({myApplications.length})
          </button>
        </div>

        <Link
          href={`/${locale}/campaigns/explore`}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/15 text-xs font-semibold text-blue-700 dark:text-blue-400 border border-blue-500/20 transition-colors self-start sm:self-auto min-h-[44px]"
        >
          <Megaphone size={14} />
          <span>Jelajahi Campaign Terbuka</span>
          <span>→</span>
        </Link>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {activeList.length === 0 ? (
        <div className="bg-white dark:bg-[#0e1424]/60 border border-slate-200/90 dark:border-white/10 rounded-2xl p-8 sm:p-12 text-center max-w-md mx-auto space-y-3 my-8 shadow-sm">
          <Clock className="w-10 h-10 text-slate-400 dark:text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {activeTab === "invitations"
              ? t("noCreatorInvites")
              : "Belum ada lamaran yang diajukan"}
          </h3>
          <p className="text-xs text-slate-600 dark:text-white/50 leading-relaxed">
            {activeTab === "invitations"
              ? "Undangan langsung dari brand yang tertarik dengan portofolio Anda akan muncul di sini."
              : "Anda dapat mencari proyek konten yang sedang membuka lowongan dan melamar secara langsung."}
          </p>
          {activeTab === "applications" && (
            <div className="pt-2">
              <Link
                href={`/${locale}/campaigns/explore`}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition-colors min-h-[44px]"
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
                className="bg-white dark:bg-[#0e1424] border border-slate-200/90 dark:border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:border-blue-500/30 transition-all"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {inv.campaign_title || "Campaign"}
                    </h3>
                    <div>
                      {inv.status === "selected" && (
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-500/10 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30">
                          ★ {t("selectedBadge")}
                        </span>
                      )}
                      {inv.status === "accepted" && (
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                          ✓ {t("acceptedBadge")}
                        </span>
                      )}
                      {inv.status === "declined" && (
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-slate-100 dark:bg-slate-700/30 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600/30">
                          ✕ {t("declinedBadge")}
                        </span>
                      )}
                      {inv.status === "rejected" && (
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-red-500/10 dark:bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30">
                          ✕ Tidak Terpilih
                        </span>
                      )}
                      {inv.status === "applied" && (
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-500/10 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30">
                          ⏳ Lamaran Dikirim (Menunggu Review)
                        </span>
                      )}
                      {inv.status === "invited" && (
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-amber-500/10 dark:bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-500/30">
                          ⏳ {t("invitedBadge")}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                    {budgetFormatted && (
                      <span>
                        Tawaran / Fee:{" "}
                        <strong className="text-slate-900 dark:text-slate-200">
                          {budgetFormatted}
                        </strong>
                      </span>
                    )}
                    {inv.created_at && (
                      <span>
                        Tanggal:{" "}
                        {new Intl.DateTimeFormat(locale, {
                          dateStyle: "medium",
                        }).format(new Date(inv.created_at))}
                      </span>
                    )}
                  </div>

                  {inv.pitch && (
                    <div className="mt-2 p-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 rounded-xl text-xs text-slate-700 dark:text-slate-300">
                      <span className="text-slate-500 dark:text-slate-400 font-semibold block mb-0.5">
                        Pesan Anda:
                      </span>
                      {inv.pitch}
                    </div>
                  )}
                </div>

                {isInvited && (
                  <div className="flex items-center gap-2 pt-2 md:pt-0 shrink-0">
                    <button
                      type="button"
                      disabled={isResponding}
                      onClick={() => handleRespond(inv, "decline")}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 border border-slate-200 dark:border-white/10 transition-colors disabled:opacity-50 min-h-[44px]"
                    >
                      {isResponding ? "..." : t("declineInvitation")}
                    </button>
                    <button
                      type="button"
                      disabled={isResponding}
                      onClick={() => {
                        setActiveModalInvite(inv);
                        setPitch("");
                        setProposedRate("");
                      }}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all disabled:opacity-50 min-h-[44px]"
                    >
                      {t("acceptInvitation")}
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setActiveModalInvite(null)}
          />
          <div className="relative w-full max-w-lg bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-6 space-y-5 z-10 transition-colors">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t("acceptInvitation")}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {activeModalInvite.campaign_title || "Campaign Invitation"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalInvite(null)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-400 mb-1.5">
                  {t("pitch")}
                </label>
                <textarea
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0e1424] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#0e1424] resize-none transition-all"
                  rows={4}
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value)}
                  placeholder={t("pitchPlaceholder")}
                  maxLength={2000}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-400 mb-1.5">
                  {t("proposedRate")} ({activeModalInvite.campaign_currency || "IDR"})
                </label>
                <input
                  type="number"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0e1424] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#0e1424] transition-all min-h-[44px]"
                  value={proposedRate}
                  onChange={(e) => setProposedRate(e.target.value)}
                  placeholder={t("ratePlaceholder")}
                  min="0"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => setActiveModalInvite(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-white/5 text-slate-700 dark:text-white/60 dark:hover:text-white border border-slate-200 dark:border-white/10 transition-colors min-h-[44px]"
              >
                {t("prevStep")}
              </button>
              <button
                type="button"
                disabled={respondingID === activeModalInvite.id}
                onClick={() => handleRespond(activeModalInvite, "accept")}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 min-h-[44px]"
              >
                {respondingID === activeModalInvite.id && <LoaderCircle className="animate-spin" size={14} />}
                <span>{respondingID === activeModalInvite.id ? t("accepting") : t("acceptInvitation")}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

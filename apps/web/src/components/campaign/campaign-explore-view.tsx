"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  Calendar,
  DollarSign,
  Filter,
  Layers,
  Megaphone,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";
import { applyCampaign } from "@/lib/campaign-client";
import type { Campaign } from "@/lib/campaign-types";

type CampaignExploreViewProps = {
  initialCampaigns: Campaign[];
  locale: string;
  isCreator: boolean;
  isLoggedIn: boolean;
};

export function CampaignExploreView({
  initialCampaigns,
  locale,
  isCreator,
  isLoggedIn,
}: CampaignExploreViewProps) {
  const [campaigns] = useState<Campaign[]>(initialCampaigns);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [applyingCampaign, setApplyingCampaign] = useState<Campaign | null>(null);
  const [pitchNote, setPitchNote] = useState("");
  const [proposedFee, setProposedFee] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const formatCurrency = (minor: number, curr: string) => {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: curr,
      maximumFractionDigits: curr === "IDR" ? 0 : 2,
    }).format(minor / (curr === "IDR" ? 1 : 100));
  };

  const filteredCampaigns = campaigns.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat =
      selectedCategory === "all" ||
      c.requirements.some(
        (r) =>
          r.category_name?.toLowerCase() === selectedCategory.toLowerCase(),
      );
    return matchesSearch && matchesCat;
  });

  const categories = Array.from(
    new Set(
      campaigns.flatMap((c) =>
        c.requirements
          .map((r) => r.category_name)
          .filter((name): name is string => Boolean(name)),
      ),
    ),
  );

  const openApplyModal = (camp: Campaign) => {
    setApplyingCampaign(camp);
    setPitchNote("");
    setProposedFee(
      camp.currency === "IDR"
        ? String(camp.budget_minor)
        : String(camp.budget_minor / 100),
    );
    setSubmitSuccess(null);
    setSubmitError(null);
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyingCampaign) return;

    if (!pitchNote.trim()) {
      setSubmitError("Silakan tuliskan pitch note / pesan lamaran Anda.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const feeNum = Number(proposedFee);
      const feeMinor =
        applyingCampaign.currency === "IDR"
          ? Math.round(feeNum)
          : Math.round(feeNum * 100);

      await applyCampaign(applyingCampaign.id, {
        pitch_note: pitchNote.trim(),
        proposed_fee_minor: feeMinor > 0 ? feeMinor : applyingCampaign.budget_minor,
        currency: applyingCampaign.currency,
      });

      setSubmitSuccess(applyingCampaign.id);
      setTimeout(() => {
        setApplyingCampaign(null);
      }, 2000);
    } catch (err: unknown) {
      const errObj = err as { code?: string; message?: string };
      if (errObj.code === "duplicate_invitation" || errObj.code === "already_applied") {
        setSubmitError("Anda sudah pernah melamar atau diundang ke campaign ini.");
      } else {
        setSubmitError(
          errObj.message || "Gagal mengirimkan lamaran. Silakan coba lagi.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 pb-16 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-slate-50 to-blue-50/30 dark:from-[#0e1424] dark:via-[#10182c] dark:to-[#0a0e1a] border border-slate-200/90 dark:border-white/10 p-8 sm:p-10 shadow-sm transition-colors">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-600 dark:text-blue-400">
            <Megaphone size={14} />
            <span>Open Brand Campaigns · Casting Call</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Eksplorasi Campaign Terbuka
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-white/60 leading-relaxed">
            Temukan campaign brand terverifikasi, pelajari kebutuhan konten & brief kreatif, dan ajukan proposal langsung dengan rate Anda.
          </p>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40 w-4 h-4" />
          <input
            type="text"
            placeholder="Cari campaign, brand, atau topik..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-[#0e1424] border border-slate-200/90 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 focus:outline-none focus:border-blue-500 shadow-sm min-h-[44px]"
          />
        </div>

        {categories.length > 0 && (
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            <Filter size={14} className="text-slate-400 dark:text-white/40 shrink-0" />
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors min-h-[38px] ${
                selectedCategory === "all"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white dark:bg-white/5 text-slate-700 dark:text-white/60 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/10"
              }`}
            >
              Semua Kategori
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors min-h-[38px] ${
                  selectedCategory === cat
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white dark:bg-white/5 text-slate-700 dark:text-white/60 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/10"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Campaigns Grid */}
      {filteredCampaigns.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/90 dark:border-white/10 bg-white dark:bg-[#0e1424]/40 p-12 text-center space-y-3 shadow-sm">
          <Briefcase className="w-10 h-10 text-slate-400 dark:text-white/30 mx-auto" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Belum ada campaign terbuka yang cocok
          </h3>
          <p className="text-sm text-slate-500 dark:text-white/50 max-w-sm mx-auto">
            Coba ubah kata kunci pencarian atau bersihkan filter kategori Anda.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCampaigns.map((camp) => {
            const hasApplied = submitSuccess === camp.id;

            return (
              <div
                key={camp.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 dark:border-white/10 bg-white dark:bg-[#0e1424] p-6 hover:border-blue-500/40 hover:shadow-lg transition-all duration-200 shadow-sm"
              >
                <div className="space-y-4">
                  {/* Top tags */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                      Terbuka Melamar
                    </span>
                    <span className="text-xs text-slate-500 dark:text-white/40 font-mono">
                      {new Date(camp.created_at).toLocaleDateString(locale)}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                      {camp.title}
                    </h3>
                    {camp.client_name && (
                      <p className="text-xs text-slate-500 dark:text-white/50 font-medium mt-0.5">
                        Oleh: {camp.client_name}
                      </p>
                    )}
                    <p className="text-xs text-slate-600 dark:text-white/60 leading-relaxed mt-2.5 line-clamp-3">
                      {camp.description}
                    </p>
                  </div>

                  {/* Requirements Deliverables Pill */}
                  {camp.requirements.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {camp.requirements.map((r, i) => (
                        <span
                          key={r.id || i}
                          className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/[0.04] text-slate-700 dark:text-white/70 border border-slate-200 dark:border-white/5"
                        >
                          <Layers size={11} className="text-blue-500 dark:text-blue-400" />
                          <span>
                            {r.deliverable_type} (x{r.quantity})
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom Meta & Action */}
                <div className="pt-5 mt-5 border-t border-slate-100 dark:border-white/10 space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 dark:text-white/40 block">Alokasi Budget</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-0.5 mt-0.5 font-mono">
                        <DollarSign size={13} className="text-emerald-600 dark:text-emerald-400" />
                        {formatCurrency(camp.budget_minor, camp.currency)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-white/40 block">Batas Waktu</span>
                      <span className="text-xs font-medium text-slate-700 dark:text-white/80 flex items-center gap-1 mt-1">
                        <Calendar size={13} className="text-slate-400" />
                        {new Date(camp.deadline).toLocaleDateString(locale)}
                      </span>
                    </div>
                  </div>

                  {/* Apply Button Flow */}
                  <div>
                    {!isLoggedIn ? (
                      <Link
                        href={`/${locale}/auth/login?redirect=/${locale}/campaigns/explore`}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-xs font-semibold text-slate-800 dark:text-white transition-colors min-h-[44px]"
                      >
                        <Users size={14} />
                        <span>Masuk untuk Melamar</span>
                      </Link>
                    ) : isCreator ? (
                      <button
                        type="button"
                        onClick={() => openApplyModal(camp)}
                        disabled={hasApplied}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                          hasApplied
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                            : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                        }`}
                      >
                        {hasApplied ? (
                          <>✓ Lamaran Terkirim</>
                        ) : (
                          <>
                            <Send size={13} />
                            <span>Ajukan Lamaran / Apply</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="block text-center text-xs text-slate-500 dark:text-white/40 py-2">
                        Akun Brand (Hanya Creator yang dapat melamar)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Application Modal */}
      {applyingCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#0e1424] border border-slate-200 dark:border-white/10 p-6 sm:p-8 space-y-6 shadow-2xl relative transition-colors">
            <button
              type="button"
              onClick={() => setApplyingCampaign(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
            >
              <X size={20} />
            </button>

            <div>
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                Lamaran Campaign
              </span>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                {applyingCampaign.title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-white/50 mt-1">
                Budget Client: {formatCurrency(applyingCampaign.budget_minor, applyingCampaign.currency)}
              </p>
            </div>

            {submitError && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs">
                {submitError}
              </div>
            )}

            {submitSuccess && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs text-center font-medium">
                ✓ Lamaran Anda berhasil dikirim ke Brand! Anda dapat memantau statusnya di dashboard creator.
              </div>
            )}

            {!submitSuccess && (
              <form onSubmit={handleApply} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-white/80 mb-1.5">
                    Tawaran Fee / Rate Anda ({applyingCampaign.currency}) *
                  </label>
                  <input
                    type="number"
                    value={proposedFee}
                    onChange={(e) => setProposedFee(e.target.value)}
                    required
                    min="1"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 min-h-[44px]"
                  />
                  <span className="text-[11px] text-slate-500 dark:text-white/40 mt-1 block">
                    Anda dapat menerima budget klien atau mengajukan fee yang sesuai dengan scope produksi Anda.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-white/80 mb-1.5">
                    Pitch Note / Pesan Pengajuan *
                  </label>
                  <textarea
                    value={pitchNote}
                    onChange={(e) => setPitchNote(e.target.value)}
                    required
                    rows={4}
                    placeholder="Jelaskan konsep ide konten, keunikan audience Anda, atau link sampel portofolio relevan..."
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setApplyingCampaign(null)}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white rounded-xl min-h-[44px]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-sm disabled:opacity-50 min-h-[44px]"
                  >
                    {isSubmitting ? "Mengirim..." : "Kirim Lamaran"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import {
  User,
  Share2,
  Briefcase,
  BadgeCheck,
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  Plus,
  Trash2,
  ExternalLink,
  Save,
  LogOut,
  Languages,
  Bell,
  Send,
} from "lucide-react";
import { authRequest, normalizeAuthErrorCode, type ApiError } from "@/lib/auth-client";
import { creatorRequest, normalizeCreatorErrorCode } from "@/lib/creator-client";
import type {
  ApiEnvelope,
  CreatorCatalog,
  CreatorProfile,
  PortfolioItem,
  SocialAccount,
} from "@/lib/creator-types";
import { NotificationSettingsForm } from "@/components/communication/notification-settings-form";
import type { NotificationPreferences } from "@/lib/communication-types";

type SettingTab = "account" | "profile" | "social" | "portfolio";

const emptySocial = (): SocialAccount => ({
  platform_code: "instagram",
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

interface UnifiedSettingsViewProps {
  user: {
    id: string;
    email: string;
    display_name: string;
    preferred_locale: string;
    roles: string[];
    permissions?: string[];
  };
  initialNotificationPreferences: NotificationPreferences | null;
  notificationLabels: {
    title: string;
    subtitle: string;
    emailNotifications: string;
    emailNotificationsDesc: string;
    orderUpdates: string;
    orderUpdatesDesc: string;
    messages: string;
    messagesDesc: string;
    save: string;
    saving: string;
    saved: string;
    saveError: string;
  };
}

export function UnifiedSettingsView({
  user,
  initialNotificationPreferences,
  notificationLabels,
}: UnifiedSettingsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const authT = useTranslations("Auth");
  const creatorT = useTranslations("CreatorOnboarding");

  const isCreator = user.roles.includes("creator");
  const requestedTab = searchParams.get("tab") as SettingTab | null;

  const activeTab: SettingTab =
    isCreator && requestedTab && ["profile", "social", "portfolio"].includes(requestedTab)
      ? requestedTab
      : "account";

  const handleTabChange = (tab: SettingTab) => {
    router.replace(`/${locale}/settings?tab=${tab}`, { scroll: false });
  };

  // --- Account & Preferences State ---
  const [preferredLocale, setPreferredLocale] = useState(user.preferred_locale || locale);
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountSuccess, setAccountSuccess] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [logoutPending, setLogoutPending] = useState(false);

  // --- Creator Profile State ---
  const [profile, setProfile] = useState<CreatorProfile>(emptyProfile);
  const [catalog, setCatalog] = useState<CreatorCatalog>({ platforms: [], categories: [] });
  const [loadingCreator, setLoadingCreator] = useState(isCreator);
  const [savingCreator, setSavingCreator] = useState(false);
  const [creatorSuccess, setCreatorSuccess] = useState(false);
  const [creatorError, setCreatorError] = useState<string | null>(null);
  const [submittingVerification, setSubmittingVerification] = useState(false);

  // Load Creator Data if applicable
  useEffect(() => {
    if (!isCreator) return;
    let active = true;

    Promise.all([
      creatorRequest<ApiEnvelope<CreatorProfile>>(`onboarding?locale=${locale}`),
      creatorRequest<ApiEnvelope<CreatorCatalog>>(`catalog?locale=${locale}`),
    ])
      .then(([profileRes, catalogRes]) => {
        if (!active) return;
        setProfile(profileRes.data);
        setCatalog(catalogRes.data);
      })
      .catch((caught: ApiError) => {
        if (!active) return;
        setCreatorError(caught.message || creatorT(`errors.${normalizeCreatorErrorCode(caught.code)}`));
      })
      .finally(() => {
        if (active) setLoadingCreator(false);
      });

    return () => {
      active = false;
    };
  }, [isCreator, locale, creatorT]);

  // Account Preferences Submit
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAccount(true);
    setAccountSuccess(false);
    setAccountError(null);

    try {
      await authRequest("settings", {
        method: "PATCH",
        body: JSON.stringify({ preferred_locale: preferredLocale }),
      });
      setAccountSuccess(true);
      if (preferredLocale !== locale) {
        router.replace(`/${preferredLocale}/settings?tab=account`);
      }
    } catch (caught) {
      const err = caught as ApiError;
      setAccountError(authT(`errors.${normalizeAuthErrorCode(err.code)}`));
    } finally {
      setSavingAccount(false);
    }
  };

  const handleLogout = async () => {
    setLogoutPending(true);
    try {
      await authRequest("logout", { method: "POST" });
      router.replace(`/${locale}`);
      router.refresh();
    } catch {
      setLogoutPending(false);
    }
  };

  // Creator Mutators
  const updateProfileField = <K extends keyof CreatorProfile>(key: K, value: CreatorProfile[K]) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
    setCreatorSuccess(false);
  };

  const updateSocialItem = (index: number, patch: Partial<SocialAccount>) => {
    setProfile((prev) => ({
      ...prev,
      social_accounts: prev.social_accounts.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
    setCreatorSuccess(false);
  };

  const removeSocialItem = (index: number) => {
    setProfile((prev) => ({
      ...prev,
      social_accounts: prev.social_accounts.filter((_, i) => i !== index),
    }));
    setCreatorSuccess(false);
  };

  const addSocialItem = () => {
    setProfile((prev) => ({
      ...prev,
      social_accounts: [...prev.social_accounts, emptySocial()],
    }));
    setCreatorSuccess(false);
  };

  const updatePortfolioItem = (index: number, patch: Partial<PortfolioItem>) => {
    setProfile((prev) => ({
      ...prev,
      portfolio: prev.portfolio.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
    setCreatorSuccess(false);
  };

  const removePortfolioItem = (index: number) => {
    setProfile((prev) => ({
      ...prev,
      portfolio: prev.portfolio.filter((_, i) => i !== index),
    }));
    setCreatorSuccess(false);
  };

  const addPortfolioItem = () => {
    setProfile((prev) => ({
      ...prev,
      portfolio: [...prev.portfolio, emptyPortfolio()],
    }));
    setCreatorSuccess(false);
  };

  // Save Creator Changes (Profile, Social Accounts, or Portfolio)
  const handleSaveCreatorData = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingCreator(true);
    setCreatorSuccess(false);
    setCreatorError(null);

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
      setCreatorSuccess(true);
    } catch (caught) {
      const err = caught as ApiError;
      setCreatorError(err.message || creatorT(`errors.${normalizeCreatorErrorCode(err.code)}`));
    } finally {
      setSavingCreator(false);
    }
  };

  // Submit Verification to Agency
  const handleSubmitVerification = async () => {
    setSubmittingVerification(true);
    setCreatorError(null);
    try {
      const response = await creatorRequest<ApiEnvelope<CreatorProfile>>(
        `submit?locale=${locale}`,
        { method: "POST" },
      );
      setProfile(response.data);
      setCreatorSuccess(true);
    } catch (caught) {
      const err = caught as ApiError;
      setCreatorError(err.message || creatorT(`errors.${normalizeCreatorErrorCode(err.code)}`));
    } finally {
      setSubmittingVerification(false);
    }
  };

  const statusColorMap: Record<string, { bg: string; text: string; border: string }> = {
    verified: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
    under_review: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
    submitted: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
    revision_required: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
    rejected: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
    draft: { bg: "bg-white/5", text: "text-white/60", border: "border-white/10" },
  };

  const currentStatusStyle = statusColorMap[profile.verification_status] || statusColorMap.draft;

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Page Title & Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {authT("settingsTitle")}
          </h1>
          <p className="text-sm text-white/60 mt-1">
            {authT("settingsBody")}
          </p>
        </div>

        {isCreator && profile.slug && profile.verification_status === "verified" && (
          <Link
            href={`/${locale}/creators/${profile.slug}`}
            target="_blank"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors self-start sm:self-auto"
          >
            <span>{creatorT("viewPublic")}</span>
            <ExternalLink size={14} className="text-white/60" />
          </Link>
        )}
      </div>

      {/* Modern Tabs Navigation */}
      <nav
        aria-label="Settings Tabs"
        className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/[0.03] border border-white/10 overflow-x-auto custom-scrollbar"
      >
        <button
          type="button"
          onClick={() => handleTabChange("account")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
            activeTab === "account"
              ? "bg-blue-600 text-white shadow-md font-semibold"
              : "text-white/60 hover:text-white hover:bg-white/[0.04]"
          }`}
        >
          <User size={16} aria-hidden="true" />
          <span>{authT("tabAccount")}</span>
        </button>

        {isCreator && (
          <>
            <button
              type="button"
              onClick={() => handleTabChange("profile")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === "profile"
                  ? "bg-blue-600 text-white shadow-md font-semibold"
                  : "text-white/60 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <BadgeCheck size={16} aria-hidden="true" />
              <span>{authT("tabProfile")}</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("social")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === "social"
                  ? "bg-blue-600 text-white shadow-md font-semibold"
                  : "text-white/60 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <Share2 size={16} aria-hidden="true" />
              <span>{authT("tabSocial")}</span>
              {profile.social_accounts.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-md text-[11px] bg-white/20 text-white font-mono">
                  {profile.social_accounts.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("portfolio")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === "portfolio"
                  ? "bg-blue-600 text-white shadow-md font-semibold"
                  : "text-white/60 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <Briefcase size={16} aria-hidden="true" />
              <span>{authT("tabPortfolio")}</span>
              {profile.portfolio.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-md text-[11px] bg-white/20 text-white font-mono">
                  {profile.portfolio.length}
                </span>
              )}
            </button>
          </>
        )}
      </nav>

      {/* Global Status Feedback Messages */}
      {creatorSuccess && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm animate-in fade-in">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{creatorT("saved")}</span>
        </div>
      )}

      {creatorError && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-in fade-in">
          <AlertCircle size={18} className="shrink-0" />
          <span>{creatorError}</span>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: AKUN & PREFERENSI (User Account & General Settings)     */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "account" && (
        <div className="space-y-6">
          {/* User Profile Summary Card */}
          <div className="p-6 sm:p-8 rounded-2xl bg-[#0d121f]/90 border border-white/10 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <User size={18} className="text-blue-400" />
              <span>{authT("accountSummary")}</span>
            </h2>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pb-6 border-b border-white/10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-2xl shadow-lg shadow-blue-500/20">
                {user.display_name ? user.display_name.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-white">{user.display_name}</h3>
                <p className="text-sm text-white/60">{user.email}</p>
                <div className="flex flex-wrap gap-2 pt-2">
                  {user.roles.map((r) => (
                    <span
                      key={r}
                      className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wider"
                    >
                      {r}
                    </span>
                  ))}
                  {user.permissions && user.permissions.length > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/5 text-white/50 border border-white/10">
                      {user.permissions.length} {authT("permissionLabel")}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Language Preference Form */}
            <form onSubmit={handleSaveAccount} className="pt-6 space-y-5">
              {accountSuccess && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
                  <CheckCircle2 size={16} />
                  <span>{authT("settingsSaved")}</span>
                </div>
              )}
              {accountError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <AlertCircle size={16} />
                  <span>{accountError}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Languages size={15} className="text-blue-400" />
                  <span>{authT("languageLabel")}</span>
                </label>
                <p className="text-xs text-white/50 mb-3">{authT("languageBody")}</p>
                <div className="max-w-md">
                  <select
                    value={preferredLocale}
                    onChange={(e) => setPreferredLocale(e.target.value)}
                    className="w-full bg-[#121827] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  >
                    <option value="id">Bahasa Indonesia</option>
                    <option value="en">English (US)</option>
                    <option value="ms">Bahasa Melayu</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={savingAccount || logoutPending}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2 shadow-md shadow-blue-600/20 transition-all disabled:opacity-50"
                >
                  {savingAccount ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  <span>{savingAccount ? authT("saving") : authT("saveSettings")}</span>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={savingAccount || logoutPending}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-red-400/80 hover:text-red-400 hover:bg-red-500/10 border border-red-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {logoutPending ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : (
                    <LogOut size={16} />
                  )}
                  <span>{logoutPending ? authT("loggingOut") : authT("logoutAction")}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Notifications Settings Card */}
          <div className="p-6 sm:p-8 rounded-2xl bg-[#0d121f]/90 border border-white/10 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Bell size={18} className="text-blue-400" />
              <span>{notificationLabels.title}</span>
            </h2>
            <NotificationSettingsForm
              initialPreferences={initialNotificationPreferences}
              labels={notificationLabels}
            />
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: PROFIL KREATOR (Creator Profile & Bio)                  */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "profile" && isCreator && (
        <div className="space-y-6">
          {loadingCreator ? (
            <div className="p-12 text-center text-white/50 flex flex-col items-center justify-center gap-3">
              <LoaderCircle size={28} className="animate-spin text-blue-400" />
              <p className="text-sm">{creatorT("loading")}</p>
            </div>
          ) : (
            <>
              {/* Verification Status Card */}
              <div
                className={`p-6 rounded-2xl border ${currentStatusStyle.border} ${currentStatusStyle.bg} flex flex-col sm:flex-row sm:items-center justify-between gap-5 transition-all`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${currentStatusStyle.bg} border ${currentStatusStyle.border}`}
                  >
                    <BadgeCheck size={26} className={currentStatusStyle.text} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase font-mono font-bold text-white/40">Status:</span>
                      <span className={`text-sm font-bold uppercase tracking-wider ${currentStatusStyle.text}`}>
                        {creatorT(`statuses.${profile.verification_status}`)}
                      </span>
                    </div>
                    <p className="text-sm text-white/70">
                      {creatorT(`statusHelp.${profile.verification_status}`)}
                    </p>
                    {profile.review_note && (
                      <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                        <strong className="block mb-0.5">{creatorT("reviewNote")}:</strong>
                        <span>{profile.review_note}</span>
                      </div>
                    )}
                  </div>
                </div>

                {["draft", "revision_required", "rejected"].includes(profile.verification_status) && (
                  <button
                    type="button"
                    onClick={handleSubmitVerification}
                    disabled={submittingVerification || savingCreator}
                    className="self-start sm:self-center px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 whitespace-nowrap"
                  >
                    {submittingVerification ? (
                      <LoaderCircle size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                    <span>{submittingVerification ? creatorT("submitting") : creatorT("submit")}</span>
                  </button>
                )}
              </div>

              {/* Creator Main Details Form */}
              <form onSubmit={handleSaveCreatorData} className="space-y-6">
                <div className="p-6 sm:p-8 rounded-2xl bg-[#0d121f]/90 border border-white/10 space-y-6">
                  <div className="border-b border-white/10 pb-4">
                    <h2 className="text-lg font-bold text-white">{creatorT("profileTitle")}</h2>
                    <p className="text-xs text-white/50 mt-1">{creatorT("profileBody")}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Slug / Public URL */}
                    <div>
                      <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 block">
                        {creatorT("slugLabel")}
                      </label>
                      <div className="flex items-center bg-white/[0.04] border border-white/10 rounded-xl overflow-hidden focus-within:border-blue-500 transition-all">
                        <span className="px-3 text-xs text-white/40 font-mono select-none">/creators/</span>
                        <input
                          type="text"
                          required
                          value={profile.slug}
                          onChange={(e) => updateProfileField("slug", e.target.value)}
                          placeholder="username-anda"
                          className="w-full bg-transparent py-3 pr-4 text-white text-sm focus:outline-none"
                        />
                      </div>
                      <p className="text-[11px] text-white/40 mt-1.5">{creatorT("slugHelp")}</p>
                    </div>

                    {/* Headline */}
                    <div>
                      <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 block">
                        {creatorT("headlineLabel")}
                      </label>
                      <input
                        type="text"
                        required
                        value={profile.headline}
                        onChange={(e) => updateProfileField("headline", e.target.value)}
                        placeholder="Contoh: Tech Reviewer & Short-form Video Specialist"
                        className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-500 transition-all"
                      />
                    </div>
                  </div>

                  {/* Bio */}
                  <div>
                    <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 block">
                      {creatorT("bioLabel")}
                    </label>
                    <textarea
                      rows={4}
                      required
                      value={profile.bio}
                      onChange={(e) => updateProfileField("bio", e.target.value)}
                      placeholder={creatorT("bioHelp")}
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-500 transition-all resize-y"
                    />
                  </div>

                  {/* Location (City & Country) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 block">
                        {creatorT("cityLabel")}
                      </label>
                      <input
                        type="text"
                        required
                        value={profile.city}
                        onChange={(e) => updateProfileField("city", e.target.value)}
                        placeholder="Jakarta / Kuala Lumpur / etc."
                        className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-500 transition-all"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 block">
                        {creatorT("countryLabel")}
                      </label>
                      <select
                        value={profile.country_code}
                        onChange={(e) => updateProfileField("country_code", e.target.value)}
                        className="w-full bg-[#121827] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                      >
                        <option value="ID">{creatorT("countries.ID")}</option>
                        <option value="MY">{creatorT("countries.MY")}</option>
                        <option value="SG">{creatorT("countries.SG")}</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Categories & Working Languages */}
                <div className="p-6 sm:p-8 rounded-2xl bg-[#0d121f]/90 border border-white/10 space-y-6">
                  <div className="border-b border-white/10 pb-4">
                    <h2 className="text-lg font-bold text-white">{creatorT("fitTitle")}</h2>
                    <p className="text-xs text-white/50 mt-1">{creatorT("fitBody")}</p>
                  </div>

                  {/* Categories Chips */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                        {creatorT("categoriesLabel")}
                      </span>
                      <span className="text-xs font-mono text-blue-400">
                        ({profile.categories.length}/5)
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2.5">
                      {catalog.categories.map((cat) => {
                        const isSelected = profile.categories.some((c) => c.code === cat.code);
                        return (
                          <button
                            type="button"
                            key={cat.code}
                            onClick={() => {
                              if (isSelected) {
                                updateProfileField(
                                  "categories",
                                  profile.categories.filter((c) => c.code !== cat.code),
                                );
                              } else {
                                if (profile.categories.length >= 5) return;
                                updateProfileField("categories", [...profile.categories, cat]);
                              }
                            }}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                              isSelected
                                ? "bg-blue-600 text-white shadow-sm font-semibold border border-blue-400/30"
                                : "bg-white/[0.04] text-white/60 hover:text-white hover:bg-white/[0.08] border border-white/10"
                            }`}
                          >
                            {cat.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Languages Checkboxes */}
                  <div>
                    <span className="text-xs font-semibold text-white/70 uppercase tracking-wider block mb-3">
                      {creatorT("languagesLabel")}
                    </span>
                    <div className="flex flex-wrap gap-4">
                      {(["id", "en", "ms"] as const).map((lang) => {
                        const checked = profile.languages.includes(lang);
                        return (
                          <label
                            key={lang}
                            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border cursor-pointer transition-all ${
                              checked
                                ? "bg-blue-600/10 border-blue-500/40 text-blue-300"
                                : "bg-white/[0.02] border-white/10 text-white/60 hover:text-white"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                updateProfileField(
                                  "languages",
                                  e.target.checked
                                    ? [...profile.languages, lang]
                                    : profile.languages.filter((l) => l !== lang),
                                );
                              }}
                              className="rounded border-white/20 bg-white/5 text-blue-600 focus:ring-0"
                            />
                            <span className="text-xs font-medium">{creatorT(`languages.${lang}`)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Save Profile Button */}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingCreator}
                    className="px-6 py-3 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50"
                  >
                    {savingCreator ? (
                      <LoaderCircle size={16} className="animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    <span>{savingCreator ? creatorT("saving") : creatorT("save")}</span>
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: MEDIA SOSIAL & FOLLOWER (Social Accounts & Audience)     */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "social" && isCreator && (
        <div className="space-y-6">
          {loadingCreator ? (
            <div className="p-12 text-center text-white/50 flex flex-col items-center justify-center gap-3">
              <LoaderCircle size={28} className="animate-spin text-blue-400" />
              <p className="text-sm">{creatorT("loading")}</p>
            </div>
          ) : (
            <form onSubmit={handleSaveCreatorData} className="space-y-6">
              {/* Header with CTA to Add Platform */}
              <div className="p-6 sm:p-8 rounded-2xl bg-[#0d121f]/90 border border-white/10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Share2 size={18} className="text-blue-400" />
                      <span>{creatorT("socialTitle")}</span>
                    </h2>
                    <p className="text-xs text-white/50 mt-1 max-w-xl">
                      {creatorT("socialBody")}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addSocialItem}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2 self-start sm:self-auto shadow-md shadow-blue-600/20 transition-all"
                  >
                    <Plus size={16} />
                    <span>{creatorT("addSocial")}</span>
                  </button>
                </div>
              </div>

              {/* Empty State */}
              {profile.social_accounts.length === 0 ? (
                <div className="p-12 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] text-center space-y-4">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40">
                    <Share2 size={24} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-white">Belum ada akun media sosial</h3>
                    <p className="text-xs text-white/50 max-w-sm mx-auto">
                      {creatorT("socialEmpty")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addSocialItem}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-colors"
                  >
                    <Plus size={14} />
                    <span>{creatorT("addSocial")}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {profile.social_accounts.map((account, index) => {
                    const platformMeta = catalog.platforms.find((p) => p.code === account.platform_code);

                    return (
                      <div
                        key={`${account.platform_code}-${index}`}
                        className="p-6 rounded-2xl bg-[#0d121f]/90 border border-white/10 space-y-5 transition-all hover:border-white/20"
                      >
                        {/* Account Card Header */}
                        <div className="flex items-center justify-between border-b border-white/10 pb-4">
                          <div className="flex items-center gap-3">
                            <span className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 font-mono text-xs font-bold flex items-center justify-center">
                              #{index + 1}
                            </span>
                            <span className="text-sm font-bold text-white capitalize">
                              {platformMeta?.name || account.platform_code || "Platform Baru"}
                            </span>
                            {account.handle && (
                              <span className="text-xs text-white/40 font-mono">
                                @{account.handle.replace(/^@/, "")}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => removeSocialItem(index)}
                            className="p-2 rounded-xl text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            aria-label={creatorT("removeSocial")}
                            title={creatorT("removeSocial")}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        {/* Account Fields Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                          {/* Platform Selector */}
                          <div>
                            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 block">
                              {creatorT("platformLabel")}
                            </label>
                            <select
                              required
                              value={account.platform_code}
                              onChange={(e) => updateSocialItem(index, { platform_code: e.target.value })}
                              className="w-full bg-[#121827] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-all capitalize"
                            >
                              <option value="">{creatorT("selectPlatform")}</option>
                              {catalog.platforms.map((p) => (
                                <option key={p.code} value={p.code}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Handle / Username */}
                          <div>
                            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 block">
                              {creatorT("handleLabel")}
                            </label>
                            <div className="flex items-center bg-white/[0.04] border border-white/10 rounded-xl overflow-hidden focus-within:border-blue-500 transition-all">
                              <span className="pl-3 text-xs text-white/40 font-mono">@</span>
                              <input
                                type="text"
                                required
                                value={account.handle.replace(/^@/, "")}
                                onChange={(e) => updateSocialItem(index, { handle: e.target.value })}
                                placeholder="username"
                                className="w-full bg-transparent py-2.5 pr-4 pl-1 text-white text-sm focus:outline-none"
                              />
                            </div>
                          </div>

                          {/* Profile URL */}
                          <div className="sm:col-span-2 lg:col-span-1">
                            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 block">
                              {creatorT("profileUrlLabel")}
                            </label>
                            <input
                              type="url"
                              required
                              value={account.profile_url}
                              onChange={(e) => updateSocialItem(index, { profile_url: e.target.value })}
                              placeholder="https://..."
                              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-500 transition-all"
                            />
                          </div>

                          {/* Follower Count */}
                          <div>
                            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 flex items-center justify-between">
                              <span>{creatorT("followersLabel")}</span>
                              {account.follower_count > 0 && (
                                <span className="font-mono text-[11px] text-blue-400 lowercase font-normal">
                                  {account.follower_count.toLocaleString(locale)} pengikut
                                </span>
                              )}
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min={0}
                                required
                                value={account.follower_count || ""}
                                onChange={(e) =>
                                  updateSocialItem(index, { follower_count: Number(e.target.value) || 0 })
                                }
                                placeholder="Contoh: 150000"
                                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-500 transition-all font-mono"
                              />
                            </div>
                          </div>

                          {/* Average Views */}
                          <div>
                            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 flex items-center justify-between">
                              <span>{creatorT("viewsLabel")}</span>
                              {account.average_views > 0 && (
                                <span className="font-mono text-[11px] text-white/40 lowercase font-normal">
                                  {account.average_views.toLocaleString(locale)} views
                                </span>
                              )}
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={account.average_views || ""}
                              onChange={(e) =>
                                updateSocialItem(index, { average_views: Number(e.target.value) || 0 })
                              }
                              placeholder="Contoh: 25000"
                              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-500 transition-all font-mono"
                            />
                          </div>

                          {/* Engagement Rate */}
                          <div>
                            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 flex items-center justify-between">
                              <span>{creatorT("engagementLabel")}</span>
                              {account.engagement_bps > 0 && (
                                <span className="font-mono text-[11px] text-emerald-400 font-normal">
                                  {(account.engagement_bps / 100).toFixed(2)}%
                                </span>
                              )}
                            </label>
                            <div className="relative flex items-center">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step="0.01"
                                value={account.engagement_bps ? account.engagement_bps / 100 : ""}
                                onChange={(e) =>
                                  updateSocialItem(index, {
                                    engagement_bps: Math.round((Number(e.target.value) || 0) * 100),
                                  })
                                }
                                placeholder="Contoh: 4.5"
                                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-500 transition-all font-mono pr-8"
                              />
                              <span className="absolute right-3 text-white/40 text-xs font-bold">%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Save Social Accounts Button */}
              {profile.social_accounts.length > 0 && (
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingCreator}
                    className="px-6 py-3 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50"
                  >
                    {savingCreator ? (
                      <LoaderCircle size={16} className="animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    <span>{savingCreator ? creatorT("saving") : creatorT("save")}</span>
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 4: PORTOFOLIO (Portfolio Showcase)                        */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "portfolio" && isCreator && (
        <div className="space-y-6">
          {loadingCreator ? (
            <div className="p-12 text-center text-white/50 flex flex-col items-center justify-center gap-3">
              <LoaderCircle size={28} className="animate-spin text-blue-400" />
              <p className="text-sm">{creatorT("loading")}</p>
            </div>
          ) : (
            <form onSubmit={handleSaveCreatorData} className="space-y-6">
              {/* Header with CTA to Add Portfolio Item */}
              <div className="p-6 sm:p-8 rounded-2xl bg-[#0d121f]/90 border border-white/10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Briefcase size={18} className="text-blue-400" />
                      <span>{creatorT("portfolioTitle")}</span>
                    </h2>
                    <p className="text-xs text-white/50 mt-1 max-w-xl">
                      {creatorT("portfolioBody")}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addPortfolioItem}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2 self-start sm:self-auto shadow-md shadow-blue-600/20 transition-all"
                  >
                    <Plus size={16} />
                    <span>{creatorT("addPortfolio")}</span>
                  </button>
                </div>
              </div>

              {/* Empty State */}
              {profile.portfolio.length === 0 ? (
                <div className="p-12 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] text-center space-y-4">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40">
                    <Briefcase size={24} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-white">Belum ada portofolio</h3>
                    <p className="text-xs text-white/50 max-w-sm mx-auto">
                      {creatorT("portfolioEmpty")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addPortfolioItem}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-colors"
                  >
                    <Plus size={14} />
                    <span>{creatorT("addPortfolio")}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {profile.portfolio.map((item, index) => (
                    <div
                      key={`${item.id ?? "new"}-${index}`}
                      className="p-6 rounded-2xl bg-[#0d121f]/90 border border-white/10 space-y-5 transition-all hover:border-white/20"
                    >
                      {/* Item Header */}
                      <div className="flex items-center justify-between border-b border-white/10 pb-4">
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 font-mono text-xs font-bold flex items-center justify-center">
                            #{index + 1}
                          </span>
                          <span className="text-sm font-bold text-white">
                            {item.title || "Karya Portofolio Baru"}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => removePortfolioItem(index)}
                          className="p-2 rounded-xl text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          aria-label={creatorT("removePortfolio")}
                          title={creatorT("removePortfolio")}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Item Fields */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                          <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 block">
                            {creatorT("portfolioTitleLabel")}
                          </label>
                          <input
                            type="text"
                            required
                            value={item.title}
                            onChange={(e) => updatePortfolioItem(index, { title: e.target.value })}
                            placeholder="Contoh: Video Kampanye Brand X di TikTok"
                            className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-500 transition-all"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 block">
                            {creatorT("mediaUrlLabel")}
                          </label>
                          <input
                            type="url"
                            required
                            value={item.media_url}
                            onChange={(e) => updatePortfolioItem(index, { media_url: e.target.value })}
                            placeholder="https://..."
                            className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-500 transition-all"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 block">
                            Thumbnail URL (Opsional)
                          </label>
                          <div className="flex gap-4 items-start">
                            <input
                              type="url"
                              value={item.thumbnail_url || ""}
                              onChange={(e) => updatePortfolioItem(index, { thumbnail_url: e.target.value })}
                              placeholder="https://.../thumbnail.jpg"
                              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-500 transition-all"
                            />
                            {item.thumbnail_url && (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={item.thumbnail_url}
                                alt="Thumbnail preview"
                                className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0 bg-white/5"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = "none";
                                }}
                              />
                            )}
                          </div>
                        </div>

                        <div className="md:col-span-2">
                          <label className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 block">
                            {creatorT("portfolioDescriptionLabel")}
                          </label>
                          <textarea
                            rows={3}
                            value={item.description}
                            onChange={(e) => updatePortfolioItem(index, { description: e.target.value })}
                            placeholder="Jelaskan peran Anda, format konten, dan hasil penayangan yang dicapai..."
                            className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-500 transition-all resize-y"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Save Portfolio Button */}
              {profile.portfolio.length > 0 && (
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingCreator}
                    className="px-6 py-3 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50"
                  >
                    {savingCreator ? (
                      <LoaderCircle size={16} className="animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    <span>{savingCreator ? creatorT("saving") : creatorT("save")}</span>
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      )}
    </div>
  );
}

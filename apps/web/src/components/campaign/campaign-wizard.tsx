"use client";

import { createCampaign } from "@/lib/campaign-client";
import type {
  CampaignRequirementInput,
  CreateCampaignInput,
} from "@/lib/campaign-types";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

type CatalogOption = {
  code: string;
  name: string;
};

type CampaignWizardProps = {
  catalog: {
    platforms: CatalogOption[];
    categories: CatalogOption[];
  };
  locale: string;
};

export function CampaignWizard({ catalog, locale }: CampaignWizardProps) {
  const t = useTranslations("Campaign");
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State - Step 1: General Details
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budgetDisplay, setBudgetDisplay] = useState("1000000");
  const [currency, setCurrency] = useState<"IDR" | "MYR" | "USD">("IDR");
  const [targetCreators, setTargetCreators] = useState(3);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [deadline, setDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  });

  // Form State - Step 2: Requirements
  const [requirements, setRequirements] = useState<CampaignRequirementInput[]>([
    {
      platform_id: "",
      category_id: "",
      min_followers: 10000,
      min_engagement_rate: 2.0,
      deliverable_type: "Instagram Reel",
      quantity: 1,
    },
  ]);

  const addRequirement = () => {
    setRequirements((prev) => [
      ...prev,
      {
        platform_id: "",
        category_id: "",
        min_followers: 5000,
        min_engagement_rate: 1.5,
        deliverable_type: "Video",
        quantity: 1,
      },
    ]);
  };

  const removeRequirement = (index: number) => {
    setRequirements((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRequirement = (
    index: number,
    field: keyof CampaignRequirementInput,
    value: unknown,
  ) => {
    setRequirements((prev) =>
      prev.map((req, i) => (i === index ? { ...req, [field]: value } : req)),
    );
  };

  const validateStep1 = () => {
    if (title.trim().length < 3) {
      setErrorMessage(t("namePlaceholder"));
      return false;
    }
    if (description.trim().length < 10) {
      setErrorMessage(t("descPlaceholder"));
      return false;
    }
    const b = Number(budgetDisplay);
    if (!b || b <= 0) {
      setErrorMessage("Please enter a valid budget.");
      return false;
    }
    if (targetCreators < 1) {
      setErrorMessage("Target creators must be at least 1.");
      return false;
    }
    if (!deadline) {
      setErrorMessage("Please select a deadline.");
      return false;
    }
    setErrorMessage(null);
    return true;
  };

  const handleNext = () => {
    if (step === 1) {
      if (validateStep1()) setStep(2);
    } else if (step === 2) {
      if (requirements.length === 0) {
        setErrorMessage("Please add at least one requirement.");
        return;
      }
      setErrorMessage(null);
      setStep(3);
    }
  };

  const handlePrev = () => {
    setErrorMessage(null);
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const budgetNum = Number(budgetDisplay);
      const budgetMinor =
        currency === "IDR"
          ? Math.round(budgetNum)
          : Math.round(budgetNum * 100);

      const deadlineIso = new Date(`${deadline}T23:59:59Z`).toISOString();

      const cleanedReqs: CampaignRequirementInput[] = requirements.map((r) => ({
        platform_id: r.platform_id ? r.platform_id : null,
        category_id: r.category_id ? r.category_id : null,
        min_followers: Number(r.min_followers) || 0,
        min_engagement_rate: Number(r.min_engagement_rate) || 0,
        deliverable_type: r.deliverable_type || "Deliverable",
        quantity: Number(r.quantity) || 1,
      }));

      const payload: CreateCampaignInput = {
        title: title.trim(),
        description: description.trim(),
        budget_minor: budgetMinor,
        currency,
        target_creators: Number(targetCreators),
        deadline: deadlineIso,
        visibility,
        requirements: cleanedReqs,
      };

      const campaign = await createCampaign(payload);
      router.push(`/${locale}/campaigns/${campaign.id}`);
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setErrorMessage(
        errObj.message || "Failed to create campaign. Please try again.",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="campaign-wizard">
      {/* Step Indicator */}
      <div className="campaign-wizard__steps" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={step === 1}
          className={`campaign-wizard__step-tab ${step === 1 ? "is-active" : ""} ${step > 1 ? "is-completed" : ""}`}
          onClick={() => {
            if (step > 1) setStep(1);
          }}
        >
          <span className="campaign-wizard__step-badge">1</span>
          <span className="campaign-wizard__step-title">{t("step1Title")}</span>
        </button>
        <span className="campaign-wizard__step-sep">→</span>
        <button
          type="button"
          role="tab"
          aria-selected={step === 2}
          className={`campaign-wizard__step-tab ${step === 2 ? "is-active" : ""} ${step > 2 ? "is-completed" : ""}`}
          onClick={() => {
            if (step > 2) setStep(2);
            else if (step === 1 && validateStep1()) setStep(2);
          }}
        >
          <span className="campaign-wizard__step-badge">2</span>
          <span className="campaign-wizard__step-title">{t("step2Title")}</span>
        </button>
        <span className="campaign-wizard__step-sep">→</span>
        <button
          type="button"
          role="tab"
          aria-selected={step === 3}
          className={`campaign-wizard__step-tab ${step === 3 ? "is-active" : ""}`}
        >
          <span className="campaign-wizard__step-badge">3</span>
          <span className="campaign-wizard__step-title">{t("step3Title")}</span>
        </button>
      </div>

      {errorMessage && (
        <div className="campaign-wizard__error" role="alert">
          {errorMessage}
        </div>
      )}

      {/* Step 1: Details */}
      {step === 1 && (
        <div className="campaign-wizard__content">
          <div className="campaign-form-group">
            <label htmlFor="camp-title" className="campaign-form-label">
              {t("nameLabel")} *
            </label>
            <input
              id="camp-title"
              type="text"
              className="campaign-form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("namePlaceholder")}
              maxLength={160}
              required
            />
          </div>

          <div className="campaign-form-group">
            <label htmlFor="camp-desc" className="campaign-form-label">
              {t("descLabel")} *
            </label>
            <textarea
              id="camp-desc"
              className="campaign-form-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descPlaceholder")}
              rows={5}
              maxLength={4000}
              required
            />
          </div>

          <div className="campaign-form-grid">
            <div className="campaign-form-group">
              <label htmlFor="camp-currency" className="campaign-form-label">
                {t("currencyLabel")}
              </label>
              <select
                id="camp-currency"
                className="campaign-form-select"
                value={currency}
                onChange={(e) =>
                  setCurrency(e.target.value as "IDR" | "MYR" | "USD")
                }
              >
                <option value="IDR">IDR (Rp)</option>
                <option value="MYR">MYR (RM)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>

            <div className="campaign-form-group">
              <label htmlFor="camp-budget" className="campaign-form-label">
                {t("budgetLabel")} *
              </label>
              <input
                id="camp-budget"
                type="number"
                className="campaign-form-input"
                value={budgetDisplay}
                onChange={(e) => setBudgetDisplay(e.target.value)}
                min="1"
                required
              />
            </div>
          </div>

          <div className="campaign-form-grid">
            <div className="campaign-form-group">
              <label htmlFor="camp-target" className="campaign-form-label">
                {t("targetCreatorsLabel")} *
              </label>
              <input
                id="camp-target"
                type="number"
                className="campaign-form-input"
                value={targetCreators}
                onChange={(e) =>
                  setTargetCreators(Math.max(1, Number(e.target.value)))
                }
                min="1"
                max="100"
                required
              />
            </div>

            <div className="campaign-form-group">
              <label htmlFor="camp-deadline" className="campaign-form-label">
                {t("deadlineLabel")} *
              </label>
              <input
                id="camp-deadline"
                type="date"
                className="campaign-form-input"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="campaign-form-group pt-2">
            <label className="campaign-form-label mb-2 block font-semibold text-slate-900 dark:text-white">
              Visibilitas Campaign
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setVisibility("public")}
                className={`p-4 rounded-xl border text-left transition-all min-h-[44px] cursor-pointer ${
                  visibility === "public"
                    ? "border-blue-500 bg-blue-500/10 dark:bg-blue-500/15 text-slate-900 dark:text-white ring-1 ring-blue-500"
                    : "border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] text-slate-700 dark:text-white/70 hover:border-blue-300 dark:hover:border-white/20"
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-sm text-slate-900 dark:text-white">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Publik (Terbuka untuk Pelamar)
                </div>
                <p className="text-xs text-slate-500 dark:text-white/50 mt-1.5 leading-relaxed">
                  Ditampilkan di eksplorasi campaign. Seluruh kreator terverifikasi dapat melihat brief dan mengajukan proposal lamaran langsung.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setVisibility("private")}
                className={`p-4 rounded-xl border text-left transition-all min-h-[44px] cursor-pointer ${
                  visibility === "private"
                    ? "border-blue-500 bg-blue-500/10 dark:bg-blue-500/15 text-slate-900 dark:text-white ring-1 ring-blue-500"
                    : "border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] text-slate-700 dark:text-white/70 hover:border-blue-300 dark:hover:border-white/20"
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-sm text-slate-900 dark:text-white">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  Privat (Hanya Undangan)
                </div>
                <p className="text-xs text-slate-500 dark:text-white/50 mt-1.5 leading-relaxed">
                  Hanya kreator yang Anda pilih dan undang secara langsung dari sistem rekomendasi yang dapat melihat dan mengakses campaign ini.
                </p>
              </button>
            </div>
          </div>

          <div className="campaign-wizard__actions">
            <button
              type="button"
              className="campaign-btn campaign-btn--primary"
              onClick={handleNext}
            >
              {t("nextStep")} →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Requirements */}
      {step === 2 && (
        <div className="campaign-wizard__content">
          <div className="campaign-requirements-header">
            <p className="campaign-requirements-desc">{t("step2Title")}</p>
            <button
              type="button"
              className="campaign-btn campaign-btn--outline"
              onClick={addRequirement}
            >
              + {t("addRequirement")}
            </button>
          </div>

          <div className="campaign-requirements-list">
            {requirements.map((req, idx) => (
              <div key={idx} className="campaign-requirement-card">
                <div className="campaign-requirement-card__top">
                  <span className="campaign-requirement-card__index">
                    #{idx + 1}
                  </span>
                  {requirements.length > 1 && (
                    <button
                      type="button"
                      className="campaign-btn--text-danger"
                      onClick={() => removeRequirement(idx)}
                    >
                      {t("removeRequirement")}
                    </button>
                  )}
                </div>

                <div className="campaign-form-grid">
                  <div className="campaign-form-group">
                    <label className="campaign-form-label">
                      {t("platformLabel")}
                    </label>
                    <select
                      className="campaign-form-select"
                      value={req.platform_id ?? ""}
                      onChange={(e) =>
                        updateRequirement(
                          idx,
                          "platform_id",
                          e.target.value || null,
                        )
                      }
                    >
                      <option value="">{t("allPlatforms")}</option>
                      {catalog.platforms.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="campaign-form-group">
                    <label className="campaign-form-label">
                      {t("categoryLabel")}
                    </label>
                    <select
                      className="campaign-form-select"
                      value={req.category_id ?? ""}
                      onChange={(e) =>
                        updateRequirement(
                          idx,
                          "category_id",
                          e.target.value || null,
                        )
                      }
                    >
                      <option value="">{t("allCategories")}</option>
                      {catalog.categories.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="campaign-form-grid">
                  <div className="campaign-form-group">
                    <label className="campaign-form-label">
                      {t("minFollowersLabel")}
                    </label>
                    <input
                      type="number"
                      className="campaign-form-input"
                      value={req.min_followers ?? 0}
                      onChange={(e) =>
                        updateRequirement(
                          idx,
                          "min_followers",
                          Math.max(0, Number(e.target.value)),
                        )
                      }
                      min="0"
                    />
                  </div>

                  <div className="campaign-form-group">
                    <label className="campaign-form-label">
                      {t("minEngagementLabel")}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      className="campaign-form-input"
                      value={req.min_engagement_rate ?? 0}
                      onChange={(e) =>
                        updateRequirement(
                          idx,
                          "min_engagement_rate",
                          Math.max(0, Number(e.target.value)),
                        )
                      }
                      min="0"
                      max="100"
                    />
                  </div>
                </div>

                <div className="campaign-form-grid">
                  <div className="campaign-form-group">
                    <label className="campaign-form-label">
                      {t("deliverableTypeLabel")}
                    </label>
                    <input
                      type="text"
                      className="campaign-form-input"
                      value={req.deliverable_type ?? ""}
                      onChange={(e) =>
                        updateRequirement(
                          idx,
                          "deliverable_type",
                          e.target.value,
                        )
                      }
                      placeholder={t("deliverablePlaceholder")}
                      maxLength={80}
                    />
                  </div>

                  <div className="campaign-form-group">
                    <label className="campaign-form-label">
                      {t("quantityLabel")}
                    </label>
                    <input
                      type="number"
                      className="campaign-form-input"
                      value={req.quantity ?? 1}
                      onChange={(e) =>
                        updateRequirement(
                          idx,
                          "quantity",
                          Math.max(1, Number(e.target.value)),
                        )
                      }
                      min="1"
                      max="100"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="campaign-wizard__actions">
            <button
              type="button"
              className="campaign-btn campaign-btn--secondary"
              onClick={handlePrev}
            >
              ← {t("prevStep")}
            </button>
            <button
              type="button"
              className="campaign-btn campaign-btn--primary"
              onClick={handleNext}
            >
              {t("nextStep")} →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review & Submit */}
      {step === 3 && (
        <div className="campaign-wizard__content">
          <div className="campaign-review-panel">
            <h3 className="campaign-review-title">{title}</h3>
            <p className="campaign-review-desc">{description}</p>

            <dl className="campaign-review-meta">
              <div>
                <dt>{t("budget")}</dt>
                <dd>
                  {new Intl.NumberFormat(locale, {
                    style: "currency",
                    currency,
                    maximumFractionDigits: currency === "IDR" ? 0 : 2,
                  }).format(
                    currency === "IDR"
                      ? Number(budgetDisplay)
                      : Number(budgetDisplay),
                  )}
                </dd>
              </div>
              <div>
                <dt>{t("target")}</dt>
                <dd>{t("creatorsCount", { count: targetCreators })}</dd>
              </div>
              <div>
                <dt>{t("deadline")}</dt>
                <dd>{new Date(deadline).toLocaleDateString(locale)}</dd>
              </div>
              <div>
                <dt>Visibilitas</dt>
                <dd>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    visibility === "public"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${visibility === "public" ? "bg-emerald-400" : "bg-blue-400"}`} />
                    {visibility === "public" ? "Publik (Terbuka)" : "Privat (Undangan)"}
                  </span>
                </dd>
              </div>
            </dl>

            <h4 className="campaign-review-sub">
              {t("requirements")} ({requirements.length})
            </h4>
            <div className="campaign-review-reqs">
              {requirements.map((req, i) => {
                const plat = catalog.platforms.find(
                  (p) => p.code === req.platform_id,
                );
                const cat = catalog.categories.find(
                  (c) => c.code === req.category_id,
                );
                return (
                  <div key={i} className="campaign-review-req-item">
                    <span>
                      <strong>{req.deliverable_type || "Deliverable"}</strong>{" "}
                      (x{req.quantity})
                    </span>
                    <span>
                      {plat?.name || t("allPlatforms")} •{" "}
                      {cat?.name || t("allCategories")}
                    </span>
                    <span>
                      ≥ {req.min_followers?.toLocaleString(locale)} followers •
                      ≥ {req.min_engagement_rate}% ER
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="campaign-wizard__actions">
            <button
              type="button"
              className="campaign-btn campaign-btn--secondary"
              onClick={handlePrev}
              disabled={isSubmitting}
            >
              ← {t("prevStep")}
            </button>
            <button
              type="button"
              className="campaign-btn campaign-btn--primary"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? t("submitting") : t("submitDraft")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

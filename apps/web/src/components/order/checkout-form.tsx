"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Clock3,
  RefreshCw,
  LoaderCircle,
  ArrowRight,
} from "lucide-react";
import type { CreatorService, ServicePackage } from "@/lib/service-types";
import type { Order } from "@/lib/order-types";
import { orderRequest, normalizeOrderErrorCode } from "@/lib/order-client";
import type { ApiError } from "@/lib/auth-client";

type Labels = {
  choosePackage: string;
  selectedPackage: string;
  delivery: string;
  deliveryValue: string;
  revisions: string;
  revisionValue: string;
  briefTitle: string;
  briefDescription: string;
  briefPlaceholder: string;
  charCount: string;
  minCharsNote: string;
  orderSummary: string;
  placeOrderAction: string;
  placingOrder: string;
  loginRequired: string;
  errors: Record<string, string>;
};

type Props = {
  service: CreatorService;
  initialPackageId?: string;
  locale: string;
  labels: Labels;
};

export function CheckoutForm({
  service,
  initialPackageId,
  locale,
  labels,
}: Props) {
  const router = useRouter();
  const [selectedPkgIndex, setSelectedPkgIndex] = useState(() => {
    if (initialPackageId) {
      const found = service.packages.findIndex(
        (p) => p.id === initialPackageId || p.name === initialPackageId,
      );
      if (found >= 0) return found;
    }
    return 0;
  });

  const [brief, setBrief] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentPkg: ServicePackage =
    service.packages[selectedPkgIndex] ?? service.packages[0];

  const formattedPrice = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currentPkg.currency,
    maximumFractionDigits: currentPkg.currency === "IDR" ? 0 : 2,
  }).format(currentPkg.price_minor / (currentPkg.currency === "IDR" ? 1 : 100));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (brief.trim().length < 20) {
      setError(labels.errors.validation_failed || labels.minCharsNote);
      return;
    }

    if (!currentPkg.id) {
      setError("Package reference is invalid.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const res = await orderRequest<{ data: Order }>("orders", {
          method: "POST",
          body: JSON.stringify({
            service_id: service.id,
            package_id: currentPkg.id,
            brief_content: brief.trim(),
          }),
        });
        router.push(`/${locale}/orders/${res.data.id}`);
      } catch (caught) {
        const err = caught as ApiError;
        const normalized = normalizeOrderErrorCode(err.code);
        setError(
          labels.errors[normalized] || err.message || "Failed to place order.",
        );
      }
    });
  }

  return (
    <form className="checkout-form" onSubmit={handleSubmit}>
      <div className="checkout-form__grid">
        <div className="checkout-form__main">
          <section className="checkout-section">
            <h2 className="checkout-section__title">{labels.choosePackage}</h2>
            <div className="package-options">
              {service.packages.map((pkg, idx) => {
                const pkgPrice = new Intl.NumberFormat(locale, {
                  style: "currency",
                  currency: pkg.currency,
                  maximumFractionDigits: pkg.currency === "IDR" ? 0 : 2,
                }).format(pkg.price_minor / (pkg.currency === "IDR" ? 1 : 100));

                return (
                  <label
                    key={pkg.id ?? pkg.name}
                    className={idx === selectedPkgIndex ? "is-selected" : ""}
                  >
                    <input
                      type="radio"
                      name="selected_package"
                      checked={idx === selectedPkgIndex}
                      onChange={() => setSelectedPkgIndex(idx)}
                      disabled={isPending}
                    />
                    <span className="package-option__check" aria-hidden="true">
                      {idx === selectedPkgIndex ? <Check size={15} /> : null}
                    </span>
                    <span className="package-option__name">{pkg.name}</span>
                    <strong>{pkgPrice}</strong>
                  </label>
                );
              })}
            </div>
          </section>

          <section className="checkout-section">
            <h2 className="checkout-section__title">{labels.briefTitle}</h2>
            <p className="checkout-section__help">{labels.briefDescription}</p>

            <div className="checkout-field">
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder={labels.briefPlaceholder}
                rows={6}
                minLength={20}
                maxLength={5000}
                required
                disabled={isPending}
              />
              <div className="checkout-field__footer">
                <small>{labels.minCharsNote}</small>
                <span>
                  {labels.charCount.replace("{count}", String(brief.length))}
                </span>
              </div>
            </div>
          </section>
        </div>

        <aside className="checkout-form__sidebar">
          <div className="checkout-summary">
            <h3>{labels.orderSummary}</h3>

            <div className="checkout-summary__service">
              <strong>{service.title}</strong>
              <p>{service.creator_display_name}</p>
            </div>

            <div className="checkout-summary__package">
              <span className="checkout-summary__package-badge">
                {currentPkg.name}
              </span>
              <strong className="checkout-summary__price">
                {formattedPrice}
              </strong>
            </div>

            <dl className="checkout-summary__meta">
              <div>
                <dt>
                  <Clock3 size={15} aria-hidden="true" /> {labels.delivery}
                </dt>
                <dd>
                  {labels.deliveryValue.replace(
                    "{count}",
                    String(currentPkg.delivery_days),
                  )}
                </dd>
              </div>
              <div>
                <dt>
                  <RefreshCw size={15} aria-hidden="true" /> {labels.revisions}
                </dt>
                <dd>
                  {labels.revisionValue.replace(
                    "{count}",
                    String(currentPkg.revision_limit),
                  )}
                </dd>
              </div>
            </dl>

            {error ? (
              <div className="form-status form-status--error" role="alert">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              className="button button--signal checkout-summary__submit"
              disabled={isPending || brief.trim().length < 20}
            >
              {isPending ? (
                <>
                  <LoaderCircle className="spin" size={18} aria-hidden="true" />
                  {labels.placingOrder}
                </>
              ) : (
                <>
                  {labels.placeOrderAction}{" "}
                  <ArrowRight size={18} aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </aside>
      </div>
    </form>
  );
}

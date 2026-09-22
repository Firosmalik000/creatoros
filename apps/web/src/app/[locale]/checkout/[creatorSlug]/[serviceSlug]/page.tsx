import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckoutForm } from "@/components/order/checkout-form";
import { SiteHeader } from "@/components/site-header";
import type { AppLocale } from "@/i18n/routing";
import { getPublicService } from "@/lib/service-server";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{
    locale: AppLocale;
    creatorSlug: string;
    serviceSlug: string;
  }>;
  searchParams: Promise<{ package?: string }>;
};

export default async function CheckoutPage({
  params,
  searchParams,
}: PageProps) {
  const { locale, creatorSlug, serviceSlug } = await params;
  const { package: selectedPkg } = await searchParams;
  setRequestLocale(locale);

  // Require session cookie (Decision 1: login dulu)
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("creatoros_session");
  if (!sessionCookie) {
    redirect(
      `/${locale}/auth/login?redirect=/${locale}/checkout/${encodeURIComponent(creatorSlug)}/${encodeURIComponent(serviceSlug)}${selectedPkg ? `?package=${encodeURIComponent(selectedPkg)}` : ""}`,
    );
  }

  const service = await getPublicService(creatorSlug, serviceSlug);
  if (!service) notFound();

  const [t, nav] = await Promise.all([
    getTranslations({ locale, namespace: "Checkout" }),
    getTranslations({ locale, namespace: "Nav" }),
  ]);

  return (
    <>
      <SiteHeader
        locale={locale}
        labels={{
          discover: nav("discover"),
          how: nav("how"),
          brands: nav("brands"),
          creators: nav("creators"),
          login: nav("login"),
          start: nav("start"),
          language: nav("language"),
        }}
      />
      <main id="main-content" className="checkout-page shell">
        <Link
          className="back-link"
          href={`/${locale}/creators/${service.creator_slug}/services/${service.slug}`}
        >
          <ArrowLeft aria-hidden="true" size={17} /> {t("backToService")}
        </Link>

        <header className="checkout-page__header">
          <span className="checkout-page__kicker">{t("kicker")}</span>
          <h1>{t("title")}</h1>
          <p>{t("description")}</p>
        </header>

        <CheckoutForm
          service={service}
          initialPackageId={selectedPkg}
          locale={locale}
          labels={{
            choosePackage: t("choosePackage"),
            selectedPackage: t("selectedPackage"),
            delivery: t("delivery"),
            deliveryValue: t.raw("deliveryValue") as string,
            revisions: t("revisions"),
            revisionValue: t.raw("revisionValue") as string,
            briefTitle: t("briefTitle"),
            briefDescription: t("briefDescription"),
            briefPlaceholder: t("briefPlaceholder"),
            charCount: t.raw("charCount") as string,
            minCharsNote: t("minCharsNote"),
            orderSummary: t("orderSummary"),
            placeOrderAction: t("placeOrderAction"),
            placingOrder: t("placingOrder"),
            loginRequired: t("loginRequired"),
            errors: {
              invalid_request: t("errors.invalid_request"),
              validation_failed: t("errors.validation_failed"),
              forbidden: t("errors.forbidden"),
              unauthenticated: t("errors.unauthenticated"),
              not_found: t("errors.not_found"),
              self_order_forbidden: t("errors.self_order_forbidden"),
              service_unavailable: t("errors.service_unavailable"),
              internal_error: t("errors.internal_error"),
              unknown_error: t("errors.unknown_error"),
            },
          }}
        />
      </main>
    </>
  );
}

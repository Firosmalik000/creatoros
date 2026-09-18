import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";

export default async function VerifyEmailPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const translations = await getTranslations({ locale, namespace: "Auth" });
  return (
    <AuthShell
      locale={locale}
      title={translations("verifyTitle")}
      description={translations("verifyBody")}
      backLabel={translations("backHome")}
      proofLabel={translations("managedProof")}
    >
      <Suspense fallback={<div className="form-skeleton" />}>
        <VerifyEmailForm />
      </Suspense>
    </AuthShell>
  );
}

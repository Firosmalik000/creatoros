import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage({
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
      title={translations("resetTitle")}
      description={translations("resetBody")}
      backLabel={translations("backHome")}
      proofLabel={translations("managedProof")}
    >
      <Suspense fallback={<div className="form-skeleton" />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}

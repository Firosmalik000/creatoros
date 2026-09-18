import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export default async function RegisterPage({
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
      title={translations("registerTitle")}
      description={translations("registerBody")}
      backLabel={translations("backHome")}
      proofLabel={translations("managedProof")}
    >
      <RegisterForm />
    </AuthShell>
  );
}

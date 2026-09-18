import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
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
      title={translations("loginTitle")}
      description={translations("loginBody")}
      backLabel={translations("backHome")}
      proofLabel={translations("managedProof")}
    >
      <LoginForm />
    </AuthShell>
  );
}

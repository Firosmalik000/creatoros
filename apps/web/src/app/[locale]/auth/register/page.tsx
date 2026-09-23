import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { getCurrentUser } from "@/lib/auth-server";

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const currentUser = await getCurrentUser();
  if (currentUser) {
    if (currentUser.roles.includes("admin")) {
      redirect(`/${locale}/admin`);
    } else if (currentUser.roles.includes("creator")) {
      redirect(`/${locale}/creator/orders`);
    } else {
      redirect(`/${locale}/orders`);
    }
  }
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

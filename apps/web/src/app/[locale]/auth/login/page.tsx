import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { loginAction } from "./actions";
import { getCurrentUser } from "@/lib/auth-server";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ email?: string; password?: string }>;
};

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { email, password } = await searchParams;
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

  // If the browser previously performed an accidental GET submission with credentials:
  if (email && password) {
    const formData = new FormData();
    formData.set("email", email);
    formData.set("password", password);
    formData.set("locale", locale);
    await loginAction({}, formData);
  }

  const translations = await getTranslations({ locale, namespace: "Auth" });
  return (
    <AuthShell
      locale={locale}
      title={translations("loginTitle")}
      description={translations("loginBody")}
      backLabel={translations("backHome")}
      proofLabel={translations("managedProof")}
    >
      <LoginForm defaultEmail={email} />
    </AuthShell>
  );
}

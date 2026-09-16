import "@fontsource-variable/manrope";
import "@fontsource-variable/newsreader";
import "../globals.css";
import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { notFound } from "next/navigation";
import { htmlLanguage, routing, type AppLocale } from "@/i18n/routing";
import { siteConfig } from "@/lib/site";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: Omit<LayoutProps, "children">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const translations = await getTranslations({ locale, namespace: "Metadata" });
  const canonical = `${siteConfig.origin}/${locale}`;

  return {
    metadataBase: new URL(siteConfig.origin),
    title: translations("title"),
    description: translations("description"),
    alternates: {
      canonical,
      languages: {
        "id-ID": `${siteConfig.origin}/id`,
        en: `${siteConfig.origin}/en`,
        "ms-MY": `${siteConfig.origin}/ms`,
        "x-default": `${siteConfig.origin}/id`,
      },
    },
    openGraph: {
      type: "website",
      siteName: siteConfig.name,
      title: translations("title"),
      description: translations("description"),
      url: canonical,
      locale: htmlLanguage[locale],
      images: [
        {
          url: "/images/creator-contact-sheet-v2.png",
          width: 1875,
          height: 839,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: translations("title"),
      description: translations("description"),
      images: ["/images/creator-contact-sheet-v2.png"],
    },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={htmlLanguage[locale as AppLocale]}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

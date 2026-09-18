"use client";

import { useTranslations } from "next-intl";

export default function AuthLoading() {
  const translations = useTranslations("Auth");

  return (
    <main
      className="auth-loading"
      aria-busy="true"
      aria-label={translations("loading")}
    >
      <div className="auth-loading__panel" />
      <div className="auth-loading__visual" />
    </main>
  );
}

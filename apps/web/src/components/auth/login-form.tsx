"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { FormEvent, useState } from "react";
import {
  authRequest,
  normalizeAuthErrorCode,
  type ApiError,
} from "@/lib/auth-client";
import { FormStatus } from "./form-status";

export function LoginForm() {
  const translations = useTranslations("Auth");
  const locale = useLocale();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await authRequest("login", {
        method: "POST",
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      router.push(`/${locale}/settings`);
      router.refresh();
    } catch (caught) {
      setError(caught as ApiError);
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {error ? (
        <FormStatus tone="error">
          {translations(`errors.${normalizeAuthErrorCode(error.code)}`)}
        </FormStatus>
      ) : null}
      <label className="field">
        <span>{translations("email")}</span>
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label className="field">
        <span>{translations("password")}</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      <Link
        className="auth-inline-link"
        href={`/${locale}/auth/forgot-password`}
      >
        {translations("forgotLink")}
      </Link>
      <button className="button button--signal auth-submit" disabled={pending}>
        {pending ? <LoaderCircle className="spin" aria-hidden="true" /> : null}
        {pending ? translations("submitting") : translations("loginAction")}
        {!pending ? <ArrowRight aria-hidden="true" size={18} /> : null}
      </button>
      <p className="auth-switch">
        {translations("noAccount")}{" "}
        <Link href={`/${locale}/auth/register`}>
          {translations("registerLink")}
        </Link>
      </p>
    </form>
  );
}

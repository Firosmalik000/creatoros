"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { FormEvent, useState } from "react";
import {
  authRequest,
  normalizeAuthErrorCode,
  type ApiError,
} from "@/lib/auth-client";
import { FormStatus } from "./form-status";

type ForgotResponse = {
  meta?: { reset_token?: string };
};

export function ForgotPasswordForm() {
  const translations = useTranslations("Auth");
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ForgotResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      setResult(
        await authRequest<ForgotResponse>("forgot-password", {
          method: "POST",
          body: JSON.stringify({ email: form.get("email") }),
        }),
      );
    } catch (caught) {
      setError(caught as ApiError);
    } finally {
      setPending(false);
    }
  }

  if (result) {
    const token = result.meta?.reset_token;
    return (
      <div className="auth-form">
        <FormStatus tone="success">
          <strong>{translations("forgotSuccessTitle")}</strong>
          <p>{translations("forgotSuccessBody")}</p>
        </FormStatus>
        {token ? (
          <Link
            className="button button--signal auth-submit"
            href={`/${locale}/auth/reset-password?token=${encodeURIComponent(token)}`}
          >
            {translations("resetNow")}
            <ArrowRight aria-hidden="true" size={18} />
          </Link>
        ) : null}
      </div>
    );
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
      <button className="button button--signal auth-submit" disabled={pending}>
        {pending ? <LoaderCircle className="spin" aria-hidden="true" /> : null}
        {pending ? translations("submitting") : translations("forgotAction")}
        {!pending ? <ArrowRight aria-hidden="true" size={18} /> : null}
      </button>
    </form>
  );
}

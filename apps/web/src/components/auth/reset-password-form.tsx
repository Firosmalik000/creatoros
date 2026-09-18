"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { FormEvent, useState } from "react";
import {
  authRequest,
  normalizeAuthErrorCode,
  type ApiError,
} from "@/lib/auth-client";
import { FormStatus } from "./form-status";

export function ResetPasswordForm() {
  const translations = useTranslations("Auth");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("password_confirmation")) {
      setError({
        code: "password_mismatch",
        message: "Passwords do not match.",
      });
      return;
    }
    setPending(true);
    setError(null);
    try {
      await authRequest("reset-password", {
        method: "POST",
        body: JSON.stringify({
          token: form.get("token"),
          password: form.get("password"),
        }),
      });
      setComplete(true);
    } catch (caught) {
      setError(caught as ApiError);
    } finally {
      setPending(false);
    }
  }

  if (complete) {
    return (
      <div className="auth-form">
        <FormStatus tone="success">
          <strong>{translations("resetSuccessTitle")}</strong>
          <p>{translations("resetSuccessBody")}</p>
        </FormStatus>
        <Link
          className="button button--signal auth-submit"
          href={`/${locale}/auth/login`}
        >
          {translations("continueLogin")}
          <ArrowRight aria-hidden="true" size={18} />
        </Link>
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
        <span>{translations("resetToken")}</span>
        <input
          name="token"
          defaultValue={searchParams.get("token") ?? ""}
          autoComplete="one-time-code"
          required
        />
      </label>
      <label className="field">
        <span>{translations("newPassword")}</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
        />
      </label>
      <label className="field">
        <span>{translations("confirmPassword")}</span>
        <input
          name="password_confirmation"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
        />
      </label>
      <button className="button button--signal auth-submit" disabled={pending}>
        {pending ? <LoaderCircle className="spin" aria-hidden="true" /> : null}
        {pending ? translations("submitting") : translations("resetAction")}
        {!pending ? <ArrowRight aria-hidden="true" size={18} /> : null}
      </button>
    </form>
  );
}

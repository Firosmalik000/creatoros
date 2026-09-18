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

export function VerifyEmailForm() {
  const translations = useTranslations("Auth");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await authRequest("verify-email", {
        method: "POST",
        body: JSON.stringify({ token: form.get("token") }),
      });
      setVerified(true);
    } catch (caught) {
      setError(caught as ApiError);
    } finally {
      setPending(false);
    }
  }

  if (verified) {
    return (
      <div className="auth-form">
        <FormStatus tone="success">
          <strong>{translations("verifySuccessTitle")}</strong>
          <p>{translations("verifySuccessBody")}</p>
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
        <span>{translations("verificationToken")}</span>
        <input
          name="token"
          defaultValue={searchParams.get("token") ?? ""}
          autoComplete="one-time-code"
          required
        />
      </label>
      <button className="button button--signal auth-submit" disabled={pending}>
        {pending ? <LoaderCircle className="spin" aria-hidden="true" /> : null}
        {pending ? translations("submitting") : translations("verifyAction")}
        {!pending ? <ArrowRight aria-hidden="true" size={18} /> : null}
      </button>
    </form>
  );
}

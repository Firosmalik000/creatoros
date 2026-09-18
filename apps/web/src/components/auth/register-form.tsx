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

type RegisterResponse = {
  data: { email: string };
  meta?: { verification_token?: string };
};

export function RegisterForm() {
  const translations = useTranslations("Auth");
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<RegisterResponse | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await authRequest<RegisterResponse>("register", {
        method: "POST",
        body: JSON.stringify({
          display_name: form.get("display_name"),
          email: form.get("email"),
          password: form.get("password"),
          role: form.get("role"),
          preferred_locale: locale,
        }),
      });
      setResult(response);
    } catch (caught) {
      setError(caught as ApiError);
    } finally {
      setPending(false);
    }
  }

  if (result) {
    const token = result.meta?.verification_token;
    return (
      <div className="auth-form">
        <FormStatus tone="success">
          <strong>{translations("registerSuccessTitle")}</strong>
          <p>
            {translations("registerSuccessBody", { email: result.data.email })}
          </p>
        </FormStatus>
        {token ? (
          <Link
            className="button button--signal auth-submit"
            href={`/${locale}/auth/verify-email?token=${encodeURIComponent(token)}`}
          >
            {translations("verifyNow")}
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
        <span>{translations("displayName")}</span>
        <input name="display_name" autoComplete="name" minLength={2} required />
      </label>
      <label className="field">
        <span>{translations("email")}</span>
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label className="field">
        <span>{translations("password")}</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          aria-describedby="password-hint"
          required
        />
        <small id="password-hint">{translations("passwordHint")}</small>
      </label>
      <fieldset className="role-picker">
        <legend>{translations("accountType")}</legend>
        <label>
          <input type="radio" name="role" value="client" defaultChecked />
          <span>
            <strong>{translations("clientRole")}</strong>
            <small>{translations("clientRoleBody")}</small>
          </span>
        </label>
        <label>
          <input type="radio" name="role" value="creator" />
          <span>
            <strong>{translations("creatorRole")}</strong>
            <small>{translations("creatorRoleBody")}</small>
          </span>
        </label>
      </fieldset>
      <button className="button button--signal auth-submit" disabled={pending}>
        {pending ? <LoaderCircle className="spin" aria-hidden="true" /> : null}
        {pending ? translations("submitting") : translations("registerAction")}
        {!pending ? <ArrowRight aria-hidden="true" size={18} /> : null}
      </button>
      <p className="auth-switch">
        {translations("hasAccount")}{" "}
        <Link href={`/${locale}/auth/login`}>{translations("loginLink")}</Link>
      </p>
    </form>
  );
}

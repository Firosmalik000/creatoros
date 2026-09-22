"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { FormEvent, useActionState, useState, useTransition } from "react";
import {
  authRequest,
  normalizeAuthErrorCode,
  type ApiError,
} from "@/lib/auth-client";
import { loginAction, type LoginState } from "@/app/[locale]/auth/login/actions";
import { FormStatus } from "./form-status";

export function LoginForm({ defaultEmail }: { defaultEmail?: string }) {
  const translations = useTranslations("Auth");
  const locale = useLocale();
  const router = useRouter();

  const [state, formAction, isPendingAction] = useActionState<LoginState, FormData>(
    loginAction,
    {},
  );
  const [isClientPending, startClientTransition] = useTransition();
  const [clientError, setClientError] = useState<ApiError | null>(null);

  const pending = isPendingAction || isClientPending;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClientError(null);
    const form = new FormData(event.currentTarget);
    const email = (form.get("email") as string)?.trim().toLowerCase();
    const password = form.get("password") as string;

    startClientTransition(async () => {
      try {
        const res = await authRequest<{ data?: { roles?: string[] } }>("login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });

        const roles = res?.data?.roles ?? [];
        if (roles.includes("admin")) {
          router.push(`/${locale}/admin`);
        } else if (roles.includes("creator")) {
          router.push(`/${locale}/creator/orders`);
        } else if (roles.includes("client")) {
          router.push(`/${locale}/orders`);
        } else {
          router.push(`/${locale}/settings`);
        }
        router.refresh();
      } catch (caught) {
        setClientError(caught as ApiError);
      }
    });
  }

  const activeErrorCode = clientError?.code || state?.error;

  return (
    <form className="auth-form" method="post" action={formAction} onSubmit={submit}>
      <input type="hidden" name="locale" value={locale} />
      {activeErrorCode ? (
        <FormStatus tone="error">
          {translations(`errors.${normalizeAuthErrorCode(activeErrorCode)}`)}
        </FormStatus>
      ) : null}
      <label className="field">
        <span>{translations("email")}</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={defaultEmail ?? ""}
          required
        />
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
      <button className="button button--signal auth-submit" type="submit" disabled={pending}>
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

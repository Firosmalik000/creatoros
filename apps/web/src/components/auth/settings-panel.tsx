"use client";

import { LoaderCircle, LogOut, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { FormEvent, useEffect, useState } from "react";
import {
  authRequest,
  normalizeAuthErrorCode,
  type ApiError,
} from "@/lib/auth-client";
import { FormStatus } from "./form-status";

type User = {
  id: string;
  email: string;
  display_name: string;
  preferred_locale: "id" | "en" | "ms";
  roles: string[];
  permissions: string[];
};

type UserResponse = { data: User };

export function SettingsPanel() {
  const translations = useTranslations("Auth");
  const locale = useLocale();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [savePending, setSavePending] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let active = true;
    authRequest<UserResponse>("me")
      .then((response) => {
        if (active) setUser(response.data);
      })
      .catch((caught: ApiError) => {
        if (active) setError(caught);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavePending(true);
    setSuccess(false);
    setError(null);
    const form = new FormData(event.currentTarget);
    const preferredLocale = String(form.get("preferred_locale"));
    try {
      const response = await authRequest<UserResponse>("settings", {
        method: "PATCH",
        body: JSON.stringify({ preferred_locale: preferredLocale }),
      });
      setUser(response.data);
      setSuccess(true);
      if (preferredLocale !== locale) {
        router.replace(`/${preferredLocale}/settings`);
      }
    } catch (caught) {
      setError(caught as ApiError);
    } finally {
      setSavePending(false);
    }
  }

  async function logout() {
    setLogoutPending(true);
    setError(null);
    try {
      await authRequest("logout", { method: "POST" });
      router.replace(`/${locale}`);
      router.refresh();
    } catch (caught) {
      setError(caught as ApiError);
      setLogoutPending(false);
    }
  }

  if (loading) {
    return (
      <div className="settings-state" role="status">
        <LoaderCircle className="spin" aria-hidden="true" />
        {translations("loadingAccount")}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="settings-state settings-state--error">
        <FormStatus tone="error">
          {error
            ? translations(`errors.${normalizeAuthErrorCode(error.code)}`)
            : translations("accountUnavailable")}
        </FormStatus>
        <Link className="button button--dark" href={`/${locale}/auth/login`}>
          {translations("loginAction")}
        </Link>
      </div>
    );
  }

  return (
    <div className="settings-grid">
      <section className="account-summary" aria-labelledby="account-name">
        <div className="account-monogram" aria-hidden="true">
          {user.display_name.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h2 id="account-name">{user.display_name}</h2>
          <p>{user.email}</p>
        </div>
        <dl>
          <div>
            <dt>{translations("roleLabel")}</dt>
            <dd>{user.roles.join(", ") || translations("roleEmpty")}</dd>
          </div>
          <div>
            <dt>{translations("permissionLabel")}</dt>
            <dd>{user.permissions.length}</dd>
          </div>
        </dl>
      </section>

      <form className="settings-form" onSubmit={submit}>
        {error ? (
          <FormStatus tone="error">
            {translations(`errors.${normalizeAuthErrorCode(error.code)}`)}
          </FormStatus>
        ) : null}
        {success ? (
          <FormStatus tone="success">
            {translations("settingsSaved")}
          </FormStatus>
        ) : null}
        <div>
          <h2>{translations("languageTitle")}</h2>
          <p>{translations("languageBody")}</p>
        </div>
        <label className="field">
          <span>{translations("languageLabel")}</span>
          <select name="preferred_locale" defaultValue={user.preferred_locale}>
            <option value="id">Bahasa Indonesia</option>
            <option value="en">English</option>
            <option value="ms">Bahasa Melayu</option>
          </select>
        </label>
        <div className="settings-actions">
          <button
            className="button button--signal"
            disabled={savePending || logoutPending}
          >
            {savePending ? (
              <LoaderCircle className="spin" aria-hidden="true" />
            ) : (
              <Save aria-hidden="true" size={18} />
            )}
            {savePending
              ? translations("saving")
              : translations("saveSettings")}
          </button>
          <button
            className="button button--quiet"
            type="button"
            onClick={logout}
            disabled={savePending || logoutPending}
          >
            {logoutPending ? (
              <LoaderCircle className="spin" aria-hidden="true" />
            ) : (
              <LogOut aria-hidden="true" size={18} />
            )}
            {logoutPending
              ? translations("loggingOut")
              : translations("logoutAction")}
          </button>
        </div>
      </form>
    </div>
  );
}

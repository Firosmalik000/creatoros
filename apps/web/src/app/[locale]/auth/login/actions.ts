"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type LoginState = {
  error?: string;
};

export async function loginAction(
  prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const locale = (formData.get("locale") as string) || "id";

  if (!email || !password) {
    return { error: "validation_failed" };
  }

  const baseURL = process.env.API_BASE_URL ?? "http://localhost:8080/api/v1";
  let targetPath = `/${locale}/settings`;

  try {
    const res = await fetch(`${baseURL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });

    if (!res.ok) {
      const errData = (await res.json().catch(() => null)) as {
        error?: { code?: string };
      } | null;
      return { error: errData?.error?.code ?? "invalid_credentials" };
    }

    const payload = (await res.json()) as {
      data?: { roles?: string[] };
    };

    const cookieStore = await cookies();
    const setCookies = res.headers.getSetCookie();
    for (const setCookie of setCookies) {
      const [nameValue] = setCookie.split(";").map((s) => s.trim());
      const [name, ...rest] = nameValue.split("=");
      const val = rest.join("=");
      if (name && val) {
        cookieStore.set(name, val, {
          path: "/",
          sameSite: "lax",
          httpOnly: name === "creatoros_session",
          secure: process.env.NODE_ENV === "production",
        });
      }
    }

    const roles = payload?.data?.roles ?? [];
    if (roles.includes("admin")) {
      targetPath = `/${locale}/admin`;
    } else if (roles.includes("creator")) {
      targetPath = `/${locale}/creator/orders`;
    } else if (roles.includes("client")) {
      targetPath = `/${locale}/orders`;
    }
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "digest" in err &&
      typeof (err as { digest: string }).digest === "string" &&
      (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }
    return { error: "service_unavailable" };
  }

  redirect(targetPath);
}

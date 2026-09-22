import { cookies } from "next/headers";

const apiBase = () =>
  process.env.API_BASE_URL ?? "http://localhost:8080/api/v1";

export interface CurrentUser {
  id: string;
  email: string;
  display_name: string;
  preferred_locale: string;
  status: string;
  roles: string[];
  permissions?: string[];
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();
    if (!cookieHeader) return null;
    const response = await fetch(`${apiBase()}/auth/me`, {
      cache: "no-store",
      headers: { Cookie: cookieHeader },
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { data: CurrentUser };
    return json.data;
  } catch {
    return null;
  }
}

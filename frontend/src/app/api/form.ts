import { API_BASE } from "./client";

export async function apiForm<T>(path: string, method: "POST" | "PATCH" | "PUT", form: FormData): Promise<T> {
  const doFetch = async (accessToken: string | null) => {
    const headers: Record<string, string> = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    return fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: form,
    });
  };

  const getAccess = () => localStorage.getItem("access_token");
  const getRefresh = () => localStorage.getItem("refresh_token");

  const refreshAccess = async () => {
    const refresh = getRefresh();
    if (!refresh) return null;

    const res = await fetch(`${API_BASE}/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access?: string };
    if (!data?.access) return null;
    localStorage.setItem("access_token", data.access);
    return data.access;
  };

  let res = await doFetch(getAccess());
  if (res.status === 401) {
    const newToken = await refreshAccess();
    if (newToken) res = await doFetch(newToken);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }

  return (await res.json()) as T;
}

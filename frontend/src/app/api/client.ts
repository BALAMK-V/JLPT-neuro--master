export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? "http://127.0.0.1:8000/api";

type RefreshResult = { access: string };

function getAccessToken(): string | null {
  return localStorage.getItem("access_token");
}

function getRefreshToken(): string | null {
  return localStorage.getItem("refresh_token");
}

async function request<T>(path: string, method: HttpMethod, body: unknown | undefined, accessToken?: string | null): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  return fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;

  const res = await request<RefreshResult>("/auth/token/refresh/", "POST", { refresh }, null);
  if (!res.ok) return null;
  const data = (await res.json()) as RefreshResult;
  if (!data?.access) return null;

  localStorage.setItem("access_token", data.access);
  return data.access;
}

export async function api<T>(path: string, method: HttpMethod = "GET", body?: unknown): Promise<T> {
  const token = getAccessToken();
  let res = await request<T>(path, method, body, token);

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) res = await request<T>(path, method, body, newToken);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return (await res.json()) as T;
}

export async function apiNoAuth<T>(path: string, method: HttpMethod = "GET", body?: unknown): Promise<T> {
  const res = await request<T>(path, method, body, null);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return (await res.json()) as T;
}

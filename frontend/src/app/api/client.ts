/**
 * HTTP client — JWT-authenticated fetch wrapper.
 *
 * Provides two exported async functions:
 *   - `api<T>`       — authenticated requests (auto-refresh on 401)
 *   - `apiNoAuth<T>` — unauthenticated requests (login, register, reset)
 *
 * Error contract
 * --------------
 * Both functions throw `ApiError` on non-2xx responses.  Callers should
 * catch `ApiError` to display user-facing messages and `Error` for
 * unexpected failures.
 *
 * Token storage
 * -------------
 * JWT access/refresh tokens are stored in `localStorage`.  This is
 * intentional for this SPA — the app has no server-side session and no
 * `httpOnly` cookie mechanism.  Mitigations in place:
 *   - All production traffic is served over HTTPS.
 *   - Content-Security-Policy headers restrict script sources.
 *   - XSS attack surface is minimised by using React's JSX escaping and
 *     the `security.ts` sanitisation helpers for any dynamic HTML.
 */

/** Base URL for all API calls; configurable via VITE_API_BASE env var. */
export const API_BASE =
  (import.meta as unknown as { env: Record<string, string> }).env
    ?.VITE_API_BASE ?? "http://localhost:8001/api";

/** Supported HTTP verbs. */
export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/** Default timeout for every request (milliseconds). */
const REQUEST_TIMEOUT_MS = 30_000;

// ── Token storage ─────────────────────────────────────────────────────────────

/**
 * Return the stored JWT access token, or null if not present.
 * Reads from localStorage on every call so it always reflects the latest value.
 */
function getAccessToken(): string | null {
  return localStorage.getItem("access_token");
}

/**
 * Return the stored JWT refresh token, or null if not present.
 */
function getRefreshToken(): string | null {
  return localStorage.getItem("refresh_token");
}

/**
 * Remove both JWT tokens and emit a custom event so the UserProvider
 * can react (e.g. redirect to login) without a hard import cycle.
 */
export function clearTokens(): void {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  window.dispatchEvent(new CustomEvent("auth:logout"));
}

// ── Structured error ──────────────────────────────────────────────────────────

/**
 * Thrown by `api` and `apiNoAuth` when the server returns a non-2xx status.
 *
 * @example
 * ```ts
 * try {
 *   await api("/auth/me/");
 * } catch (err) {
 *   if (err instanceof ApiError) {
 *     console.error(err.status, err.message);
 *   }
 * }
 * ```
 */
export class ApiError extends Error {
  /** HTTP status code returned by the server. */
  readonly status: number;
  /** Raw response body text (may be JSON or plain text). */
  readonly body: string;

  constructor(status: number, body: string) {
    // Extract a human-readable message from JSON `detail` field if present,
    // otherwise fall back to the raw body or a generic status message.
    let message: string;
    try {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      message =
        typeof parsed.detail === "string"
          ? parsed.detail
          : typeof parsed.message === "string"
          ? parsed.message
          : body || `HTTP ${status}`;
    } catch {
      message = body || `HTTP ${status}`;
    }
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

// ── Refresh token serialisation ────────────────────────────────────────────────

/**
 * In-flight promise for the current token refresh, shared across concurrent
 * requests that hit 401 simultaneously.  Without this guard, two parallel
 * requests would each try to refresh, the second one using the already-
 * rotated (and therefore invalid) refresh token.
 */
let _refreshPromise: Promise<string | null> | null = null;

/**
 * Attempt to obtain a new access token using the stored refresh token.
 * Multiple callers awaiting at the same time share a single network request.
 *
 * @returns The new access token string, or `null` if refresh failed (the
 *          caller should treat the session as expired).
 */
async function refreshAccessToken(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    const refresh = getRefreshToken();
    if (!refresh) return null;

    try {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS,
      );

      const res = await fetch(`${API_BASE}/auth/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        // Refresh token is expired or revoked — force logout.
        clearTokens();
        return null;
      }

      const data = (await res.json()) as { access?: string };
      if (!data?.access) {
        clearTokens();
        return null;
      }

      localStorage.setItem("access_token", data.access);
      return data.access;
    } catch {
      return null;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

// ── Core request helper ────────────────────────────────────────────────────────

/**
 * Low-level fetch wrapper that attaches an Authorization header and enforces
 * a request timeout via AbortController.
 *
 * @param path        Path relative to `API_BASE` (must start with `/`).
 * @param method      HTTP verb.
 * @param body        Request payload — serialised to JSON automatically.
 * @param accessToken JWT access token to attach, or null for anonymous calls.
 * @returns           Raw `Response` object (caller checks `.ok`).
 * @throws            `DOMException` (AbortError) when the timeout fires.
 */
async function request(
  path: string,
  method: HttpMethod,
  body: unknown,
  accessToken: string | null,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  try {
    return await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Make an authenticated API request, automatically refreshing the access
 * token on a 401 response.
 *
 * Clears tokens and fires `auth:logout` if the refresh also fails, so the
 * `UserProvider` can redirect to the login screen.
 *
 * @template T   Expected response body shape.
 * @param path   Path relative to `API_BASE`.
 * @param method HTTP verb (default `"GET"`).
 * @param body   Optional request payload.
 * @returns      Parsed JSON response body cast to `T`.
 * @throws       `ApiError` on non-2xx responses.
 * @throws       `Error`    on network failure or timeout.
 *
 * @example
 * ```ts
 * const profile = await api<Me>("/auth/me/");
 * await api("/auth/me/", "PATCH", { first_name: "Bala" });
 * ```
 */
export async function api<T>(
  path: string,
  method: HttpMethod = "GET",
  body?: unknown,
): Promise<T> {
  const token = getAccessToken();
  let res = await request(path, method, body, token);

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await request(path, method, body, newToken);
    } else {
      // Both access and refresh are invalid — session is over.
      clearTokens();
      throw new ApiError(401, "Session expired. Please sign in again.");
    }
  }

  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, text);
  }

  // 204 No Content has no body — return undefined cast to T.
  if (res.status === 204) return undefined as unknown as T;

  return (await res.json()) as T;
}

/**
 * Make an unauthenticated API request (no Authorization header).
 *
 * Use this for public endpoints: login, register, password reset.
 *
 * @template T   Expected response body shape.
 * @param path   Path relative to `API_BASE`.
 * @param method HTTP verb (default `"GET"`).
 * @param body   Optional request payload.
 * @returns      Parsed JSON response body cast to `T`.
 * @throws       `ApiError` on non-2xx responses.
 *
 * @example
 * ```ts
 * const tokens = await apiNoAuth<{ access: string; refresh: string }>(
 *   "/auth/token/", "POST", { username, password }
 * );
 * ```
 */
export async function apiNoAuth<T>(
  path: string,
  method: HttpMethod = "GET",
  body?: unknown,
): Promise<T> {
  const res = await request(path, method, body, null);

  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, text);
  }

  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

/**
 * User authentication state — React context + provider.
 *
 * Provides a `UserProvider` that wraps the application and a `useMe` hook
 * for accessing the authenticated user from any component.
 *
 * Authentication flow
 * -------------------
 * 1. On mount, `UserProvider` calls `/api/auth/me/` to rehydrate the session
 *    from tokens already in `localStorage` (supports page refresh).
 * 2. `login(username, password)` exchanges credentials for JWT tokens, stores
 *    them, then fetches the full `Me` profile.
 * 3. `logout()` clears tokens and nulls the user state.  The `clearTokens`
 *    helper in `client.ts` also dispatches an `auth:logout` DOM event so any
 *    expired-session 401 can trigger a logout without importing this module.
 *
 * Error states
 * ------------
 * `authError` is set when a login fails (wrong credentials, network error).
 * It is cleared automatically at the start of the next `login` call.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, apiNoAuth, ApiError, clearTokens } from "../api/client";
import type { Me } from "../../types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LoginResult {
  access: string;
  refresh: string;
}

/**
 * Shape of the value exposed by `UserProvider` and consumed via `useMe`.
 */
interface UserState {
  /** The authenticated user's profile, or `null` when not logged in. */
  me: Me | null;
  /** True while the initial session rehydration is in progress. */
  loading: boolean;
  /** Non-null after a failed login attempt; cleared on the next attempt. */
  authError: string | null;
  /** Re-fetch `/api/auth/me/` and update the `me` state. */
  refresh: () => Promise<void>;
  /** Authenticate with username + password and load the user profile. */
  login: (username: string, password: string) => Promise<void>;
  /** Clear tokens and reset user state to unauthenticated. */
  logout: () => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const Ctx = createContext<UserState | null>(null);

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Persist both JWT tokens to `localStorage`.
 * Called once after a successful login or token exchange.
 */
function setTokens(tokens: LoginResult): void {
  localStorage.setItem("access_token", tokens.access);
  localStorage.setItem("refresh_token", tokens.refresh);
}

// ── Provider ──────────────────────────────────────────────────────────────────

/**
 * Provides authentication state to the entire component tree.
 * Place this near the root of the app, above any component that calls `useMe`.
 */
export function UserProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  /**
   * Fetch the current user's profile from `/api/auth/me/`.
   * Sets `me` to `null` when the request fails (token invalid/expired).
   */
  const refresh = useCallback(async (): Promise<void> => {
    try {
      const data = await api<Me>("/auth/me/");
      setMe(data);
    } catch {
      // Token is invalid or expired — user is not authenticated.
      setMe(null);
    }
  }, []);

  /**
   * Exchange username/password for JWT tokens, persist them, then load
   * the full user profile.
   *
   * @throws Re-throws `ApiError` so the login form can display the message.
   */
  const login = useCallback(
    async (username: string, password: string): Promise<void> => {
      setAuthError(null);
      try {
        const tokens = await apiNoAuth<LoginResult>("/auth/token/", "POST", {
          username,
          password,
        });
        setTokens(tokens);
        await refresh();
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : "Login failed. Please try again.";
        setAuthError(message);
        throw err; // propagate so form can handle it too
      }
    },
    [refresh],
  );

  /**
   * Clear all auth tokens and reset to the unauthenticated state.
   * The `clearTokens` helper also fires an `auth:logout` event so any
   * active request loops can terminate.
   */
  const logout = useCallback((): void => {
    clearTokens();
    setMe(null);
    setAuthError(null);
  }, []);

  // Rehydrate session on mount.
  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  // Listen for `auth:logout` events dispatched by the API client when a
  // token refresh fails — this handles expired sessions that happen mid-session.
  useEffect(() => {
    const handler = (): void => {
      setMe(null);
      setAuthError(null);
    };
    window.addEventListener("auth:logout", handler);
    return () => window.removeEventListener("auth:logout", handler);
  }, []);

  const value = useMemo<UserState>(
    () => ({ me, loading, authError, refresh, login, logout }),
    [me, loading, authError, refresh, login, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Access the authenticated user state from any component.
 *
 * @throws When called outside of a `UserProvider` tree.
 *
 * @example
 * ```tsx
 * const { me, login, logout } = useMe();
 * if (!me) return <LoginForm />;
 * return <h1>Welcome, {me.username}</h1>;
 * ```
 */
export function useMe(): UserState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMe must be used within <UserProvider>");
  return v;
}

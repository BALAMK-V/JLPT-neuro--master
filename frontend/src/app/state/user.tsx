import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, apiNoAuth } from "../api/client";
import type { Me } from "../../types";

type LoginResult = { access: string; refresh: string };

type UserState = {
  me: Me | null;
  refresh: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

const Ctx = createContext<UserState | null>(null);

function setTokens(tokens: LoginResult) {
  localStorage.setItem("access_token", tokens.access);
  localStorage.setItem("refresh_token", tokens.refresh);
}

function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);

  const refresh = async () => {
    try {
      const data = await api<Me>("/auth/me/");
      setMe(data);
    } catch {
      setMe(null);
    }
  };

  const login = async (username: string, password: string) => {
    const tokens = await apiNoAuth<LoginResult>("/auth/token/", "POST", { username, password });
    setTokens(tokens);
    await refresh();
  };

  const logout = () => {
    clearTokens();
    setMe(null);
  };

  useEffect(() => {
    refresh();
  }, []);

  const value = useMemo(() => ({ me, refresh, login, logout }), [me]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMe() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMe must be used within UserProvider");
  return v;
}

"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getMe, logout, type SessionResponse, type SessionScope, type User } from "@/lib/api/auth";

type AuthState =
  | { status: "loading"; user: null; scope: null }
  | { status: "anonymous"; user: null; scope: null }
  | { status: "authenticated"; user: User; scope: SessionScope };

type AuthContextValue = AuthState & {
  /** True only for a session started at the administrator sign-in. */
  isAdmin: boolean;
  /** Call after the API has started a session (sign-in, email verification). */
  setSession: (response: SessionResponse) => void;
  signOut: () => Promise<void>;
};

const anonymous: AuthState = { status: "anonymous", user: null, scope: null };

const fromResponse = ({ user, session }: SessionResponse): AuthState => ({
  status: "authenticated",
  user,
  scope: session?.scope ?? "customer",
});

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Loads the signed-in user once on the client. Public pages stay statically
 * rendered; only the parts that depend on the session wait for this.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading", user: null, scope: null });

  useEffect(() => {
    let cancelled = false;
    getMe().then((result) => {
      if (!cancelled) setState(result.ok ? fromResponse(result.data) : anonymous);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setSession = useCallback((response: SessionResponse) => setState(fromResponse(response)), []);

  const signOut = useCallback(async () => {
    await logout();
    setState(anonymous);
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      isAdmin: state.scope === "admin" && state.user.platform_roles.length > 0,
      setSession,
      signOut,
    }),
    [state, setSession, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getMe, logout, type User } from "@/lib/api/auth";

type AuthState =
  | { status: "loading"; user: null }
  | { status: "anonymous"; user: null }
  | { status: "authenticated"; user: User };

type AuthContextValue = AuthState & {
  /** Call after the API has started a session (login, email verification). */
  setUser: (user: User) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Loads the signed-in user once on the client. Public pages stay statically
 * rendered; only the parts that depend on the session wait for this.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading", user: null });

  useEffect(() => {
    let cancelled = false;
    getMe().then((result) => {
      if (cancelled) return;
      setState(
        result.ok
          ? { status: "authenticated", user: result.data.user }
          : { status: "anonymous", user: null },
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setUser = useCallback((user: User) => setState({ status: "authenticated", user }), []);

  const signOut = useCallback(async () => {
    await logout();
    setState({ status: "anonymous", user: null });
  }, []);

  const value = useMemo(() => ({ ...state, setUser, signOut }), [state, setUser, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

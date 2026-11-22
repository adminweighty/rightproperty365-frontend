"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getMe, logout, type SessionResponse, type SessionScope, type User } from "@/lib/api/auth";
import type { PendingLegalAcceptance } from "@/lib/legal-versions";
import { restoreDisplayZone, setDisplayZone } from "@/lib/display-zone";

type AuthState =
  | { status: "loading"; user: null; scope: null; mfaEnrolmentRequired: false }
  | { status: "anonymous"; user: null; scope: null; mfaEnrolmentRequired: false }
  | {
      status: "authenticated";
      user: User;
      scope: SessionScope;
      /** An administrator session that may only set up two-step verification (API 0.40.0). */
      mfaEnrolmentRequired: boolean;
      /** Legal versions to accept again (API 0.43.0). Usually empty; only `GET /v1/me` reports them. */
      pendingLegalAcceptances: PendingLegalAcceptance[];
    };

type AuthContextValue = AuthState & {
  /** True only for a session started at the administrator sign-in. */
  isAdmin: boolean;
  /** Call after the API has started a session (sign-in, email verification). */
  setSession: (response: SessionResponse) => void;
  /** Reads the user again, after something changed their roles (an onboarding step). */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const anonymous: AuthState = { status: "anonymous", user: null, scope: null, mfaEnrolmentRequired: false };

const fromResponse = ({ user, session, pending_legal_acceptances }: SessionResponse): AuthState => ({
  status: "authenticated",
  user,
  scope: session?.scope ?? "customer",
  mfaEnrolmentRequired: session?.mfa_enrolment_required === true,
  pendingLegalAcceptances: Array.isArray(pending_legal_acceptances) ? pending_legal_acceptances : [],
});

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Loads the signed-in user once on the client. Public pages stay statically
 * rendered; only the parts that depend on the session wait for this.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading", user: null, scope: null, mfaEnrolmentRequired: false });

  // The display zone (API 0.62.0) every time on the page uses: the last one
  // known in this browser at once, then the account's.
  useEffect(() => {
    if (state.status === "authenticated") setDisplayZone(state.user.time_zone ?? {});
    else if (state.status === "anonymous") setDisplayZone(null);
  }, [state]);

  useEffect(() => {
    restoreDisplayZone();
    let cancelled = false;
    getMe().then((result) => {
      if (!cancelled) setState(result.ok ? fromResponse(result.data) : anonymous);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setSession = useCallback((response: SessionResponse) => {
    setState(fromResponse(response));
    // The sign-in answers do not carry `pending_legal_acceptances`: read them from /v1/me.
    if (!Array.isArray(response.pending_legal_acceptances)) {
      getMe().then((result) => {
        if (result.ok) setState(fromResponse(result.data));
      });
    }
  }, []);

  const refresh = useCallback(async () => {
    const result = await getMe();
    if (result.ok) setState(fromResponse(result.data));
  }, []);

  const signOut = useCallback(async () => {
    await logout();
    setState(anonymous);
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      isAdmin: state.scope === "admin" && state.user.platform_roles.length > 0,
      setSession,
      refresh,
      signOut,
    }),
    [state, setSession, refresh, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

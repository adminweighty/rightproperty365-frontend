"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Toast } from "@/components/ui/toast";
import { listSavedListingIds, saveListing, unsaveListing } from "@/lib/api/saved-listings";
import { signInHref } from "@/lib/portal";
import { saveFailureMessage, withSaved } from "@/lib/saved-listings";

type SavedListingsValue = {
  /**
   * "off": nobody signed in, or a session that cannot save (an administrator);
   * "loading": the saved ids are on their way; "ready": `isSaved` is true to the API.
   */
  status: "off" | "loading" | "ready";
  /** False for administrator sessions: they cannot save, so no heart is shown. */
  canSave: boolean;
  isSaved: (listingId: string) => boolean;
  /**
   * Saves or removes a listing. Signed out, it goes to sign-in and comes back
   * to this page. The heart changes at once and goes back, with a message,
   * if the API refuses.
   */
  toggle: (listing: { id: string; title: string }) => void;
  /** Tells the hearts that a listing was removed elsewhere (the Saved list's own Remove). */
  forget: (listingId: string) => void;
};

const SavedListingsContext = createContext<SavedListingsValue | null>(null);

/** The ids of one account, so a different account never sees another's hearts. */
type Loaded = { userId: string; ids: Set<string> };

/**
 * Which listings the signed-in person saved, read once in the browser from
 * `GET /v1/me/saved-listings/ids` when the session is known. Nothing personal
 * is ever read on the server: listing pages and cards stay cached and the
 * same for everyone, and every heart starts empty and fills in here.
 */
export function SavedListingsProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const userId = auth.status === "authenticated" && auth.scope === "customer" ? auth.user.id : null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  /** Listings with a change on its way: a second press waits for the first answer. */
  const inFlight = useRef(new Set<string>());

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    listSavedListingIds().then((result) => {
      if (cancelled) return;
      // When the ids cannot be read the hearts stay empty; pressing one still saves.
      setLoaded({ userId, ids: new Set(result.ok ? result.data.ids : []) });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const current = userId && loaded?.userId === userId ? loaded : null;
  const status: SavedListingsValue["status"] = !userId ? "off" : current ? "ready" : "loading";

  const setOne = useCallback(
    (id: string, saved: boolean) => {
      if (!userId) return;
      setLoaded((value) => ({ userId, ids: withSaved(value?.userId === userId ? value.ids : new Set(), id, saved) }));
    },
    [userId],
  );

  const isSaved = useCallback((listingId: string) => Boolean(current?.ids.has(listingId)), [current]);

  const toggle = useCallback(
    ({ id, title }: { id: string; title: string }) => {
      if (auth.status === "loading") return;
      if (auth.status === "anonymous") {
        router.push(signInHref(`${window.location.pathname}${window.location.search}`));
        return;
      }
      if (!userId || inFlight.current.has(id)) return;

      const saving = !current?.ids.has(id);
      inFlight.current.add(id);
      setMessage(null);
      setOne(id, saving);
      (saving ? saveListing(id) : unsaveListing(id)).then((result) => {
        inFlight.current.delete(id);
        if (result.ok) return;
        setOne(id, !saving);
        setMessage(saveFailureMessage(result.failure, { saving, title }));
      });
    },
    [auth.status, router, userId, current, setOne],
  );

  const forget = useCallback((listingId: string) => setOne(listingId, false), [setOne]);

  const value = useMemo<SavedListingsValue>(
    () => ({
      status,
      canSave: !(auth.status === "authenticated" && auth.scope !== "customer"),
      isSaved,
      toggle,
      forget,
    }),
    [status, auth.status, auth.scope, isSaved, toggle, forget],
  );

  return (
    <SavedListingsContext.Provider value={value}>
      {children}
      <Toast message={message} onDismiss={() => setMessage(null)} />
    </SavedListingsContext.Provider>
  );
}

export function useSavedListings(): SavedListingsValue {
  const value = useContext(SavedListingsContext);
  if (!value) throw new Error("useSavedListings must be used inside SavedListingsProvider");
  return value;
}

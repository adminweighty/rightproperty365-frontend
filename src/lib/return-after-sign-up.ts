import { safeNextPath } from "@/lib/portal";

/**
 * Where to go once a new account's email address is confirmed.
 *
 * Sign-in carries `?next=` itself. Sign-up cannot: the confirmation link is
 * written by the API and opened from the email, often in another tab. So
 * the register page keeps its `next` in this browser's storage, and the
 * confirmation page uses it once and forgets it. Only a path on this site
 * (`safeNextPath`) is ever kept or followed, and only for a day, as long as
 * the confirmation link works.
 */

const KEY = "rp365:after-sign-up";
const LIFETIME_MS = 24 * 60 * 60 * 1000;

export function rememberAfterSignUp(next: string | null | undefined): void {
  const path = safeNextPath(next);
  try {
    if (path) window.localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Storage can be blocked (private windows); the person then lands on the dashboard.
  }
}

/** The remembered path, if any and still fresh. It is removed either way. */
export function takeAfterSignUp(): string | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    window.localStorage.removeItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { path?: unknown; at?: unknown };
    if (typeof saved.path !== "string" || typeof saved.at !== "number") return null;
    if (Date.now() - saved.at > LIFETIME_MS) return null;
    return safeNextPath(saved.path);
  } catch {
    return null;
  }
}

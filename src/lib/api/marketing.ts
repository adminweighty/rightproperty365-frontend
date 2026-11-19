import { apiFetch, type ApiResult } from "@/lib/api/http";
import {
  marketingPutBody,
  readMarketingPreferences,
  type MarketingPreferences,
} from "@/lib/marketing-preferences";

/**
 * The signed-in person's marketing choice (API 0.37.1). Read only in the
 * browser, with the session cookie, and never cached. Every answer goes
 * through the tolerant reader in `src/lib/marketing-preferences.ts`; an
 * answer without a boolean `marketing_opt_in` is treated as a failure.
 */

export type { MarketingPreferences } from "@/lib/marketing-preferences";

const unreadable = {
  code: "UNREADABLE_ANSWER",
  status: 0,
  message: "Something went wrong on our side. Please try again.",
};

function toPreferences(result: ApiResult<unknown>): ApiResult<MarketingPreferences> {
  if (!result.ok) return result;
  const prefs = readMarketingPreferences(result.data);
  return prefs ? { ok: true, status: result.status, data: prefs } : { ok: false, failure: unreadable };
}

/** The current choice, the wording to show, and the last 20 changes. */
export const getMarketingPreferences = async (): Promise<ApiResult<MarketingPreferences>> =>
  toPreferences(await apiFetch<unknown>("/v1/me/marketing-preferences", { cache: "no-store", headers: { "X-Client": "web" } }));

/**
 * Switches marketing on (with the version of the wording shown) or off.
 * `X-Client: web` is recorded as the change's source. A stale version is
 * 400 `VALIDATION_FAILED` on `consent_text_version`; a value the account
 * already has records nothing and answers the current state.
 */
export const saveMarketingPreference = async (optIn: boolean, shownVersion: string | null): Promise<ApiResult<MarketingPreferences>> =>
  toPreferences(
    await apiFetch<unknown>("/v1/me/marketing-preferences", {
      method: "PUT",
      body: marketingPutBody(optIn, shownVersion),
      headers: { "X-Client": "web" },
      cache: "no-store",
    }),
  );

/**
 * The campaign a visit came from (API 0.58.0, FR-013): utm_source,
 * utm_medium and utm_campaign of the page the visitor landed on. Pure, so
 * `npm test` checks it in Node (scripts/campaign.test.mjs); the browser side
 * is in `src/lib/analytics/tracker.ts`.
 *
 * Nothing else of the address is kept (no term, content, click identifiers
 * or referrer), and nothing at all under Do Not Track or Global Privacy
 * Control. The API cleans the values again and has the last word.
 */

export type Campaign = { source: string; medium: string; campaign: string };

/** Where the campaign of this browser session is kept (sessionStorage). */
export const CAMPAIGN_KEY = "rp_campaign";

/** The longest value kept, in characters. */
export const CAMPAIGN_MAX = 100;

const KEPT = /[\p{L}\p{N}._\-+:/]/u;

/** One value as the API stores it: lower case, spaces collapsed, a short list of characters, at most 100. */
export function cleanCampaignValue(raw: string | null | undefined): string {
  if (!raw) return "";
  const words: string[] = [];
  for (const word of raw.toLowerCase().trim().split(/\s+/)) {
    const kept = [...word].filter((ch) => KEPT.test(ch)).join("");
    if (kept) words.push(kept);
  }
  return [...words.join(" ")].slice(0, CAMPAIGN_MAX).join("").trimEnd();
}

const isEmpty = (c: Campaign) => !c.source && !c.medium && !c.campaign;

/**
 * The campaign of a landing address (`location.search`), or null when it has
 * no UTM parameters left after cleaning.
 */
export function campaignFromSearch(search: string): Campaign | null {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return null;
  }
  const campaign = {
    source: cleanCampaignValue(params.get("utm_source")),
    medium: cleanCampaignValue(params.get("utm_medium")),
    campaign: cleanCampaignValue(params.get("utm_campaign")),
  };
  return isEmpty(campaign) ? null : campaign;
}

/** Reads what `CAMPAIGN_KEY` holds; anything unexpected is no campaign. */
export function readStoredCampaign(stored: string | null | undefined): Campaign | null {
  if (!stored) return null;
  try {
    const value: unknown = JSON.parse(stored);
    if (!value || typeof value !== "object") return null;
    const v = value as Record<string, unknown>;
    const campaign = {
      source: cleanCampaignValue(typeof v.source === "string" ? v.source : ""),
      medium: cleanCampaignValue(typeof v.medium === "string" ? v.medium : ""),
      campaign: cleanCampaignValue(typeof v.campaign === "string" ? v.campaign : ""),
    };
    return isEmpty(campaign) ? null : campaign;
  } catch {
    return null;
  }
}

/**
 * The campaign to keep after landing on `search`: a new one replaces the
 * stored one; an address without UTM parameters keeps what was there.
 */
export function nextCampaign(search: string, stored: string | null | undefined): Campaign | null {
  return campaignFromSearch(search) ?? readStoredCampaign(stored);
}

/** "facebook · cpc · spring sale", for the lead view and the funnel. */
export function campaignLabel(campaign: Partial<Campaign> | null | undefined): string {
  if (!campaign) return "No campaign";
  const parts = [campaign.source, campaign.medium, campaign.campaign].filter((part) => part);
  return parts.length ? parts.join(" · ") : "No campaign";
}

/** Saved search wording (API 0.52.0). Self-contained so `npm test` runs it. */

export type AlertFrequency = "INSTANT" | "DAILY" | "WEEKLY" | "OFF";

export const FREQUENCIES: { value: AlertFrequency; label: string; hint: string }[] = [
  { value: "INSTANT", label: "As soon as they are listed", hint: "Checked every few minutes." },
  { value: "DAILY", label: "Once a day", hint: "One email a day at most." },
  { value: "WEEKLY", label: "Once a week", hint: "One email a week at most." },
  { value: "OFF", label: "No alerts", hint: "Keep the search without emails." },
];

export function frequencyLabel(f: string): string {
  return FREQUENCIES.find((x) => x.value === f)?.label ?? f;
}

/** The search's page: /listings with its query. */
export function searchHref(query: string): string {
  const q = query.replace(/^\?/, "");
  return q ? `/listings?${q}` : "/listings";
}

/** A saved search's name from the page heading: trimmed to the API's 80 characters. */
export function defaultSearchName(heading: string): string {
  const name = heading.replace(/\s+/g, " ").trim() || "My search";
  return name.length > 80 ? `${name.slice(0, 79).trimEnd()}…` : name;
}

/** The wording of a saved search API error code. */
export function savedSearchErrorText(code: string | undefined): string | null {
  switch (code) {
    case "SAVED_SEARCH_LIMIT":
      return "You already have 25 saved searches. Delete one on your saved searches page first.";
    case "SAVED_SEARCH_NOT_FOUND":
      return "This saved search no longer exists.";
    case "INVALID_TOKEN":
      return "This link is not valid. Manage your alerts on your saved searches page instead.";
    case "RATE_LIMITED":
      return "Too many changes in a short time. Wait a minute and try again.";
    default:
      return null;
  }
}

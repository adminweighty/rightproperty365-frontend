/**
 * The rules of the listing manager and editor that are not the API's to
 * decide: the order and wording of statuses, which buttons a listing's
 * `actions` become, the banner a status shows, and how typed values are
 * checked before they are saved.
 *
 * Pure functions with no imports, so `npm test` (scripts/listing-manage.test.mjs)
 * runs them directly. What a person may do always comes from the API's
 * `actions`; nothing here grants an action the API did not list.
 */

/** Every listing status (`ListingStatus` in the OpenAPI), in the order the manager's tabs use. */
export const LISTING_STATUSES = [
  "DRAFT",
  "CHANGES_REQUESTED",
  "PENDING_REVIEW",
  "PUBLISHED",
  "REJECTED",
  "EXPIRED",
  "ARCHIVED",
  "PAUSED",
  "SOLD",
  "LET",
  "CLOSED",
] as const;

export type ListingStatus = (typeof LISTING_STATUSES)[number];

/** Tabs shown even with nothing in them: the statuses an advertiser works through. */
const ALWAYS_SHOWN = new Set<string>(["DRAFT", "CHANGES_REQUESTED", "PENDING_REVIEW", "PUBLISHED", "ARCHIVED"]);

/**
 * Words for a status where the API sent none (the list summary has no
 * label). A full listing carries the API's own `status_label`, which wins.
 */
export const listingStatusLabels: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Waiting for review",
  CHANGES_REQUESTED: "Changes requested",
  REJECTED: "Rejected",
  PUBLISHED: "Published",
  EXPIRED: "Expired",
  ARCHIVED: "Archived",
  PAUSED: "Paused",
  SOLD: "Sold",
  LET: "Let",
  CLOSED: "Closed",
};

export const listingStatusLabel = (status: string, apiLabel?: string | null) =>
  apiLabel || listingStatusLabels[status] || status;

export type Tone = "neutral" | "info" | "warning" | "success" | "danger";

/** Never colour alone: the badge always carries the status in words. */
export function listingStatusTone(status: string): Tone {
  switch (status) {
    case "PUBLISHED":
      return "success";
    case "PENDING_REVIEW":
      return "info";
    case "CHANGES_REQUESTED":
    case "EXPIRED":
      return "warning";
    case "REJECTED":
      return "danger";
    default:
      return "neutral";
  }
}

export const isListingStatus = (value: string | null | undefined): value is ListingStatus =>
  typeof value === "string" && (LISTING_STATUSES as readonly string[]).includes(value);

/** How many listings have each status. */
export function countByStatus(items: readonly { status: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) counts[item.status] = (counts[item.status] ?? 0) + 1;
  return counts;
}

export type StatusTab = { status: string; label: string; count: number };

/** "All" first, then the usual statuses, then any other status that has listings. */
export function statusTabs(counts: Record<string, number>, total: number): StatusTab[] {
  const tabs: StatusTab[] = [{ status: "", label: "All", count: total }];
  for (const status of LISTING_STATUSES) {
    const count = counts[status] ?? 0;
    if (ALWAYS_SHOWN.has(status) || count > 0) tabs.push({ status, label: listingStatusLabels[status], count });
  }
  return tabs;
}

/** The manager's address for a status tab and page; defaults are left out. */
export function listingManagerHref(status: string = "", page = 1): string {
  const query = new URLSearchParams();
  if (status) query.set("status", status);
  if (page > 1) query.set("page", String(page));
  const text = query.toString();
  return text ? `/agent/listings?${text}` : "/agent/listings";
}

// ---- Actions ----------------------------------------------------------------

export type ListingAction = "edit" | "submit" | "archive" | "relist" | "delete";

export type ActionButton = {
  action: Exclude<ListingAction, "edit">;
  label: string;
  variant: "primary" | "secondary" | "danger";
  /** Asks first: it takes the listing offline or cannot be undone. */
  confirm: boolean;
  /** Shown but not usable (submit before the listing is complete), with the reason. */
  disabledReason?: string;
};

/**
 * The buttons for what the API says the caller may do now (`actions`), in a
 * fixed order: send for review first, delete last. `edit` is not a button
 * (it is the editor itself, or the "Edit" link of a row).
 */
export function listingActionButtons({
  actions,
  ready,
  publishedWithChanges = false,
}: {
  actions: readonly string[];
  /** `completeness.ready`. */
  ready: boolean;
  /** A published listing whose pending changes would be sent. */
  publishedWithChanges?: boolean;
}): ActionButton[] {
  const has = (action: ListingAction) => actions.includes(action);
  const buttons: ActionButton[] = [];
  if (has("submit")) {
    buttons.push({
      action: "submit",
      label: publishedWithChanges ? "Send changes for review" : "Submit for review",
      variant: "primary",
      confirm: false,
      disabledReason: ready ? undefined : "Complete the items under “Still needed” first.",
    });
  }
  if (has("relist")) buttons.push({ action: "relist", label: "Relist", variant: "secondary", confirm: true });
  if (has("archive")) buttons.push({ action: "archive", label: "Archive", variant: "secondary", confirm: true });
  if (has("delete")) buttons.push({ action: "delete", label: "Delete", variant: "danger", confirm: true });
  return buttons;
}

/** The row link's words: change it, or only look at it. */
export const editLinkLabel = (actions: readonly string[] | undefined) =>
  actions === undefined || actions.includes("edit") ? "Edit" : "View";

/** What a confirmation says before an action. */
export function confirmText(action: ActionButton["action"], wasPublic: boolean): { title: string; body: string; confirm: string } {
  switch (action) {
    case "archive":
      return {
        title: "Archive this listing?",
        body: wasPublic
          ? "Visitors will no longer see it. You can relist it later; it is then reviewed again before it is public."
          : "It moves to Archived and is no longer reviewed. You can relist it later.",
        confirm: "Yes, archive it",
      };
    case "relist":
      return {
        title: "Relist this listing?",
        body: wasPublic
          ? "It goes back to our review team. Once approved it is public again for 90 days."
          : "It goes back to Draft, so you can finish it and submit it for review.",
        confirm: "Yes, relist it",
      };
    case "delete":
      return {
        title: "Delete this listing?",
        body: "The listing and all its photos are removed for good. This cannot be undone.",
        confirm: "Yes, delete it",
      };
    default:
      return { title: "Send this listing for review?", body: "", confirm: "Submit for review" };
  }
}

// ---- Banners ----------------------------------------------------------------

export type PendingChangesLike = { status: string; reason: string | null } | null | undefined;

export type Banner = { tone: "info" | "warning" | "danger" | "success"; title: string; body: string; reason?: string };

/** The message at the top of the editor for where the listing stands. */
export function listingBanner(listing: {
  status: string;
  public: boolean;
  review: { reason: string | null };
  pending_changes: PendingChangesLike;
}): Banner | null {
  const pending = listing.pending_changes;
  switch (listing.status) {
    case "PENDING_REVIEW":
      return {
        tone: "info",
        title: "We are reviewing this listing",
        body: "It cannot be changed while it waits for review. We will email you when a decision is made. To change something now, archive it, relist it and submit it again.",
      };
    case "CHANGES_REQUESTED":
      return {
        tone: "warning",
        title: "Our review team asked for changes",
        body: "Make the changes, then submit the listing for review again.",
        reason: listing.review.reason ?? undefined,
      };
    case "REJECTED":
      return {
        tone: "danger",
        title: "This listing was not approved",
        body: "A rejected listing cannot be changed or published. You can delete it.",
        reason: listing.review.reason ?? undefined,
      };
    case "EXPIRED":
      return {
        tone: "warning",
        title: "This listing has expired",
        body: "Its 90 days are over and visitors no longer see it. Relist it to send it for review again.",
      };
    case "ARCHIVED":
      return {
        tone: "info",
        title: "This listing is archived",
        body: "Visitors do not see it. Relist it to bring it back.",
      };
    case "PUBLISHED":
      if (!pending) {
        return {
          tone: "success",
          title: "This listing is public",
          body: "Changes you make here are reviewed before visitors see them. Until then they see the approved version.",
        };
      }
      switch (pending.status) {
        case "PENDING_REVIEW":
          return {
            tone: "info",
            title: "We are reviewing your changes",
            body: "Visitors still see the approved version. Your changes cannot be edited while they wait for review.",
          };
        case "CHANGES_REQUESTED":
          return {
            tone: "warning",
            title: "Our review team asked for changes",
            body: "Visitors still see the approved version. Make the changes, then send them for review again.",
            reason: pending.reason ?? undefined,
          };
        case "REJECTED":
          return {
            tone: "danger",
            title: "Your last changes were not approved",
            body: "Visitors still see the approved version. Editing again starts new changes.",
            reason: pending.reason ?? undefined,
          };
        default:
          return {
            tone: "info",
            title: "Your changes are not public yet",
            body: "Visitors see the approved version until our review team approves your changes. Send them for review when they are ready.",
          };
      }
    default:
      return null;
  }
}

/** The second badge of a row: changes of a published listing that are not public yet. */
export function pendingChangesBadge(pending: PendingChangesLike): { text: string; tone: Tone } | null {
  if (!pending) return null;
  switch (pending.status) {
    case "PENDING_REVIEW":
      return { text: "Changes waiting for review", tone: "info" };
    case "CHANGES_REQUESTED":
      return { text: "Changes requested", tone: "warning" };
    case "REJECTED":
      return { text: "Changes not approved", tone: "danger" };
    default:
      return { text: "Changes not sent yet", tone: "neutral" };
  }
}

// ---- Review -----------------------------------------------------------------

/** What each field of a listing is called, for the reviewer's before and after table. */
export const listingFieldLabels: Record<string, string> = {
  title: "Title",
  summary: "Summary",
  description: "Description",
  deal: "For sale or to rent",
  category: "Category",
  property_type: "Property type",
  price: "Price",
  price_period: "Charged",
  country: "Country",
  city: "City or town",
  suburb: "Suburb",
  city_name: "City or town (typed)",
  region_name: "Region or province (typed)",
  bedrooms: "Bedrooms",
  bathrooms: "Bathrooms",
  floor_area: "Floor area",
  land_area: "Land area",
  features: "Features",
  max_guests: "Guests, at most",
  min_nights: "Shortest stay",
};

/** The statuses a reviewer filters the queue by, the default first. */
export const REVIEW_QUEUE_STATUSES = ["PENDING_REVIEW", "CHANGES_REQUESTED", "REJECTED", "PUBLISHED", "DRAFT", "ARCHIVED", "EXPIRED"] as const;

/** A reviewer's reason: required, plain text, at most 1000 characters. Null when it is fine. */
export function reviewReasonProblem(reason: string): string | null {
  const text = reason.trim();
  if (text === "") return "Write the reason. The advertiser sees it and it is emailed to them.";
  if (text.length > 1000) return `Keep the reason to 1000 characters or fewer (it has ${text.length}).`;
  return null;
}

// ---- Fields -----------------------------------------------------------------

/** The id of the control for each field `completeness.missing` and the API's errors name. */
const FIELD_CONTROLS: Record<string, string> = {
  title: "listing-title",
  summary: "listing-summary",
  description: "listing-description",
  deal: "listing-deal",
  category: "listing-category",
  property_type: "listing-property-type",
  price: "listing-price-amount",
  "price.amount": "listing-price-amount",
  "price.currency": "listing-price-currency",
  price_period: "listing-price-period",
  country: "listing-country",
  city: "listing-city",
  city_name: "listing-city-name",
  region_name: "listing-region-name",
  suburb: "listing-suburb",
  bedrooms: "listing-bedrooms",
  bathrooms: "listing-bathrooms",
  floor_area: "listing-floor-area",
  land_area: "listing-land-area",
  features: "listing-features",
  max_guests: "listing-max-guests",
  min_nights: "listing-min-nights",
  photos: "listing-photos",
};

/** The control to move focus to for a field name, or the photo section for anything about photos. */
export function fieldControlId(field: string): string | null {
  if (FIELD_CONTROLS[field]) return FIELD_CONTROLS[field];
  if (field.startsWith("photos")) return FIELD_CONTROLS.photos;
  const base = field.split(/[.[]/)[0];
  return FIELD_CONTROLS[base] ?? null;
}

/** The field a control saves (`price.amount` belongs to `price`). */
export const fieldOf = (name: string) => (name.startsWith("price.") ? "price" : name.split(/[.[]/)[0]);

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

/** A whole number in a range, or null for an empty box. */
export function parseWholeNumber(text: string, label: string, min: number, max?: number): Parsed<number | null> {
  const value = text.trim();
  if (value === "") return { ok: true, value: null };
  if (!/^\d+$/.test(value)) return { ok: false, message: `Enter ${label} as a whole number, such as ${Math.max(min, 3)}.` };
  const number = Number(value);
  if (number < min) return { ok: false, message: `Enter ${label} of at least ${min}.` };
  if (max !== undefined && number > max) return { ok: false, message: `Enter ${label} of at most ${max}.` };
  return { ok: true, value: number };
}

/**
 * A price as the API takes it: digits with at most two decimals ("385000",
 * "950.50"). Spaces and thousands separators people type are removed. Null
 * for an empty box. The amount stays a string: never float arithmetic on money.
 */
export function parseAmount(text: string): Parsed<string | null> {
  const value = text.replace(/[\s,]/g, "");
  if (value === "") return { ok: true, value: null };
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    return { ok: false, message: "Enter the price in numbers, with at most two decimals, such as 250000 or 950.50." };
  }
  return { ok: true, value };
}

/** "385000.00" as the box shows it: "385000"; "950.50" stays. */
export function amountForInput(amount: string | null | undefined): string {
  if (!amount) return "";
  return amount.endsWith(".00") ? amount.slice(0, -3) : amount;
}

/** "Saved at 14:02" in the viewer's time zone. */
export function savedAtText(at: Date): string {
  const hh = String(at.getHours()).padStart(2, "0");
  const mm = String(at.getMinutes()).padStart(2, "0");
  return `Saved at ${hh}:${mm}`;
}

/** Words for a timeline entry. */
export function timelineText(entry: { action: string; review_kind: string | null }): string {
  const edit = entry.review_kind === "EDIT";
  switch (entry.action) {
    case "CREATED":
      return "Created";
    case "SUBMITTED":
      return edit ? "Changes sent for review" : "Sent for review";
    case "APPROVED":
      return edit ? "Changes approved" : "Approved and published";
    case "CHANGES_REQUESTED":
      return "Changes requested";
    case "REJECTED":
      return edit ? "Changes not approved" : "Rejected";
    case "ARCHIVED":
      return "Archived";
    case "RELISTED":
      return "Relisted";
    default:
      return entry.action;
  }
}

import { apiFetch, type ApiFailure, type ApiResult } from "@/lib/api/http";
import type { ListingAdvertiser } from "@/lib/api/types";
import { env } from "@/lib/env";

/**
 * Browser clients for listings managed by their advertisers and reviewed by
 * platform reviewers (new in API 0.22.0). Every call carries the session
 * cookie; the API decides who may do what and says so in `actions`.
 */

/** The content in the shape a PATCH sends it back: codes, not labels. */
export type ListingContent = {
  title: string;
  summary: string;
  description: string;
  deal: string | null;
  category: string | null;
  property_type: string | null;
  price: { amount: string | null; currency: string | null };
  price_period: string | null;
  country: string | null;
  city: string | null;
  suburb: string | null;
  city_name: string | null;
  region_name: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floor_area: number | null;
  land_area: number | null;
  features: string[];
  max_guests: number | null;
  min_nights: number | null;
  /**
   * The video tour (API 0.28.0): the canonical `https://www.youtube.com/watch?v=ID`,
   * never what was typed. Optional: API builds before 0.28 send none of the three.
   */
  youtube_url?: string | null;
  youtube_video_id?: string | null;
  /** Whole seconds, from a `t=` or `start=` in the link. */
  youtube_start_seconds?: number | null;
  /**
   * The pin (API 0.29.0), exact as the lister placed it, at most 6 decimals.
   * Both set or both null. Optional: API builds before 0.29 send none of the three.
   */
  latitude?: number | null;
  longitude?: number | null;
  /** APPROXIMATE: visitors see only the area (rounded to about 1 km). Default EXACT. */
  location_precision?: "EXACT" | "APPROXIMATE";
};

/** Every key is optional; `null` clears a field. Unknown keys are refused (400). */
export type ListingContentPatch = Partial<{
  title: string | null;
  summary: string | null;
  description: string | null;
  deal: string | null;
  category: string | null;
  property_type: string | null;
  price: { amount: string | null; currency?: string } | null;
  price_period: string | null;
  country: string;
  city: string | null;
  suburb: string | null;
  city_name: string | null;
  region_name: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floor_area: number | null;
  land_area: number | null;
  features: string[] | null;
  max_guests: number | null;
  min_nights: number | null;
  /** A YouTube watch or share link; null or "" removes the video. 400 on `youtube_url` for anything else. */
  youtube_url: string | null;
  /** Sent together: both numbers, or both null to remove the pin. One alone is 400 on the missing one; (0, 0) is refused. */
  latitude: number | null;
  longitude: number | null;
  location_precision: "EXACT" | "APPROXIMATE";
}>;

export type PhotoSize = "large" | "medium" | "small";

/** A photo as its managers and reviewers see it. `url` is relative to the API origin for an upload. */
export type ManagedPhoto = {
  id: string;
  position: number;
  alt: string;
  width: number;
  height: number;
  /** PENDING_REVIEW: not public until the listing (or its changes) is approved. */
  status: "APPROVED" | "PENDING_REVIEW";
  url: string;
  variants: { size: PhotoSize; width: number; height: number; url: string }[];
  created_at: string;
};

export type PendingChanges = {
  status: "EDITING" | "PENDING_REVIEW" | "CHANGES_REQUESTED" | "REJECTED";
  status_label: string;
  reason: string | null;
  submitted_at: string | null;
  updated_at: string;
  new_photos: number;
};

export type ListingTimelineEntry = {
  action: "CREATED" | "SUBMITTED" | "APPROVED" | "CHANGES_REQUESTED" | "REJECTED" | "ARCHIVED" | "RELISTED" | string;
  from_status: string | null;
  to_status: string | null;
  review_kind: "NEW" | "EDIT" | null;
  reason: string | null;
  actor: "ADVERTISER" | "REVIEWER";
  at: string;
};

export type ManagedListing = {
  id: string;
  slug: string;
  reference: string;
  status: string;
  status_label: string;
  /** True while the public sees the listing. */
  public: boolean;
  review: { submitted_at: string | null; reviewed_at: string | null; reason: string | null };
  pending_changes: PendingChanges | null;
  /** The working copy: for a published listing, its pending changes. */
  content: ListingContent;
  photos: ManagedPhoto[];
  photo_limit: number;
  completeness: { ready: boolean; missing: { field: string; message: string }[] };
  owner: { type: "organisation" | "direct_owner"; organisation_id: string | null; agent_user_id: string | null };
  advertiser: ListingAdvertiser;
  can_edit: boolean;
  actions: ("edit" | "submit" | "archive" | "relist" | "delete")[];
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  timeline: ListingTimelineEntry[];
};

type Envelope = { listing: ManagedListing };

const path = (id: string) => `/v1/me/listings/${encodeURIComponent(id)}`;

/** A DRAFT. `organisation_id` or `as_direct_owner` only when the caller lists for several. */
export const createListing = (body: ListingContentPatch & { organisation_id?: string; as_direct_owner?: boolean }) =>
  apiFetch<Envelope>("/v1/me/listings", { method: "POST", body });

export const getManagedListing = (id: string) => apiFetch<Envelope>(path(id), { cache: "no-store" });

/** 409 `LISTING_IN_REVIEW`, `LISTING_STATE_CONFLICT` or `LISTING_CHANGED` (someone else saved at the same moment). */
export const updateListing = (id: string, patch: ListingContentPatch) =>
  apiFetch<Envelope>(path(id), { method: "PATCH", body: patch });

/** 204; 409 for a listing that was ever published. */
export const deleteListing = (id: string) => apiFetch<null>(path(id), { method: "DELETE" });

/** 422 `LISTING_INCOMPLETE` names each missing field in `fields`. */
export const submitListing = (id: string) => apiFetch<Envelope>(`${path(id)}/submit`, { method: "POST" });
export const archiveListing = (id: string) => apiFetch<Envelope>(`${path(id)}/archive`, { method: "POST" });
export const relistListing = (id: string) => apiFetch<Envelope>(`${path(id)}/relist`, { method: "POST" });

/** Every photo exactly once, cover first. Applies at once, also on a published listing. */
export const orderPhotos = (id: string, photoIds: string[]) =>
  apiFetch<Envelope>(`${path(id)}/photos/order`, { method: "PUT", body: { photo_ids: photoIds } });

/** At most 250 characters, one line. */
export const describePhoto = (id: string, photoId: string, alt: string) =>
  apiFetch<Envelope>(`${path(id)}/photos/${encodeURIComponent(photoId)}`, { method: "PATCH", body: { alt } });

/** 409 `PHOTO_REQUIRED` for the last public photo of a published listing. */
export const deletePhoto = (id: string, photoId: string) =>
  apiFetch<Envelope>(`${path(id)}/photos/${encodeURIComponent(photoId)}`, { method: "DELETE" });

const uploadMessages: Record<number, string> = {
  401: "Please sign in to continue.",
  403: "You cannot add photos to this listing.",
  413: "That photo is larger than 15 MB.",
  415: "That file is not a JPEG, PNG or WebP photo.",
  429: "Too many uploads at once. Please wait a minute and try again.",
};

/**
 * Uploads one photo (multipart, one `file` part). `fetch` cannot report how
 * much of a body has been sent, so this uses XMLHttpRequest for the progress
 * (0 to 1) of each file. Answers like `apiFetch`.
 */
export function uploadListingPhoto(
  id: string,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<ApiResult<Envelope>> {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${env.apiUrl}${path(id)}/photos`);
    request.withCredentials = true;
    request.responseType = "text";
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    };
    request.onerror = () =>
      resolve({
        ok: false,
        failure: {
          code: "NETWORK_ERROR",
          status: 0,
          message: "We could not reach RightProperty365. Check your connection and try again.",
        },
      });
    request.onload = () => {
      let payload: unknown = null;
      try {
        payload = request.responseText ? JSON.parse(request.responseText) : null;
      } catch {
        payload = null;
      }
      if (request.status >= 200 && request.status < 300) {
        onProgress(1);
        resolve({ ok: true, data: payload as Envelope, status: request.status });
        return;
      }
      const envelope = payload as {
        error?: { code?: string; message?: string; fields?: Record<string, string> };
        trace_id?: string;
      } | null;
      const failure: ApiFailure = {
        code: envelope?.error?.code ?? `HTTP_${request.status}`,
        status: request.status,
        message:
          envelope?.error?.fields?.file ??
          envelope?.error?.message ??
          uploadMessages[request.status] ??
          "Something went wrong on our side. Please try again.",
        fields: envelope?.error?.fields,
        traceId: envelope?.trace_id,
      };
      resolve({ ok: false, failure });
    };
    const body = new FormData();
    body.append("file", file, file.name);
    request.send(body);
  });
}

// ---- Review (admin session) -----------------------------------------------

export type ListingDecision = "approve" | "request_changes" | "reject";

export type AdminListing = ManagedListing & {
  review_kind: "NEW" | "EDIT" | null;
  /** The public content while an edit waits; null otherwise. */
  live: ListingContent | null;
  changes: { field: string; before: unknown; after: unknown }[];
  photo_changes: { added: number; alt_changed: number };
  decisions: ListingDecision[];
};

export type ListingQueueItem = {
  id: string;
  reference: string;
  /** The proposed title. */
  title: string;
  status: string;
  revision_status: string | null;
  review_kind: "NEW" | "EDIT" | null;
  country: { code: string; name: string };
  submitted_at: string | null;
  updated_at: string;
  advertiser: { type: "agency" | "private_seller"; name: string; verified: boolean };
  photo_count: number;
  pending_photo_count: number;
};

export type ListingQueuePage = {
  items: ListingQueueItem[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export type ListingQueueQuery = { status?: string; kind?: string; country?: string; q?: string; page?: number };

/** Oldest submission first. A MARKET_ADMIN sees only their own countries. */
export function listListingQueue(query: ListingQueueQuery) {
  const params = new URLSearchParams({ page_size: "20" });
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "" && !(key === "page" && value === 1)) params.set(key, String(value));
  }
  return apiFetch<ListingQueuePage>(`/v1/admin/listings?${params}`, { cache: "no-store" });
}

const adminPath = (id: string) => `/v1/admin/listings/${encodeURIComponent(id)}`;

export const getAdminListing = (id: string) =>
  apiFetch<{ listing: AdminListing }>(adminPath(id), { cache: "no-store" });

export const approveListing = (id: string) =>
  apiFetch<{ listing: AdminListing }>(`${adminPath(id)}/approve`, { method: "POST" });

/** The reason (1 to 1000 characters) is emailed to the advertiser. */
export const requestListingChanges = (id: string, reason: string) =>
  apiFetch<{ listing: AdminListing }>(`${adminPath(id)}/request-changes`, { method: "POST", body: { reason } });

export const rejectListing = (id: string, reason: string) =>
  apiFetch<{ listing: AdminListing }>(`${adminPath(id)}/reject`, { method: "POST", body: { reason } });

/**
 * The rules behind the heart on listing cards and the "Saved" list: the set
 * of saved ids after a change, and what to say when a change fails. Pure
 * functions with no imports, so `npm test` can run them directly.
 */

/** The parts of an `ApiFailure` the wording depends on. */
type Failure = { status: number; code: string; message: string };

/** A copy of `ids` with `id` added (`saved`) or removed. The original is never changed. */
export function withSaved(ids: ReadonlySet<string>, id: string, saved: boolean): Set<string> {
  const next = new Set(ids);
  if (saved) next.add(id);
  else next.delete(id);
  return next;
}

/**
 * What to tell someone whose save or removal did not go through. The heart
 * is already back as it was; the message says so in plain words and names
 * the property.
 */
export function saveFailureMessage(failure: Failure, { saving, title }: { saving: boolean; title: string }): string {
  if (failure.status === 401) return "Your session has ended. Sign in again to save properties.";
  if (failure.status === 403) return "This account cannot save properties. Sign in with your own account to save them.";
  if (saving && (failure.code === "LISTING_NOT_FOUND" || failure.status === 404)) {
    return `${title} is no longer available, so it cannot be saved.`;
  }
  if (failure.status === 429) return "Too many changes in a short time. Wait a minute and try again.";
  if (failure.code === "NETWORK_ERROR") {
    return saving
      ? `We could not save ${title}. Check your connection and try again.`
      : `We could not remove ${title} from your saved properties. Check your connection and try again.`;
  }
  return saving
    ? `We could not save ${title}. Please try again.`
    : `We could not remove ${title} from your saved properties. Please try again.`;
}

/** "3 saved properties, page 1 of 2, newest first" for the status line above the list. */
export function savedCountText({ total, page, total_pages }: { total: number; page: number; total_pages: number }): string {
  const count = total === 1 ? "1 saved property" : `${total} saved properties`;
  return `${count}${total_pages > 1 ? `, page ${page} of ${total_pages}` : ""}, newest saved first`;
}

/** The address of a page of the Saved list. Page 1 is the plain address. */
export function savedPageHref(page: number): string {
  return page > 1 ? `/account/saved?page=${page}` : "/account/saved";
}

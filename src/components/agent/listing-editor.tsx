"use client";

import { AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FocusEvent, type ReactNode } from "react";
import { PhotoManager } from "@/components/agent/photo-manager";
import { RequireAuth } from "@/components/auth/require-auth";
import { BackLink, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import { SearchableSelect, type SelectItem } from "@/components/ui/searchable-select";
import type { ApiFailure } from "@/lib/api/http";
import {
  archiveListing,
  deleteListing,
  getManagedListing,
  relistListing,
  submitListing,
  updateListing,
  type ListingContent,
  type ListingContentPatch,
  type ManagedListing,
} from "@/lib/api/manage-listings";
import type { EditorOption, ListingEditorLists } from "@/lib/api/server/listing-editor";
import { SHORT_STAY } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import {
  amountForInput,
  confirmText,
  fieldControlId,
  listingActionButtons,
  listingBanner,
  listingStatusLabel,
  listingStatusTone,
  parseAmount,
  parseWholeNumber,
  pendingChangesBadge,
  savedAtText,
  timelineText,
  type ActionButton,
} from "@/lib/listing-manage";

// ---- The form's values --------------------------------------------------------

type Values = {
  title: string;
  summary: string;
  description: string;
  deal: string;
  category: string;
  property_type: string;
  amount: string;
  currency: string;
  price_period: string;
  country: string;
  /** Only narrows the list of cities; the API keeps no region code. */
  region: string;
  city: string;
  suburb: string;
  city_name: string;
  region_name: string;
  bedrooms: string;
  bathrooms: string;
  floor_area: string;
  land_area: string;
  features: string[];
  max_guests: string;
  min_nights: string;
};

type Key = keyof Values;

/** Choices the API may change itself after a save (a short stay is to rent, per night; a new country clears places). */
const FOLLOWS_SERVER: Key[] = ["deal", "category", "property_type", "currency", "price_period", "country", "city", "suburb", "features"];

const numberText = (value: number | null) => (value === null ? "" : String(value));

function fromContent(content: ListingContent, lists: ListingEditorLists): Values {
  const city = content.city ?? "";
  return {
    title: content.title ?? "",
    summary: content.summary ?? "",
    description: content.description ?? "",
    deal: content.deal ?? "",
    category: content.category ?? "",
    property_type: content.property_type ?? "",
    amount: amountForInput(content.price.amount),
    currency: content.price.currency ?? "",
    price_period: content.price_period ?? "",
    country: content.country ?? "",
    region: lists.cities.find((item) => item.value === city)?.parent ?? "",
    city,
    suburb: content.suburb ?? "",
    city_name: content.city_name ?? "",
    region_name: content.region_name ?? "",
    bedrooms: numberText(content.bedrooms),
    bathrooms: numberText(content.bathrooms),
    floor_area: numberText(content.floor_area),
    land_area: numberText(content.land_area),
    features: [...(content.features ?? [])],
    max_guests: numberText(content.max_guests),
    min_nights: numberText(content.min_nights),
  };
}

const sameValue = (a: Values[Key], b: Values[Key]) =>
  Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((item, index) => item === b[index]) : a === b;

const NUMBER_FIELDS: Partial<Record<Key, { label: string; min: number; max?: number }>> = {
  bedrooms: { label: "the number of bedrooms", min: 0, max: 50 },
  bathrooms: { label: "the number of bathrooms", min: 0, max: 50 },
  floor_area: { label: "the floor area", min: 0 },
  land_area: { label: "the land area", min: 0 },
  max_guests: { label: "the number of guests", min: 1, max: 100 },
  min_nights: { label: "the shortest stay", min: 1, max: 365 },
};

/**
 * The PATCH for the fields changed since the last save, the values it was
 * built from, and the fields that cannot be sent as typed.
 */
function buildPatch(values: Values, dirty: Set<Key>) {
  const patch: ListingContentPatch = {};
  const sent: Partial<Record<Key, Values[Key]>> = {};
  const errors: Partial<Record<Key, string>> = {};
  const set = <K extends keyof ListingContentPatch>(field: K, value: ListingContentPatch[K]) => {
    patch[field] = value;
  };
  for (const key of dirty) {
    const value = values[key];
    switch (key) {
      case "title":
      case "summary":
        set(key, values[key].trim() || null);
        break;
      case "description":
        set(key, values.description.trim() ? values.description : null);
        break;
      case "deal":
      case "category":
      case "property_type":
      case "price_period":
      case "city":
      case "suburb":
        set(key, values[key] || null);
        break;
      case "country":
        if (values.country) set("country", values.country);
        break;
      case "city_name":
      case "region_name":
        set(key, values[key].trim() || null);
        break;
      case "amount":
      case "currency": {
        const amount = parseAmount(values.amount);
        if (!amount.ok) {
          errors.amount = amount.message;
          continue;
        }
        set("price", amount.value === null && !values.currency ? null : { amount: amount.value, ...(values.currency ? { currency: values.currency } : {}) });
        break;
      }
      case "features":
        if (values.features.length > 30) {
          errors.features = "Choose at most 30 features.";
          continue;
        }
        set("features", values.features);
        break;
      case "region":
        break;
      default: {
        const rule = NUMBER_FIELDS[key];
        if (!rule) break;
        const parsed = parseWholeNumber(values[key] as string, rule.label, rule.min, rule.max);
        if (!parsed.ok) {
          errors[key] = parsed.message;
          continue;
        }
        set(key as "bedrooms", parsed.value);
      }
    }
    sent[key] = value;
  }
  return { patch, sent, errors };
}

/** The form control for an API field name. */
const keyForField = (field: string): string =>
  field === "price" || field === "price.amount" ? "amount" : field === "price.currency" ? "currency" : field.split(/[.[]/)[0];

function mapFieldErrors(fields: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, message] of Object.entries(fields ?? {})) out[keyForField(field)] = message;
  return out;
}

// ---- Small pieces -------------------------------------------------------------

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <Card>
        <h2 id={id} tabIndex={-1} className="text-2xl">
          {title}
        </h2>
        {intro && <p className="mt-1 text-sm text-muted">{intro}</p>}
        <div className="mt-5 grid gap-5">{children}</div>
      </Card>
    </section>
  );
}

const withChoose = (options: EditorOption[], choose: string): SelectItem[] => [
  { value: "", label: choose },
  ...options.map(({ value, label, keywords }) => ({ value, label, keywords })),
];

type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved"; at: Date }
  | { status: "invalid" }
  | { status: "error"; message: string; traceId?: string };

type Props = { listingId: string; lists: ListingEditorLists };

type Session = {
  values: Values | null;
  dirty: Set<Key>;
  inFlight: boolean;
  again: boolean;
  failed: boolean;
  timer: ReturnType<typeof setTimeout> | undefined;
};

function Editor({ listingId, lists }: Props) {
  const router = useRouter();
  const [listing, setListing] = useState<ManagedListing | null>(null);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [values, setValuesState] = useState<Values | null>(null);
  const [dirtyCount, setDirtyCount] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [save, setSave] = useState<SaveState>({ status: "idle" });
  const [notice, setNotice] = useState<{ tone: "info" | "warning" | "success" | "danger"; title: string; body?: string } | null>(null);
  const [pending, setPending] = useState<ActionButton | null>(null);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | undefined>();
  const session = useRef<Session>({ values: null, dirty: new Set(), inFlight: false, again: false, failed: false, timer: undefined });
  const noticeRef = useRef<HTMLDivElement>(null);

  const setValues = useCallback((next: Values) => {
    session.current.values = next;
    setValuesState(next);
  }, []);

  const read = useCallback(async () => {
    const result = await getManagedListing(listingId);
    if (!result.ok) {
      setFailure(result.failure);
      return;
    }
    const s = session.current;
    s.dirty.clear();
    s.failed = false;
    setDirtyCount(0);
    setFailure(null);
    setListing(result.data.listing);
    setValues(fromContent(result.data.listing.content, lists));
  }, [listingId, lists, setValues]);

  useEffect(() => {
    let cancelled = false;
    getManagedListing(listingId).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setFailure(result.failure);
        return;
      }
      setListing(result.data.listing);
      setValues(fromContent(result.data.listing.content, lists));
    });
    return () => {
      cancelled = true;
    };
  }, [listingId, lists, setValues]);

  // Saves what was changed since the last save. One save at a time; edits made meanwhile follow it.
  const flush = useCallback(async (): Promise<void> => {
    const s = session.current;
    // Once more for edits made while a save was on its way.
    for (;;) {
      clearTimeout(s.timer);
      if (!s.values) return;
      if (s.inFlight) {
        s.again = true;
        return;
      }
      const { patch, sent, errors: invalid } = buildPatch(s.values, s.dirty);
      setErrors((current) => {
        const next = { ...current };
        for (const key of Object.keys(sent)) delete next[key];
        return { ...next, ...invalid };
      });
      if (Object.keys(patch).length === 0) {
        for (const key of Object.keys(sent) as Key[]) s.dirty.delete(key);
        setDirtyCount(s.dirty.size);
        setSave(Object.keys(invalid).length > 0 ? { status: "invalid" } : (current) => current);
        return;
      }
      s.inFlight = true;
      setSave({ status: "saving" });
      const result = await updateListing(listingId, patch);
      s.inFlight = false;
      if (result.ok) {
        s.failed = false;
        const current = s.values ?? fromContent(result.data.listing.content, lists);
        for (const key of Object.keys(sent) as Key[]) {
          if (sameValue(current[key], sent[key] as Values[Key])) s.dirty.delete(key);
        }
        const server = fromContent(result.data.listing.content, lists);
        const merged = { ...current };
        for (const key of FOLLOWS_SERVER) {
          if (!s.dirty.has(key)) (merged as Record<Key, Values[Key]>)[key] = server[key];
        }
        if (merged.city !== current.city) merged.region = merged.city ? server.region : current.region;
        setValues(merged);
        setListing(result.data.listing);
        setDirtyCount(s.dirty.size);
        setSave(Object.keys(invalid).length > 0 ? { status: "invalid" } : { status: "saved", at: new Date() });
        if (s.again) {
          s.again = false;
          continue;
        }
        return;
      }
      s.again = false;
      const { code } = result.failure;
      if (code === "LISTING_CHANGED") {
        setSave({ status: "idle" });
        setNotice({
          tone: "warning",
          title: "Someone else changed this listing at the same moment",
          body: "We have loaded the latest version, so your last change was not saved. Check the listing and make it again.",
        });
        await read();
        noticeRef.current?.focus();
        return;
      }
      if (code === "LISTING_IN_REVIEW" || code === "LISTING_STATE_CONFLICT") {
        setSave({ status: "idle" });
        setNotice({ tone: "warning", title: "This listing cannot be changed now", body: result.failure.message });
        await read();
        noticeRef.current?.focus();
        return;
      }
      s.failed = true;
      if (result.failure.fields && Object.keys(result.failure.fields).length > 0) {
        setErrors((current) => ({ ...current, ...mapFieldErrors(result.failure.fields) }));
        setSave({ status: "invalid" });
        return;
      }
      setSave({ status: "error", message: result.failure.message, traceId: result.failure.traceId });
      return;
    }
  }, [listingId, lists, read, setValues]);

  // Ask before leaving with changes that are not saved; save what is left when leaving within the site.
  useEffect(() => {
    const s = session.current;
    const warn = (event: BeforeUnloadEvent) => {
      if (s.dirty.size > 0 || s.inFlight || s.failed) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      clearTimeout(s.timer);
      if (s.values && s.dirty.size > 0 && !s.inFlight) {
        const { patch } = buildPatch(s.values, s.dirty);
        if (Object.keys(patch).length > 0) void updateListing(listingId, patch);
      }
    };
  }, [listingId]);

  /** Change some values; save them after `delay` ms (typing) or at once (a choice). */
  function change(next: Partial<Values>, keys: Key[], delay = 0) {
    const s = session.current;
    if (!s.values) return;
    setValues({ ...s.values, ...next });
    for (const key of keys) s.dirty.add(key);
    setDirtyCount(s.dirty.size);
    setErrors((current) => {
      const copy = { ...current };
      for (const key of keys) delete copy[key];
      return copy;
    });
    clearTimeout(s.timer);
    s.timer = setTimeout(() => void flush(), delay);
  }

  function onTextChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const key = event.currentTarget.name as Key;
    change({ [key]: event.currentTarget.value } as Partial<Values>, [key], Number(event.currentTarget.dataset.delay ?? 900));
  }

  function onTextBlur(event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (session.current.dirty.has(event.currentTarget.name as Key)) void flush();
  }

  /** Waits for the save in progress, then saves anything left. */
  async function settle() {
    const s = session.current;
    while (s.inFlight) await new Promise((resolve) => setTimeout(resolve, 100));
    if (s.dirty.size > 0) await flush();
    while (s.inFlight) await new Promise((resolve) => setTimeout(resolve, 100));
    return s.dirty.size === 0;
  }

  function focusField(field: string) {
    const s = session.current;
    let id = fieldControlId(field);
    const hasCities = lists.cities.some((city) => city.country === s.values?.country);
    if ((field === "city" || field === "city_name") && s.values?.country) id = hasCities ? "listing-city" : "listing-city-name";
    if (field.startsWith("photos") && listing) {
      const undescribed = listing.photos.find((photo) => photo.alt.trim() === "");
      if (undescribed && listing.photos.length > 0) id = `photo-${undescribed.id}-alt`;
    }
    const element = id ? document.getElementById(id) : null;
    if (!element) return;
    element.scrollIntoView({ block: "center" });
    element.focus({ preventScroll: true });
  }

  async function runAction(button: ActionButton) {
    if (!listing) return;
    setActing(true);
    setActionError(undefined);
    if (!(await settle())) {
      setActing(false);
      const message = "Some changes are not saved yet. Fix the fields marked in red first.";
      if (button.confirm) setActionError(message);
      else setNotice({ tone: "danger", title: message });
      return;
    }
    const calls = { submit: submitListing, archive: archiveListing, relist: relistListing, delete: deleteListing };
    const result = await calls[button.action](listing.id);
    setActing(false);
    if (!result.ok) {
      const { code, fields, message } = result.failure;
      if (code === "LISTING_INCOMPLETE") {
        setPending(null);
        const mapped = mapFieldErrors(fields);
        setErrors((current) => ({ ...current, ...mapped }));
        setNotice({ tone: "danger", title: "Some things are still needed before this listing can be submitted", body: "They are marked below." });
        const first = Object.keys(fields ?? {})[0];
        if (first) focusField(first);
        await read();
        return;
      }
      if (button.confirm) setActionError(message);
      else setNotice({ tone: "danger", title: message });
      if (code === "LISTING_CHANGED" || code === "LISTING_IN_REVIEW" || code === "LISTING_STATE_CONFLICT") await read();
      return;
    }
    setPending(null);
    if (button.action === "delete") {
      router.push("/agent/listings");
      return;
    }
    const updated = result.data!.listing;
    setListing(updated);
    setValues(fromContent(updated.content, lists));
    const words = {
      submit: { title: "Sent for review", body: "We will email you when our review team has made a decision." },
      archive: { title: "Archived", body: "Visitors no longer see this listing." },
      relist: {
        title: "Relisted",
        body: updated.status === "PENDING_REVIEW" ? "It is waiting for review again." : "It is a draft again: finish it and submit it.",
      },
    };
    setNotice({ tone: "success", ...words[button.action] });
    requestAnimationFrame(() => noticeRef.current?.focus());
  }

  if (failure) {
    if (failure.status === 404) {
      return (
        <div className="rounded-lg border border-dashed border-line-strong p-10 text-center">
          <h1 className="text-2xl">We could not find that listing</h1>
          <p className="mx-auto mt-2 max-w-md text-muted">It may have been deleted, or it is not one you manage.</p>
          <ButtonLink href="/agent/listings" variant="secondary" className="mt-6">
            Back to your listings
          </ButtonLink>
        </div>
      );
    }
    return <LoadError failure={failure} onRetry={() => void read()} />;
  }
  if (!listing || !values) return <LoadingBlock label="Loading the listing" rows={3} />;

  const editable = listing.actions.includes("edit");
  const isStay = values.category === SHORT_STAY;
  const countryHasCities = lists.cities.some((city) => city.country === values.country);
  const countryName = lists.countries.find((country) => country.value === values.country)?.label;
  const regions = lists.regions.filter((region) => region.country === values.country);
  const cities = lists.cities.filter(
    (city) => city.country === values.country && (!values.region || city.parent === values.region),
  );
  const suburbs = lists.suburbs.filter((suburb) => suburb.parent === values.city);
  const types = lists.propertyTypes.filter((type) => !values.category || type.parent === values.category);
  const periods = lists.periods.filter((period) => (isStay ? period.value === "night" : period.value !== "night"));
  const currencies = [...new Set(lists.countries.map((country) => country.currency).filter(Boolean))].sort();
  const ownCurrency = lists.countries.find((country) => country.value === values.country)?.currency;
  const showPeriod = isStay || values.deal === "rent" || Boolean(values.price_period);
  const banner = listingBanner(listing);
  const pendingBadge = pendingChangesBadge(listing.pending_changes);
  const buttons = listingActionButtons({
    actions: listing.actions,
    ready: listing.completeness.ready,
    publishedWithChanges: listing.status === "PUBLISHED" && listing.pending_changes !== null,
  });
  const title = values.title.trim() || listing.content.title || "Untitled listing";
  const err = (key: string) => errors[key] || undefined;
  const describedBy = (id: string, key: string, hint?: string) => fieldDescribedBy(id, { hint, error: err(key) });
  const featureGroups = new Map<string, EditorOption[]>();
  for (const feature of lists.features) {
    const group = feature.group ?? "Features";
    featureGroups.set(group, [...(featureGroups.get(group) ?? []), feature]);
  }
  const dialog = pending ? confirmText(pending.action, listing.published_at !== null) : null;
  const hasUnsaved = dirtyCount > 0;

  const saveText =
    save.status === "saving"
      ? "Saving…"
      : save.status === "error"
        ? "Your last change was not saved."
        : save.status === "invalid"
          ? "Some changes are not saved. Check the fields marked in red."
          : hasUnsaved
            ? "Changes not saved yet…"
            : save.status === "saved"
              ? `All changes saved. ${savedAtText(save.at)}.`
              : `Changes save automatically. Last saved ${formatWhen(listing.updated_at)}.`;

  /* A text box: saved a moment after typing stops, and at once when leaving it. */
  const text = (key: Key, delay = 900) => ({
    name: key,
    value: values[key] as string,
    "data-delay": delay,
    "aria-invalid": Boolean(err(key)),
  });

  return (
    <>
      <BackLink href="/agent/listings">Your listings</BackLink>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge tone={listingStatusTone(listing.status)}>{listingStatusLabel(listing.status, listing.status_label)}</Badge>
        {pendingBadge && <Badge tone={pendingBadge.tone}>{pendingBadge.text}</Badge>}
        <span className="text-sm text-muted">Reference {listing.reference}</span>
      </div>
      <h1 className="mt-2 text-3xl md:text-4xl">{title}</h1>
      {listing.public && (
        <Link
          href={`/listings/${listing.slug}`}
          className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary-ink hover:underline"
        >
          <ExternalLink className="size-4" aria-hidden="true" />
          See it as visitors do
        </Link>
      )}

      <div className="mt-6 space-y-4">
        {banner && (
          <Alert tone={banner.tone} title={banner.title}>
            {banner.reason && (
              <blockquote className="my-2 rounded-md border-l-4 border-current bg-surface p-3 text-base text-ink">
                <span className="block text-xs font-semibold uppercase tracking-wide text-muted">Reason from our review team</span>
                <span className="mt-1 block whitespace-pre-line">{banner.reason}</span>
              </blockquote>
            )}
            {banner.body}
          </Alert>
        )}
        {!listing.can_edit && (
          <Alert tone="info" title="You can see this listing but not change it">
            Another agent of your organisation looks after it. Ask them, or your Agency Principal, to make changes.
          </Alert>
        )}
        <div ref={noticeRef} tabIndex={-1} className="outline-none">
          {notice && (
            <Alert tone={notice.tone} title={notice.title}>
              {notice.body}
            </Alert>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <aside aria-label="Saving and review" className="lg:order-2">
          <div className="space-y-4 lg:sticky lg:top-24">
            <Card>
              <h2 className="font-sans text-lg font-semibold tracking-normal">Saving</h2>
              <p role="status" aria-live="polite" className={cn("mt-1 text-sm", save.status === "error" || save.status === "invalid" ? "text-danger" : "text-muted")}>
                {editable ? saveText : "This listing cannot be changed now."}
              </p>
              {save.status === "error" && (
                <>
                  {save.traceId && <p className="mt-1 text-xs text-muted">Support reference: {save.traceId}</p>}
                  <p className="mt-1 text-sm text-ink">{save.message}</p>
                  <Button variant="secondary" className="mt-3" onClick={() => void flush()}>
                    Try saving again
                  </Button>
                </>
              )}
            </Card>

            {(editable || listing.actions.includes("submit")) && (
              <Card>
                <h2 className="flex items-center gap-2 font-sans text-lg font-semibold tracking-normal">
                  {listing.completeness.ready ? (
                    <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
                  ) : (
                    <AlertCircle className="size-5 text-warning" aria-hidden="true" />
                  )}
                  {listing.completeness.ready ? "Ready to submit" : "Still needed"}
                </h2>
                {listing.completeness.ready ? (
                  <p className="mt-1 text-sm text-muted">Everything our review team needs is there.</p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {listing.completeness.missing.map((item) => (
                      <li key={`${item.field}-${item.message}`}>
                        <button
                          type="button"
                          onClick={() => focusField(item.field)}
                          className="min-h-11 w-full rounded-md px-2 py-1.5 text-left text-sm text-primary-ink underline underline-offset-2 hover:bg-sunken"
                        >
                          {item.message}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}

            {buttons.length > 0 && (
              <Card>
                <h2 className="font-sans text-lg font-semibold tracking-normal">Actions</h2>
                <div className="mt-3 flex flex-col gap-2">
                  {buttons.map((button) => (
                    <div key={button.action}>
                      <Button
                        variant={button.variant}
                        size={button.action === "submit" ? "lg" : "md"}
                        className="w-full"
                        disabled={Boolean(button.disabledReason) || acting || save.status === "saving"}
                        aria-describedby={button.disabledReason ? `action-${button.action}-why` : undefined}
                        aria-busy={(acting && !button.confirm) || undefined}
                        onClick={() => {
                          setNotice(null);
                          if (button.confirm) {
                            setActionError(undefined);
                            setPending(button);
                          } else {
                            void runAction(button);
                          }
                        }}
                      >
                        {acting && button.action === "submit" ? "Sending…" : button.label}
                      </Button>
                      {button.disabledReason && (
                        <p id={`action-${button.action}-why`} className="mt-1 text-sm text-muted">
                          {button.disabledReason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </aside>

        <div className="min-w-0 space-y-8 lg:order-1">
          <fieldset disabled={!editable} className="min-w-0 space-y-8">
            <legend className="sr-only">Listing details</legend>
            <Section id="section-basics" title="Basics">
              <div className="grid gap-5 sm:grid-cols-3">
                <Field id="listing-category" label="Category" error={err("category")}>
                  <SearchableSelect
                    id="listing-category"
                    value={values.category}
                    disabled={!editable}
                    onValueChange={(value) => {
                      const next: Partial<Values> = { category: value };
                      const keys: Key[] = ["category"];
                      // A type of another category no longer fits.
                      if (values.property_type && !lists.propertyTypes.some((type) => type.value === values.property_type && type.parent === value)) {
                        next.property_type = "";
                        keys.push("property_type");
                      }
                      if (value !== SHORT_STAY) Object.assign(next, { max_guests: "", min_nights: "" });
                      change(next, keys);
                    }}
                    aria-invalid={Boolean(err("category"))}
                    aria-describedby={describedBy("listing-category", "category")}
                    options={withChoose(lists.categories, "Choose…")}
                  />
                </Field>
                <Field
                  id="listing-property-type"
                  label="Property type"
                  hint={values.category ? undefined : "Choose the category first."}
                  error={err("property_type")}
                >
                  <SearchableSelect
                    id="listing-property-type"
                    value={values.property_type}
                    disabled={!editable || !values.category}
                    onValueChange={(value) => change({ property_type: value }, ["property_type"])}
                    aria-invalid={Boolean(err("property_type"))}
                    aria-describedby={describedBy("listing-property-type", "property_type", values.category ? undefined : "x")}
                    options={withChoose(types, "Choose…")}
                  />
                </Field>
                <Field
                  id="listing-deal"
                  label="For sale or to rent"
                  hint={isStay ? "A short stay is always to rent." : undefined}
                  error={err("deal")}
                >
                  <SearchableSelect
                    id="listing-deal"
                    value={values.deal}
                    disabled={!editable || isStay}
                    onValueChange={(value) => change({ deal: value, ...(value === "sale" ? { price_period: "" } : {}) }, ["deal"])}
                    aria-invalid={Boolean(err("deal"))}
                    aria-describedby={describedBy("listing-deal", "deal", isStay ? "x" : undefined)}
                    options={withChoose(lists.deals, "Choose…")}
                  />
                </Field>
              </div>
              <Field id="listing-title" label="Title" hint="At least 5 characters. For example: Three-bedroom house in Borrowdale." error={err("title")}>
                <Input id="listing-title" maxLength={120} {...text("title")} onChange={onTextChange} onBlur={onTextBlur} aria-describedby={describedBy("listing-title", "title", "x")} />
              </Field>
              <Field id="listing-summary" label="Summary" optional hint="One line shown under the title in search results." error={err("summary")}>
                <Input id="listing-summary" maxLength={300} {...text("summary")} onChange={onTextChange} onBlur={onTextBlur} aria-describedby={describedBy("listing-summary", "summary", "x")} />
              </Field>
              <Field
                id="listing-description"
                label="Description"
                hint={`At least 30 characters. Plain text; line breaks are kept. ${values.description.length} of 8,000 characters.`}
                error={err("description")}
              >
                <Textarea
                  id="listing-description"
                  rows={8}
                  maxLength={8000}
                  {...text("description", 1500)} onChange={onTextChange} onBlur={onTextBlur}
                  aria-describedby={describedBy("listing-description", "description", "x")}
                />
              </Field>
            </Section>

            <Section id="section-price" title="Price" intro="Shown with its currency code, as everywhere on the site. Nothing is converted.">
              <div className="grid gap-5 sm:grid-cols-3">
                <Field id="listing-price-amount" label={`Price${values.currency ? ` (${values.currency})` : ""}`} hint="Numbers only, such as 250000." error={err("amount")}>
                  <Input
                    id="listing-price-amount"
                    inputMode="decimal"
                    autoComplete="off"
                    {...text("amount")} onChange={onTextChange} onBlur={onTextBlur}
                    aria-describedby={describedBy("listing-price-amount", "amount", "x")}
                  />
                </Field>
                <Field id="listing-price-currency" label="Currency" hint={ownCurrency ? `${countryName ?? "The country"} uses ${ownCurrency}.` : undefined} error={err("currency")}>
                  <SearchableSelect
                    id="listing-price-currency"
                    value={values.currency}
                    disabled={!editable}
                    onValueChange={(value) => change({ currency: value }, ["currency"])}
                    aria-invalid={Boolean(err("currency"))}
                    aria-describedby={describedBy("listing-price-currency", "currency", ownCurrency ? "x" : undefined)}
                    options={[
                      { value: "", label: "Choose…" },
                      ...[...(ownCurrency ? [ownCurrency] : []), ...currencies.filter((code) => code !== ownCurrency)].map((code) => ({
                        value: code,
                        label: code,
                      })),
                    ]}
                  />
                </Field>
                {showPeriod && (
                  <Field id="listing-price-period" label="Charged" hint={isStay ? "A short stay is priced per night." : undefined} error={err("price_period")}>
                    <SearchableSelect
                      id="listing-price-period"
                      value={values.price_period}
                      disabled={!editable || isStay}
                      onValueChange={(value) => change({ price_period: value }, ["price_period"])}
                      aria-invalid={Boolean(err("price_period"))}
                      aria-describedby={describedBy("listing-price-period", "price_period", isStay ? "x" : undefined)}
                      options={withChoose(periods, "Choose…")}
                    />
                  </Field>
                )}
              </div>
            </Section>

            <Section id="section-location" title="Location">
              <Field
                id="listing-country"
                label="Country"
                hint={listing.published_at ? "The country cannot change once a listing has been published." : undefined}
                error={err("country")}
              >
                <SearchableSelect
                  id="listing-country"
                  value={values.country}
                  disabled={!editable || listing.published_at !== null}
                  onValueChange={(value) => {
                    const currency = lists.countries.find((country) => country.value === value)?.currency ?? "";
                    // A new country starts its places again (the API does the same).
                    change(
                      {
                        country: value,
                        region: "",
                        city: "",
                        suburb: "",
                        city_name: "",
                        region_name: "",
                        ...(values.amount.trim() === "" && currency ? { currency } : {}),
                      },
                      ["country"],
                    );
                  }}
                  aria-invalid={Boolean(err("country"))}
                  aria-describedby={describedBy("listing-country", "country", listing.published_at ? "x" : undefined)}
                  options={withChoose(lists.countries, "Choose a country…")}
                />
              </Field>
              {values.country && countryHasCities && (
                <div className="grid gap-5 sm:grid-cols-3">
                  {regions.length > 0 && (
                    <Field id="listing-region" label="Region or province" optional hint="Narrows the list of cities.">
                      <SearchableSelect
                        id="listing-region"
                        value={values.region}
                        disabled={!editable}
                        onValueChange={(value) => {
                          const city = lists.cities.find((item) => item.value === values.city);
                          // A region only narrows the cities; a city outside it is cleared (and that is saved).
                          if (!values.city || !value || city?.parent === value) setValues({ ...values, region: value });
                          else change({ region: value, city: "", suburb: "" }, ["city", "suburb"]);
                        }}
                        aria-describedby="listing-region-hint"
                        options={[{ value: "", label: "Any region" }, ...regions.map(({ value, label }) => ({ value, label }))]}
                      />
                    </Field>
                  )}
                  <Field id="listing-city" label="City or town" error={err("city")}>
                    <SearchableSelect
                      id="listing-city"
                      value={values.city}
                      disabled={!editable}
                      onValueChange={(value) => {
                        const region = lists.cities.find((item) => item.value === value)?.parent ?? values.region;
                        const suburbFits = lists.suburbs.some((item) => item.value === values.suburb && item.parent === value);
                        change({ city: value, region, ...(suburbFits ? {} : { suburb: "" }) }, suburbFits ? ["city"] : ["city", "suburb"]);
                      }}
                      aria-invalid={Boolean(err("city"))}
                      aria-describedby={describedBy("listing-city", "city")}
                      options={withChoose(cities, "Choose…")}
                    />
                  </Field>
                  {suburbs.length > 0 && (
                    <Field id="listing-suburb" label="Suburb" optional error={err("suburb")}>
                      <SearchableSelect
                        id="listing-suburb"
                        value={values.suburb}
                        disabled={!editable}
                        onValueChange={(value) => change({ suburb: value }, ["suburb"])}
                        aria-invalid={Boolean(err("suburb"))}
                        aria-describedby={describedBy("listing-suburb", "suburb")}
                        options={[{ value: "", label: "No suburb" }, ...suburbs.map(({ value, label }) => ({ value, label }))]}
                      />
                    </Field>
                  )}
                </div>
              )}
              {values.country && !countryHasCities && (
                <>
                  <p className="text-sm leading-relaxed text-muted">
                    We have no list of places for {countryName ?? "this country"} yet, so type the city or town and, if you
                    like, the region.
                  </p>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field id="listing-city-name" label="City or town" hint="At most 80 characters." error={err("city_name") ?? err("city")}>
                      <Input
                        id="listing-city-name"
                        maxLength={80}
                        autoComplete="off"
                        {...text("city_name")} onChange={onTextChange} onBlur={onTextBlur}
                        aria-invalid={Boolean(err("city_name") ?? err("city"))}
                        aria-describedby={fieldDescribedBy("listing-city-name", { hint: "x", error: err("city_name") ?? err("city") })}
                      />
                    </Field>
                    <Field id="listing-region-name" label="Region or province" optional error={err("region_name")}>
                      <Input
                        id="listing-region-name"
                        maxLength={80}
                        autoComplete="off"
                        {...text("region_name")} onChange={onTextChange} onBlur={onTextBlur}
                        aria-describedby={describedBy("listing-region-name", "region_name")}
                      />
                    </Field>
                  </div>
                </>
              )}
            </Section>

            <Section id="section-details" title="Details" intro="Leave out what does not apply, such as bedrooms on a plot of land.">
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {(
                  [
                    ["bedrooms", "Bedrooms"],
                    ["bathrooms", "Bathrooms"],
                    ["floor_area", "Floor area (m²)"],
                    ["land_area", "Land area (m²)"],
                  ] as const
                ).map(([key, label]) => {
                  const id = `listing-${key.replace("_", "-")}`;
                  return (
                    <Field key={key} id={id} label={label} optional error={err(key)}>
                      <Input id={id} inputMode="numeric" autoComplete="off" {...text(key, 700)} onChange={onTextChange} onBlur={onTextBlur} aria-describedby={describedBy(id, key)} />
                    </Field>
                  );
                })}
              </div>
              {lists.features.length > 0 && (
                <fieldset
                  id="listing-features"
                  tabIndex={-1}
                  aria-describedby={err("features") ? "listing-features-error" : undefined}
                  className="min-w-0"
                >
                  <legend className="text-sm font-medium text-ink">
                    Features <span className="font-normal text-subtle">(optional)</span>
                  </legend>
                  {[...featureGroups.entries()].map(([group, features]) => (
                    <div key={group} className="mt-3">
                      {featureGroups.size > 1 && <p className="text-sm font-semibold text-muted">{group}</p>}
                      <ul className="mt-1 grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
                        {features.map((feature) => {
                          const checked = values.features.includes(feature.value);
                          return (
                            <li key={feature.value}>
                              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-ink">
                                <input
                                  type="checkbox"
                                  className="size-5 accent-primary"
                                  checked={checked}
                                  onChange={() =>
                                    change(
                                      {
                                        features: checked
                                          ? values.features.filter((code) => code !== feature.value)
                                          : [...values.features, feature.value],
                                      },
                                      ["features"],
                                      400,
                                    )
                                  }
                                />
                                {feature.label}
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                  {err("features") && (
                    <p id="listing-features-error" className="mt-1 text-sm text-danger">
                      {err("features")}
                    </p>
                  )}
                </fieldset>
              )}
            </Section>

            {isStay && (
              <Section id="section-stay" title="Short stay" intro="The calendar of nights is kept on its own page once the listing exists.">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field id="listing-max-guests" label="Guests, at most" hint="Needed before you submit. 1 to 100." error={err("max_guests")}>
                    <Input
                      id="listing-max-guests"
                      inputMode="numeric"
                      autoComplete="off"
                      {...text("max_guests", 700)} onChange={onTextChange} onBlur={onTextBlur}
                      aria-describedby={describedBy("listing-max-guests", "max_guests", "x")}
                    />
                  </Field>
                  <Field id="listing-min-nights" label="Shortest stay, in nights" optional hint="1 to 365. Without it, one night." error={err("min_nights")}>
                    <Input
                      id="listing-min-nights"
                      inputMode="numeric"
                      autoComplete="off"
                      {...text("min_nights", 700)} onChange={onTextChange} onBlur={onTextBlur}
                      aria-describedby={describedBy("listing-min-nights", "min_nights", "x")}
                    />
                  </Field>
                </div>
                <ButtonLink href={`/agent/listings/${listing.id}/availability`} variant="secondary" className="justify-self-start">
                  Manage availability
                </ButtonLink>
              </Section>
            )}
          </fieldset>

          <section aria-labelledby="listing-photos">
            <Card>
              <h2 id="listing-photos" tabIndex={-1} className="text-2xl">
                Photos
              </h2>
              <div className="mt-3">
                <PhotoManager
                  listing={listing}
                  editable={editable}
                  onListing={(next) => setListing(next)}
                  onConflict={() => void read()}
                />
              </div>
            </Card>
          </section>

          {listing.timeline.length > 0 && (
            <section aria-labelledby="listing-history">
              <Card>
                <h2 id="listing-history" className="text-2xl">
                  History
                </h2>
                <ol className="mt-4 space-y-3">
                  {[...listing.timeline].reverse().map((entry, index) => (
                    <li key={`${entry.at}-${index}`} className="border-l-2 border-line pl-4">
                      <p className="font-medium text-ink">{timelineText(entry)}</p>
                      <p className="text-sm text-muted">
                        {entry.actor === "REVIEWER" ? "Our review team" : "You or your team"} · <time dateTime={entry.at}>{formatWhen(entry.at)}</time>
                      </p>
                      {entry.reason && <p className="mt-1 whitespace-pre-line text-sm text-ink">{entry.reason}</p>}
                    </li>
                  ))}
                </ol>
              </Card>
            </section>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={dialog?.title ?? ""}
        confirmLabel={dialog?.confirm ?? ""}
        busyLabel="Working…"
        tone={pending?.action === "relist" ? "primary" : "danger"}
        busy={acting}
        error={actionError}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && void runAction(pending)}
      >
        {dialog?.body}
      </ConfirmDialog>
    </>
  );
}

/**
 * `/agent/listings/<id>`: one listing, edited section by section and saved
 * automatically, with its photos, what is still needed before it can be
 * submitted, and the actions the API allows.
 */
export function ListingEditor(props: Props) {
  return <RequireAuth>{() => <Editor {...props} />}</RequireAuth>;
}

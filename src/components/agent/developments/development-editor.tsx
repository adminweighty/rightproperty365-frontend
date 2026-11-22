"use client";

import { ExternalLink, Lock, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, type FormEvent, type ReactNode } from "react";
import { DeveloperShell, readsEnquiries, withOrg } from "@/components/agent/developments/developer-shell";
import { DevelopmentEnquiries } from "@/components/agent/developments/development-enquiries";
import { DevelopmentPhotos } from "@/components/agent/developments/development-photos";
import { LinkedListings } from "@/components/agent/developments/linked-listings";
import { PhasesEditor } from "@/components/agent/developments/phases-editor";
import { LocationPicker } from "@/components/map/maps";
import { formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { Membership } from "@/lib/api/auth";
import {
  deleteDevelopment,
  getDevelopment,
  submitDevelopment,
  updateDevelopment,
  withdrawDevelopment,
  type DevelopmentFields,
} from "@/lib/api/developments";
import type { ApiFailure } from "@/lib/api/http";
import type { DevelopmentEditorLists } from "@/lib/api/server/listing-editor";
import {
  CONTACT_DETAILS_MESSAGE,
  containsContactDetails,
  DEVELOPMENT_STATUSES,
  developmentPath,
  developmentStatusLabel,
  developmentStatusLabels,
  developmentStatusTone,
  isLocked,
  lockText,
  moderationStatusLabel,
  moderationStatusTone,
  parseCompletionInput,
  type DevelopmentStatusCode,
  type ManagedDevelopment,
} from "@/lib/developments";
import { env } from "@/lib/env";
import { coordinateForInput, parseCoordinatePair } from "@/lib/map";
import { formatInstant } from "@/lib/time-zone";
import { currentViewerZone } from "@/lib/display-zone";

// ---- The form's values ------------------------------------------------------------

type Highlight = { label: string; value: string };

type Values = {
  name: string;
  slug: string;
  status: string;
  completion: string;
  summary: string;
  description: string;
  city: string;
  suburb: string;
  city_name: string;
  latitude: string;
  longitude: string;
  approximate: boolean;
  amenities: string[];
  highlights: Highlight[];
  youtube_url: string;
};

const MAX_HIGHLIGHTS = 6;

function fromDevelopment(development: ManagedDevelopment): Values {
  const coordinates = development.location.coordinates;
  return {
    name: development.name ?? "",
    slug: development.slug ?? "",
    status: development.status.code,
    completion: development.completion?.value ?? "",
    summary: development.summary ?? "",
    description: development.description ?? "",
    city: development.location.city?.code ?? "",
    suburb: development.location.suburb?.code ?? "",
    city_name: development.city_name ?? "",
    latitude: coordinateForInput(coordinates?.latitude),
    longitude: coordinateForInput(coordinates?.longitude),
    approximate: coordinates?.precision === "APPROXIMATE",
    amenities: development.amenities.map((amenity) => amenity.code),
    highlights: development.investment_highlights.items.map((item) => ({ ...item })),
    youtube_url: development.youtube_url ?? "",
  };
}

type Errors = Record<string, string>;

const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();
const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((item, index) => item === b[index]);

/** The PATCH of what changed since the project was read, or what keeps it from being sent. */
function buildPatch(values: Values, initial: Values, hasReferenceCities: boolean): { fields: DevelopmentFields } | { errors: Errors } {
  const errors: Errors = {};
  const fields: DevelopmentFields = {};
  // The API refuses free text with contact details (400); say so before sending.
  const plain = (key: "name" | "summary" | "description" | "city_name", value: string) => {
    if (containsContactDetails(value)) errors[key] = CONTACT_DETAILS_MESSAGE;
  };

  const name = oneLine(values.name);
  if (!name) errors.name = "Enter the project's name.";
  else if (name.length > 120) errors.name = "Keep the name to 120 characters or fewer.";
  else plain("name", name);
  if (name !== oneLine(initial.name)) fields.name = name;

  const slug = values.slug.trim().toLowerCase();
  if (slug !== initial.slug) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
      errors.slug = "Use lower-case letters, digits and single hyphens, at most 80, such as borrowdale-heights.";
    } else fields.slug = slug;
  }

  if (values.status !== initial.status) fields.status = values.status as DevelopmentStatusCode;

  const completion = parseCompletionInput(values.completion);
  if (!completion.ok) errors.completion_estimate = completion.message;
  else if (values.completion.trim() !== initial.completion) fields.completion_estimate = completion.value;

  const summary = oneLine(values.summary);
  if (summary.length > 200) errors.summary = "Keep the summary to 200 characters or fewer.";
  else plain("summary", summary);
  if (summary !== oneLine(initial.summary)) fields.summary = summary;

  const description = values.description.trim();
  if (description.length > 5000) errors.description = "Keep the description to 5,000 characters or fewer.";
  else plain("description", description);
  if (description !== initial.description.trim()) fields.description = description;

  if (hasReferenceCities) {
    // A suburb must be in the city, so a new city is sent with its suburb (or none).
    if (values.city !== initial.city) {
      fields.city = values.city || null;
      fields.suburb = values.suburb || null;
    } else if (values.suburb !== initial.suburb) fields.suburb = values.suburb || null;
  } else {
    const cityName = oneLine(values.city_name);
    if (cityName.length > 120) errors.city_name = "Keep the city to 120 characters or fewer.";
    else plain("city_name", cityName);
    if (cityName !== oneLine(initial.city_name)) fields.city_name = cityName || null;
  }

  const pair = parseCoordinatePair(values.latitude, values.longitude);
  if (!pair.ok) Object.assign(errors, pair.errors);
  else {
    const before = parseCoordinatePair(initial.latitude, initial.longitude);
    const was = before.ok ? before.value : null;
    const now = pair.value;
    const moved = (was?.latitude ?? null) !== (now?.latitude ?? null) || (was?.longitude ?? null) !== (now?.longitude ?? null);
    if (moved) {
      fields.latitude = now?.latitude ?? null;
      fields.longitude = now?.longitude ?? null;
    }
    if (now && (moved || values.approximate !== initial.approximate)) {
      fields.location_precision = values.approximate ? "APPROXIMATE" : "EXACT";
    }
  }

  if (!sameList([...values.amenities].sort(), [...initial.amenities].sort())) {
    if (values.amenities.length > 30) errors.amenities = "Choose at most 30 amenities.";
    else fields.amenities = values.amenities;
  }

  const highlights = values.highlights
    .map((item) => ({ label: oneLine(item.label), value: oneLine(item.value) }))
    .filter((item) => item.label || item.value);
  highlights.forEach((item, index) => {
    if (!item.label) errors[`investment_highlights.${index}.label`] = "Give this highlight a label, or remove it.";
    else if (item.label.length > 60) errors[`investment_highlights.${index}.label`] = "Keep the label to 60 characters or fewer.";
    if (!item.value) errors[`investment_highlights.${index}.value`] = "Give this highlight a value, or remove it.";
    else if (item.value.length > 120) errors[`investment_highlights.${index}.value`] = "Keep the value to 120 characters or fewer.";
    if (containsContactDetails(`${item.label} ${item.value}`)) errors[`investment_highlights.${index}.value`] = CONTACT_DETAILS_MESSAGE;
  });
  if (highlights.length > MAX_HIGHLIGHTS) errors.investment_highlights = `Add at most ${MAX_HIGHLIGHTS} highlights.`;
  const highlightsBefore = initial.highlights.map((item) => `${item.label}\u0000${item.value}`);
  if (!sameList(highlights.map((item) => `${item.label}\u0000${item.value}`), highlightsBefore)) fields.investment_highlights = highlights;

  const youtube = values.youtube_url.trim();
  if (youtube !== initial.youtube_url) fields.youtube_url = youtube || null;

  return Object.keys(errors).length > 0 ? { errors } : { fields };
}

/** Plain words for the API's names of what a submission is missing. */
const missingLabels: Record<string, string> = {
  name: "A name",
  summary: "A one-line summary",
  description: "A description",
  city: "A city",
  city_name: "A city",
  photos: "At least one photo, with its description",
  phases: "At least one phase with one unit type",
  unit_types: "At least one unit type",
};

// ---- Pieces --------------------------------------------------------------------------

function Section({ id, title, intro, children }: { id: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="scroll-mt-24">
      <Card>
        <h2 id={id} className="text-2xl">
          {title}
        </h2>
        {intro && <div className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">{intro}</div>}
        <div className="mt-5">{children}</div>
      </Card>
    </section>
  );
}

const CONFLICTS = new Set(["DEVELOPMENT_LOCKED", "DEVELOPMENT_STATE_CONFLICT", "DEVELOPMENT_CHANGED"]);

type EditorProps = {
  developmentId: string;
  lists: DevelopmentEditorLists;
  contactMethodLabels: Record<string, string>;
};

function DetailsForm({
  development,
  organisationId,
  lists,
  editable,
  onSaved,
  onConflict,
}: {
  development: ManagedDevelopment;
  organisationId: string;
  lists: DevelopmentEditorLists;
  editable: boolean;
  onSaved: (development: ManagedDevelopment) => void;
  onConflict: (message: string) => void;
}) {
  const [initial, setInitial] = useState(() => fromDevelopment(development));
  const [values, setValues] = useState(initial);
  const [seen, setSeen] = useState(development.updated_at);
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  // A newer copy of the project (after another change) replaces the form, unless something is being typed.
  if (development.updated_at !== seen) {
    setSeen(development.updated_at);
    const next = fromDevelopment(development);
    const untouched = JSON.stringify(values) === JSON.stringify(initial);
    setInitial(next);
    if (untouched) setValues(next);
  }

  const market = development.market.code;
  const cities = lists.cities.filter((city) => city.country === market);
  const hasReferenceCities = cities.length > 0;
  const suburbs = lists.suburbs.filter((suburb) => suburb.parent === values.city);
  const set = (change: Partial<Values>) => {
    setValues((current) => ({ ...current, ...change }));
    setSaved(null);
  };
  const err = (key: string) => errors[key];
  const id = (key: string) => `development-${key}`;
  const describedBy = (key: string, hint?: string) => fieldDescribedBy(id(key), { hint, error: err(key) });
  const pinned = parseCoordinatePair(values.latitude, values.longitude);
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const built = buildPatch(values, initial, hasReferenceCities);
    setFailure(null);
    setSaved(null);
    if ("errors" in built) {
      setErrors(built.errors);
      const first = Object.keys(built.errors)[0];
      document.getElementById(id(first.replace(/\./g, "-")))?.focus();
      return;
    }
    setErrors({});
    if (Object.keys(built.fields).length === 0) {
      setSaved("Nothing to save: nothing has changed.");
      return;
    }
    setPending(true);
    const result = await updateDevelopment(organisationId, development.id, built.fields);
    setPending(false);
    if (result.ok) {
      const next = fromDevelopment(result.data.development);
      setInitial(next);
      setValues(next);
      setSeen(result.data.development.updated_at);
      setSaved(`Saved at ${formatInstant(new Date(), currentViewerZone(), { style: "time" })}.`);
      onSaved(result.data.development);
      return;
    }
    if (CONFLICTS.has(result.failure.code)) onConflict(result.failure.message);
    if (result.failure.fields) setErrors(result.failure.fields);
    setFailure(result.failure);
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <fieldset disabled={!editable} className="flex min-w-0 flex-col gap-5">
        <legend className="sr-only">Project details</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id={id("name")} label="Project name" error={err("name")}>
            <Input id={id("name")} value={values.name} maxLength={120} onChange={(event) => set({ name: event.target.value })} aria-invalid={Boolean(err("name"))} aria-describedby={describedBy("name")} />
          </Field>
          <Field
            id={id("slug")}
            label="Web address"
            hint={development.published_at ? "Fixed once the project has been published." : `rightproperty365.com/developments/${market.toLowerCase()}/…`}
            error={err("slug")}
          >
            <Input
              id={id("slug")}
              value={values.slug}
              maxLength={80}
              disabled={Boolean(development.published_at)}
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => set({ slug: event.target.value })}
              aria-invalid={Boolean(err("slug"))}
              aria-describedby={describedBy("slug", "x")}
            />
          </Field>
          <Field id={id("status")} label="Construction status" error={err("status")}>
            <SearchableSelect
              id={id("status")}
              value={values.status}
              onValueChange={(value) => set({ status: value })}
              disabled={!editable}
              options={DEVELOPMENT_STATUSES.map((code) => ({ value: code, label: developmentStatusLabels[code] }))}
              aria-invalid={Boolean(err("status"))}
              aria-describedby={describedBy("status")}
            />
          </Field>
          <Field id={id("completion_estimate")} label="Completion estimate" optional hint="A quarter such as 2027-Q3, or a date such as 2027-06-30." error={err("completion_estimate")}>
            <Input
              id={id("completion_estimate")}
              value={values.completion}
              maxLength={10}
              placeholder="2027-Q3"
              autoComplete="off"
              onChange={(event) => set({ completion: event.target.value })}
              aria-invalid={Boolean(err("completion_estimate"))}
              aria-describedby={describedBy("completion_estimate", "x")}
            />
          </Field>
        </div>
        <Field id={id("summary")} label="Summary" hint="One line for the project card, up to 200 characters." error={err("summary")}>
          <Input id={id("summary")} value={values.summary} maxLength={200} onChange={(event) => set({ summary: event.target.value })} aria-invalid={Boolean(err("summary"))} aria-describedby={describedBy("summary", "x")} />
        </Field>
        <Field id={id("description")} label="Description" hint="What is being built, the setting, and what buyers get. Plain text, up to 5,000 characters." error={err("description")}>
          <Textarea id={id("description")} rows={8} value={values.description} maxLength={5000} onChange={(event) => set({ description: event.target.value })} aria-invalid={Boolean(err("description"))} aria-describedby={describedBy("description", "x")} />
        </Field>
        <p className="text-sm text-muted">{CONTACT_DETAILS_MESSAGE}</p>

        <div className="grid gap-5 sm:grid-cols-2">
          {hasReferenceCities ? (
            <>
              <Field id={id("city")} label="City" error={err("city")}>
                <SearchableSelect
                  id={id("city")}
                  value={values.city}
                  disabled={!editable}
                  onValueChange={(value) => set({ city: value, suburb: value === values.city ? values.suburb : "" })}
                  options={[{ value: "", label: "Choose a city" }, ...cities]}
                  aria-invalid={Boolean(err("city"))}
                  aria-describedby={describedBy("city")}
                />
              </Field>
              <Field id={id("suburb")} label="Suburb" optional error={err("suburb")}>
                <SearchableSelect
                  id={id("suburb")}
                  value={values.suburb}
                  disabled={!editable || !values.city || suburbs.length === 0}
                  onValueChange={(value) => set({ suburb: value })}
                  options={[{ value: "", label: suburbs.length === 0 ? "No suburbs listed" : "Any suburb" }, ...suburbs]}
                  aria-invalid={Boolean(err("suburb"))}
                  aria-describedby={describedBy("suburb")}
                />
              </Field>
            </>
          ) : (
            <Field id={id("city_name")} label="City or town" hint={`${development.market.name} has no list of cities yet: type it.`} error={err("city_name")}>
              <Input id={id("city_name")} value={values.city_name} maxLength={120} onChange={(event) => set({ city_name: event.target.value })} aria-invalid={Boolean(err("city_name"))} aria-describedby={describedBy("city_name", "x")} />
            </Field>
          )}
        </div>
        <p className="text-sm text-muted">There is no street address: the public page shows the suburb, city and the position on the map only.</p>

        <fieldset className="min-w-0">
          <legend className="text-sm font-medium text-ink">
            Position on the map <span className="font-normal text-subtle">(optional)</span>
          </legend>
          {env.map && (
            <div className="mt-2">
              <LocationPicker
                latitude={pinned.ok ? (pinned.value?.latitude ?? null) : null}
                longitude={pinned.ok ? (pinned.value?.longitude ?? null) : null}
                approximate={values.approximate}
                disabled={!editable}
                onPick={(latitude, longitude) => set({ latitude: coordinateForInput(latitude), longitude: coordinateForInput(longitude) })}
              />
            </div>
          )}
          <div className="mt-3 grid gap-5 sm:grid-cols-2">
            <Field id={id("latitude")} label="Latitude" optional hint="From -90 to 90, such as -17.75. Up to 6 decimals." error={err("latitude")}>
              <Input id={id("latitude")} inputMode="decimal" autoComplete="off" spellCheck={false} maxLength={12} value={values.latitude} onChange={(event) => set({ latitude: event.target.value })} aria-invalid={Boolean(err("latitude"))} aria-describedby={describedBy("latitude", "x")} />
            </Field>
            <Field id={id("longitude")} label="Longitude" optional hint="From -180 to 180, such as 31.09. Up to 6 decimals." error={err("longitude")}>
              <Input id={id("longitude")} inputMode="decimal" autoComplete="off" spellCheck={false} maxLength={12} value={values.longitude} onChange={(event) => set({ longitude: event.target.value })} aria-invalid={Boolean(err("longitude"))} aria-describedby={describedBy("longitude", "x")} />
            </Field>
          </div>
          <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-3 text-ink">
            <input type="checkbox" className="size-5 accent-primary" checked={values.approximate} onChange={(event) => set({ approximate: event.currentTarget.checked })} aria-describedby={id("approximate-hint")} />
            Show only the approximate area publicly
          </label>
          <p id={id("approximate-hint")} className="text-sm text-muted">
            Visitors then see an area about 1 km across instead of the pin. You and our review team still see the exact position.
          </p>
        </fieldset>

        {lists.amenities.length > 0 && (
          <fieldset id={id("amenities")} tabIndex={-1} className="min-w-0" aria-describedby={err("amenities") ? id("amenities-error") : undefined}>
            <legend className="text-sm font-medium text-ink">
              Amenities <span className="font-normal text-subtle">(optional)</span>
            </legend>
            <ul className="mt-1 grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
              {lists.amenities.map((amenity) => {
                const checked = values.amenities.includes(amenity.value);
                return (
                  <li key={amenity.value}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-ink">
                      <input
                        type="checkbox"
                        className="size-5 accent-primary"
                        checked={checked}
                        onChange={() =>
                          set({ amenities: checked ? values.amenities.filter((code) => code !== amenity.value) : [...values.amenities, amenity.value] })
                        }
                      />
                      {amenity.label}
                    </label>
                  </li>
                );
              })}
            </ul>
            {err("amenities") && (
              <p id={id("amenities-error")} className="mt-1 text-sm text-danger">
                {err("amenities")}
              </p>
            )}
          </fieldset>
        )}

        <fieldset className="min-w-0">
          <legend className="text-sm font-medium text-ink">
            Investment highlights <span className="font-normal text-subtle">(optional, up to {MAX_HIGHLIGHTS})</span>
          </legend>
          <p className="mt-1 text-sm text-muted">
            Figures such as an expected rental yield. They are shown as your statements, with the words &ldquo;Stated by the developer — not financial advice&rdquo;.
          </p>
          {err("investment_highlights") && <p className="mt-1 text-sm text-danger">{err("investment_highlights")}</p>}
          <ul className="mt-3 space-y-3">
            {values.highlights.map((item, index) => {
              const labelKey = `investment_highlights.${index}.label`;
              const valueKey = `investment_highlights.${index}.value`;
              const labelId = id(`investment_highlights-${index}-label`);
              const valueId = id(`investment_highlights-${index}-value`);
              return (
                <li key={index} className="grid gap-3 rounded-md border border-line p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-end">
                  <Field id={labelId} label={`Highlight ${index + 1}: label`} error={err(labelKey)}>
                    <Input id={labelId} value={item.label} maxLength={60} placeholder="Expected rental yield" onChange={(event) => set({ highlights: values.highlights.map((row, at) => (at === index ? { ...row, label: event.target.value } : row)) })} aria-invalid={Boolean(err(labelKey))} aria-describedby={fieldDescribedBy(labelId, { error: err(labelKey) })} />
                  </Field>
                  <Field id={valueId} label="Value" error={err(valueKey)}>
                    <Input id={valueId} value={item.value} maxLength={120} placeholder="8–10% a year" onChange={(event) => set({ highlights: values.highlights.map((row, at) => (at === index ? { ...row, value: event.target.value } : row)) })} aria-invalid={Boolean(err(valueKey))} aria-describedby={fieldDescribedBy(valueId, { error: err(valueKey) })} />
                  </Field>
                  <Button variant="ghost" className="text-danger" onClick={() => set({ highlights: values.highlights.filter((_, at) => at !== index) })}>
                    <X className="size-4" aria-hidden="true" />
                    Remove<span className="sr-only"> highlight {index + 1}</span>
                  </Button>
                </li>
              );
            })}
          </ul>
          {values.highlights.length < MAX_HIGHLIGHTS && (
            <Button variant="secondary" className="mt-3" onClick={() => set({ highlights: [...values.highlights, { label: "", value: "" }] })}>
              <Plus className="size-4" aria-hidden="true" />
              Add a highlight
            </Button>
          )}
        </fieldset>

        <Field id={id("youtube_url")} label="YouTube video" optional hint="A watch or share link, such as https://youtu.be/… Leave empty for none." error={err("youtube_url")}>
          <Input id={id("youtube_url")} type="url" inputMode="url" spellCheck={false} autoComplete="off" value={values.youtube_url} onChange={(event) => set({ youtube_url: event.target.value })} aria-invalid={Boolean(err("youtube_url"))} aria-describedby={describedBy("youtube_url", "x")} />
        </Field>
      </fieldset>

      {failure && <Alert title={failure.fields ? "Some details need a change. Each one is marked above." : failure.message} traceId={failure.traceId} />}
      {editable && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" disabled={pending} aria-busy={pending || undefined}>
            {pending ? "Saving…" : "Save the details"}
          </Button>
          {dirty && !pending && (
            <Button variant="secondary" onClick={() => { setValues(initial); setErrors({}); setFailure(null); }}>
              Undo changes
            </Button>
          )}
          <p role="status" className="text-sm text-muted">
            {saved ?? (dirty ? "You have changes that are not saved." : "")}
          </p>
        </div>
      )}
    </form>
  );
}

function Editor({ membership, developmentId, lists, contactMethodLabels }: EditorProps & { membership: Membership }) {
  const organisationId = membership.organisation_id;
  const router = useRouter();
  const load = useCallback(() => getDevelopment(organisationId, developmentId), [organisationId, developmentId]);
  const { state, reload, replace } = useApi(load);
  const [notice, setNotice] = useState<{ tone: "success" | "warning" | "danger"; title: string; items?: string[] } | null>(null);
  const [busy, setBusy] = useState<"submit" | "withdraw" | "delete" | null>(null);
  const [confirm, setConfirm] = useState<"withdraw" | "delete" | null>(null);
  const [confirmError, setConfirmError] = useState<string | undefined>();

  if (state.status === "loading") return <LoadingBlock label="Loading the project" rows={4} />;
  if (state.status === "error") {
    if (state.failure.code === "DEVELOPMENT_NOT_FOUND" || state.failure.status === 404) {
      return (
        <Alert title="We could not find that project" className="mt-6">
          It may have been deleted, or it belongs to another organisation.{" "}
          <Link href={withOrg("/agent/developments", organisationId)} className="font-medium underline">
            Back to your projects
          </Link>
        </Alert>
      );
    }
    return <LoadError failure={state.failure} onRetry={reload} />;
  }

  const development = state.data.development;
  const setDevelopment = (next: ManagedDevelopment) => replace({ development: next });
  const status = development.moderation_status;
  const locked = isLocked(status);
  const canAct = development.actions.length > 0;
  const editableFields = development.actions.includes("edit") && !locked;
  const lock = lockText(status);
  const publicPath = status === "PUBLISHED" && development.public_url_path ? developmentPath(development) : null;
  const marketCurrency = lists.countries.find((country) => country.value === development.market.code)?.currency ?? "USD";
  const onConflict = (message: string) => {
    setNotice({ tone: "warning", title: `${message} The project has been read again.` });
    reload();
  };

  async function act(kind: "submit" | "withdraw" | "delete") {
    setBusy(kind);
    setConfirmError(undefined);
    if (kind === "delete") {
      const result = await deleteDevelopment(organisationId, development.id);
      setBusy(null);
      if (result.ok) {
        router.push(withOrg("/agent/developments", organisationId));
        return;
      }
      setConfirmError(result.failure.message);
      return;
    }
    const result = kind === "submit" ? await submitDevelopment(organisationId, development.id) : await withdrawDevelopment(organisationId, development.id);
    setBusy(null);
    if (result.ok) {
      setConfirm(null);
      setDevelopment(result.data.development);
      setNotice(
        kind === "submit"
          ? { tone: "success", title: "Submitted for review. We will let you know when our team has decided; until then the details and photos are locked." }
          : { tone: "success", title: "Withdrawn to a draft. It is not public now; edit it and submit it again." },
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (kind === "withdraw") {
      setConfirmError(result.failure.message);
      return;
    }
    if (result.failure.code === "DEVELOPMENT_INCOMPLETE" && result.failure.fields) {
      setNotice({
        tone: "danger",
        title: "The project is not ready to submit yet. It still needs:",
        items: Object.entries(result.failure.fields).map(([field, message]) => `${missingLabels[field] ?? message}${missingLabels[field] ? ` (${message})` : ""}`),
      });
    } else {
      setNotice({ tone: "danger", title: result.failure.message });
      if (CONFLICTS.has(result.failure.code)) reload();
    }
  }

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge tone={moderationStatusTone(status)}>{moderationStatusLabel(status)}</Badge>
        <Badge tone={developmentStatusTone(development.status.code)}>{developmentStatusLabel(development.status)}</Badge>
        <Badge>{development.market.name}</Badge>
      </div>
      <h1 className="mt-3 break-words text-3xl md:text-4xl">{development.name || "Untitled project"}</h1>
      <p className="mt-2 text-sm text-muted">
        Shown on the profile of {development.developer.name}
        {development.submitted_at && ` · Submitted ${formatWhen(development.submitted_at)}`}
        {development.published_at && ` · Published ${formatWhen(development.published_at)}`}
      </p>

      {notice && (
        <Alert tone={notice.tone} title={notice.title} className="mt-6">
          {notice.items && (
            <ul className="list-disc pl-5">
              {notice.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </Alert>
      )}
      {status === "REJECTED" && (
        <Alert tone="danger" title="Our team did not approve this project" className="mt-6">
          {development.review_reason && <p className="whitespace-pre-line">{development.review_reason}</p>}
          <p className="mt-1">Change what the reason says, then submit it again. It stays rejected until you do.</p>
        </Alert>
      )}
      {lock && (
        <div className="mt-6 flex items-start gap-3 rounded-md bg-info-soft p-4 text-sm text-ink">
          <Lock className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
          <p>{lock}</p>
        </div>
      )}
      {!canAct && (
        <Alert tone="info" title="You can read this project but not change it" className="mt-6">
          Staff members read projects. Ask an Owner, Manager or Agent of {membership.organisation_name} to make changes.
        </Alert>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        {development.actions.includes("submit") && (
          <Button onClick={() => void act("submit")} disabled={busy !== null} aria-busy={busy === "submit" || undefined}>
            {busy === "submit" ? "Submitting…" : status === "REJECTED" ? "Submit again for review" : "Submit for review"}
          </Button>
        )}
        {development.actions.includes("withdraw") && (
          <Button variant="secondary" onClick={() => setConfirm("withdraw")} disabled={busy !== null}>
            Withdraw to a draft
          </Button>
        )}
        {publicPath && (
          <Link href={publicPath} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-1.5 px-2 text-sm font-semibold text-primary-ink hover:underline">
            View the public page
            <ExternalLink className="size-4" aria-hidden="true" />
            <span className="sr-only"> (opens in a new tab)</span>
          </Link>
        )}
        {development.actions.includes("delete") && (
          <Button variant="ghost" className="text-danger sm:ml-auto" onClick={() => setConfirm("delete")} disabled={busy !== null}>
            <Trash2 className="size-4" aria-hidden="true" />
            Delete the project
          </Button>
        )}
      </div>

      <div className="mt-8 space-y-8">
        <Section id="section-details" title="Details" intro={locked ? "Locked while the project waits for review or is public." : "Saved when you press Save the details."}>
          <DetailsForm
            development={development}
            organisationId={organisationId}
            lists={lists}
            editable={editableFields}
            onSaved={setDevelopment}
            onConflict={onConflict}
          />
        </Section>

        <Section
          id="section-photos"
          title="Photos"
          intro="Up to 20. The first is the cover on the project card. Every photo needs a description before the project can be submitted. Locked while the project waits for review or is public."
        >
          <DevelopmentPhotos organisationId={organisationId} development={development} editable={editableFields} onChange={setDevelopment} onConflict={onConflict} />
        </Section>

        <Section
          id="section-phases"
          title="Phases and unit types"
          intro="Up to 10 phases, each with up to 20 unit types. Prices are exact, as you type them, or Price on request. These stay editable while the project is under review or public, and changes apply at once."
        >
          <PhasesEditor
            organisationId={organisationId}
            development={development}
            editable={canAct}
            defaultCurrency={marketCurrency}
            currencies={lists.currencies}
            onChange={setDevelopment}
            onConflict={onConflict}
          />
        </Section>

        <Section
          id="section-listings"
          title="Linked listings"
          intro="Your organisation's listings of units in this project. While a listing is public it shows under Available units on the project page. Links change at once."
        >
          <LinkedListings organisationId={organisationId} development={development} editable={canAct} onChange={setDevelopment} />
        </Section>

        {readsEnquiries(membership) && (
          <Section id="section-enquiries" title="Enquiries" intro="Customers who enquired from the project's page, with how to reply. Only Owners and Managers see these.">
            <DevelopmentEnquiries organisationId={organisationId} developmentId={development.id} contactMethodLabels={contactMethodLabels} />
          </Section>
        )}
      </div>

      <ConfirmDialog
        open={confirm === "withdraw"}
        title="Withdraw this project to a draft?"
        confirmLabel="Yes, withdraw it"
        busyLabel="Withdrawing…"
        busy={busy === "withdraw"}
        error={confirmError}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void act("withdraw")}
      >
        {status === "PUBLISHED"
          ? "It leaves the public site at once, and your profile no longer shows it. You can then edit it and submit it again; it is public again once approved."
          : "The review stops. You can then edit it and submit it again."}
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === "delete"}
        title="Delete this project?"
        confirmLabel="Yes, delete it"
        busyLabel="Deleting…"
        busy={busy === "delete"}
        error={confirmError}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void act("delete")}
      >
        The project, its phases, unit types and photos are deleted, and its listings are unlinked (the listings themselves stay). This cannot be undone.
      </ConfirmDialog>
    </>
  );
}

/** `/agent/developments/[id]`: edit a project, its photos, phases, unit types and linked listings, and read its enquiries. */
export function DevelopmentEditor(props: EditorProps) {
  return (
    <DeveloperShell back={{ href: "/agent/developments", label: "Development projects" }}>
      {(membership) => <Editor key={membership.organisation_id} membership={membership} {...props} />}
    </DeveloperShell>
  );
}

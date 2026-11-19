"use client";

import { ExternalLink, Link2, Unlink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SearchableSelect, type SelectItem } from "@/components/ui/searchable-select";
import { listMyListings } from "@/lib/api/availability";
import { linkListing, unlinkListing } from "@/lib/api/developments";
import type { ManagedDevelopment } from "@/lib/developments";

type Props = {
  organisationId: string;
  development: ManagedDevelopment;
  editable: boolean;
  onChange: (development: ManagedDevelopment) => void;
};

const NONE = "";
const loadMyListings = () => listMyListings(1);

/**
 * The organisation's listings shown as "Available units" on the project
 * page, each optionally under one unit type. Only listings that are public at
 * that moment appear publicly. Links change at once, also while the project
 * waits for review or is public.
 */
export function LinkedListings({ organisationId, development, editable, onChange }: Props) {
  const { state, reload } = useApi(loadMyListings);
  const [chosen, setChosen] = useState("");
  const [unitTypeId, setUnitTypeId] = useState(NONE);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const unitTypes: SelectItem[] = [
    { value: NONE, label: "No particular unit type" },
    ...development.phases.map((phase) => ({
      label: phase.name,
      options: phase.unit_types.map((unit) => ({ value: unit.id, label: unit.name })),
    })),
  ];
  const linkedIds = new Set(development.linked_listings.map((item) => item.listing_id));

  async function run(key: string, action: () => ReturnType<typeof linkListing>, done: string) {
    setBusy(key);
    setError(null);
    const result = await action();
    setBusy(null);
    if (!result.ok) {
      setError(
        result.failure.code === "LISTING_ALREADY_LINKED"
          ? "That listing is already linked to another project. Unlink it there first."
          : result.failure.code === "LISTING_NOT_FOUND"
            ? "That listing is not one of your organisation's listings."
            : result.failure.message,
      );
      return false;
    }
    onChange(result.data.development);
    setAnnouncement(done);
    return true;
  }

  return (
    <div>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {development.linked_listings.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong p-6 text-center text-muted">
          No listings are linked yet. Link the published listings of units in this project and they show as
          &ldquo;Available units&rdquo; on its page.
        </p>
      ) : (
        <ul className="space-y-3">
          {development.linked_listings.map((item) => (
            <li key={item.listing_id} className="rounded-md border border-line bg-surface p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 flex-1 break-words font-medium text-ink">{item.title || "Untitled listing"}</p>
                <Badge tone={item.public ? "success" : "neutral"}>{item.public ? "Public" : "Not public now"}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted">
                Reference {item.reference}
                {item.public && (
                  <>
                    {" · "}
                    <Link href={`/listings/${item.slug}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-medium text-primary-ink hover:underline">
                      View
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                      <span className="sr-only"> {item.title} (opens in a new tab)</span>
                    </Link>
                  </>
                )}
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <Field id={`linked-${item.listing_id}-unit`} label="Unit type" className="min-w-0 flex-1 basis-56">
                  <SearchableSelect
                    id={`linked-${item.listing_id}-unit`}
                    value={item.unit_type_id ?? NONE}
                    disabled={!editable || busy !== null}
                    options={unitTypes}
                    onValueChange={(value) =>
                      void run(
                        item.listing_id,
                        () => linkListing(organisationId, development.id, item.listing_id, value || null),
                        `The unit type of ${item.title} was changed.`,
                      )
                    }
                  />
                </Field>
                {editable && (
                  <Button
                    variant="ghost"
                    className="text-danger"
                    disabled={busy !== null}
                    aria-busy={busy === `unlink-${item.listing_id}` || undefined}
                    onClick={() =>
                      void run(
                        `unlink-${item.listing_id}`,
                        () => unlinkListing(organisationId, development.id, item.listing_id),
                        `${item.title} was unlinked.`,
                      )
                    }
                  >
                    <Unlink className="size-4" aria-hidden="true" />
                    Unlink<span className="sr-only"> {item.title}</span>
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && <Alert title={error} className="mt-4" />}

      {editable && (
        <div className="mt-6 rounded-lg border border-line bg-soft p-4">
          <h3 className="font-sans text-base font-semibold tracking-normal">Link a listing</h3>
          <div className="mt-3">
            {state.status === "loading" && <LoadingBlock label="Loading your listings" rows={1} />}
            {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
            {state.status === "ready" && (() => {
              const options = state.data.items
                .filter((listing) => !linkedIds.has(listing.id))
                .map((listing) => ({ value: listing.id, label: listing.title || listing.reference, secondary: listing.reference }));
              if (options.length === 0) {
                return <p className="text-sm text-muted">Every listing you manage is linked already, or you have none yet.</p>;
              }
              return (
                <form
                  className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (!chosen) {
                      setError("Choose the listing to link.");
                      return;
                    }
                    const title = options.find((option) => option.value === chosen)?.label ?? "The listing";
                    const ok = await run("link", () => linkListing(organisationId, development.id, chosen, unitTypeId || null), `${title} was linked.`);
                    if (ok) {
                      setChosen("");
                      setUnitTypeId(NONE);
                    }
                  }}
                >
                  <Field id="link-listing" label="Listing">
                    <SearchableSelect
                      id="link-listing"
                      value={chosen}
                      onValueChange={setChosen}
                      options={[{ value: "", label: "Choose a listing" }, ...options]}
                    />
                  </Field>
                  <Field id="link-unit-type" label="Unit type" optional>
                    <SearchableSelect id="link-unit-type" value={unitTypeId} onValueChange={setUnitTypeId} options={unitTypes} />
                  </Field>
                  <Button type="submit" disabled={busy !== null} aria-busy={busy === "link" || undefined}>
                    <Link2 className="size-4" aria-hidden="true" />
                    {busy === "link" ? "Linking…" : "Link"}
                  </Button>
                </form>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import { RoleGate } from "@/components/admin/admin-gate";
import {
  BackLink,
  ChipNav,
  EmptyState,
  formatWhen,
  LoadError,
  LoadingBlock,
} from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Field,
  fieldDescribedBy,
  Input,
  Textarea,
} from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { PLACEMENT_ROLES } from "@/lib/api/auth";
import {
  endPlacement,
  grantPlacement,
  listingByReference,
  listPlacements,
  placementErrorText,
  type Placement,
  type PlacementKind,
  type PlacementStatus,
} from "@/lib/api/placements";

type Outcome = {
  tone: "success" | "danger";
  text: string;
  traceId?: string;
} | null;

const STATUSES: { key: PlacementStatus | ""; label: string }[] = [
  { key: "", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "SCHEDULED", label: "Scheduled" },
  { key: "ENDED", label: "Ended" },
];

const statusTone = {
  ACTIVE: "success",
  SCHEDULED: "info",
  ENDED: "neutral",
} as const;

/** A datetime-local value ("2026-11-21T10:00", browser time) as RFC 3339, or undefined. */
function toUtc(local: string): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  return Number.isNaN(d.getTime())
    ? undefined
    : d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function GrantForm({ onGranted }: { onGranted: (p: Placement) => void }) {
  const [reference, setReference] = useState("");
  const [listing, setListing] = useState<{
    id: string;
    title: string;
    reference: string;
  } | null>(null);
  const [kind, setKind] = useState<PlacementKind>("FEATURED");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [subscription, setSubscription] = useState("");
  const [note, setNote] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [busy, setBusy] = useState(false);

  async function find() {
    setListing(null);
    setFields({});
    if (!reference.trim()) {
      setFields({
        reference: "Enter the listing's reference, such as RP-ZW-10001.",
      });
      return;
    }
    const answer = await listingByReference(reference);
    if (!answer.ok || answer.data.items.length === 0) {
      setFields({ reference: "No public listing has this reference." });
      return;
    }
    const l = answer.data.items[0];
    setListing({ id: l.id, title: l.title, reference: l.reference });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!listing) {
      await find();
      return;
    }
    setBusy(true);
    const answer = await grantPlacement({
      listing_id: listing.id,
      kind,
      starts_at: toUtc(starts),
      ends_at: toUtc(ends) ?? "",
      subscription_id: subscription.trim() || undefined,
      note: note.trim() || undefined,
    });
    setBusy(false);
    if (answer.ok) {
      setFields({});
      setOutcome(null);
      setReference("");
      setListing(null);
      setNote("");
      onGranted(answer.data.placement);
      return;
    }
    setFields(answer.failure.fields ?? {});
    setOutcome(
      answer.failure.fields
        ? null
        : {
            tone: "danger",
            text:
              placementErrorText(answer.failure.code) ?? answer.failure.message,
            traceId: answer.failure.traceId,
          },
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <h2 className="text-xl sm:col-span-2">Give a listing a placement</h2>
      <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
        <Field
          id="pl-ref"
          label="Listing reference"
          error={fields.reference}
          className="min-w-0 flex-1 basis-56"
        >
          <Input
            id="pl-ref"
            value={reference}
            onChange={(e) => {
              setReference(e.target.value);
              setListing(null);
            }}
            aria-invalid={Boolean(fields.reference)}
            aria-describedby={fieldDescribedBy("pl-ref", {
              error: fields.reference,
            })}
          />
        </Field>
        <Button variant="secondary" onClick={() => void find()}>
          Find
        </Button>
      </div>
      {listing && (
        <p
          className="rounded-md bg-sunken p-3 text-sm text-ink sm:col-span-2"
          aria-live="polite"
        >
          {listing.reference}:{" "}
          <span className="font-medium">{listing.title}</span>
        </p>
      )}
      <Field id="pl-kind" label="Placement">
        <SearchableSelect
          id="pl-kind"
          value={kind}
          onValueChange={(v) => setKind(v as PlacementKind)}
          options={[
            { value: "FEATURED", label: "Featured" },
            { value: "SPONSORED", label: "Sponsored" },
          ]}
        />
      </Field>
      <Field
        id="pl-sub"
        label="Subscription ID"
        optional
        hint="Counts against that plan's featured listings."
        error={fields.subscription_id}
      >
        <Input
          id="pl-sub"
          value={subscription}
          onChange={(e) => setSubscription(e.target.value)}
          aria-describedby={fieldDescribedBy("pl-sub", {
            hint: "x",
            error: fields.subscription_id,
          })}
        />
      </Field>
      <Field
        id="pl-starts"
        label="Starts"
        optional
        hint="Now when left empty. Your local time."
        error={fields.starts_at}
      >
        <Input
          id="pl-starts"
          type="datetime-local"
          value={starts}
          onChange={(e) => setStarts(e.target.value)}
          aria-describedby={fieldDescribedBy("pl-starts", {
            hint: "x",
            error: fields.starts_at,
          })}
        />
      </Field>
      <Field
        id="pl-ends"
        label="Ends"
        hint="At most 366 days after the start."
        error={fields.ends_at}
      >
        <Input
          id="pl-ends"
          type="datetime-local"
          value={ends}
          onChange={(e) => setEnds(e.target.value)}
          aria-invalid={Boolean(fields.ends_at)}
          aria-describedby={fieldDescribedBy("pl-ends", {
            hint: "x",
            error: fields.ends_at,
          })}
        />
      </Field>
      <Field
        id="pl-note"
        label="Internal note"
        optional
        hint="Such as the invoice it was paid with. Not shown publicly."
        error={fields.note}
        className="sm:col-span-2"
      >
        <Textarea
          id="pl-note"
          rows={2}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={busy} aria-busy={busy}>
          {busy
            ? "Saving…"
            : listing
              ? "Give the placement"
              : "Find the listing"}
        </Button>
      </div>
      <div aria-live="polite" className="sm:col-span-2">
        {outcome && (
          <Alert
            tone={outcome.tone}
            title={outcome.text}
            traceId={outcome.traceId}
          />
        )}
      </div>
    </form>
  );
}

function List() {
  const params = useSearchParams();
  const status = (params.get("status") ?? "") as PlacementStatus | "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const load = useCallback(() => listPlacements(status, page), [status, page]);
  const { state, reload } = useApi(load);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [ending, setEnding] = useState<Placement | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [endError, setEndError] = useState<string | undefined>(undefined);
  const href = (s: string, p = 1) =>
    `/admin/placements?${new URLSearchParams({ ...(s ? { status: s } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;

  async function confirmEnd() {
    if (!ending) return;
    setBusy(true);
    const answer = await endPlacement(ending.id, reason);
    setBusy(false);
    if (!answer.ok) {
      setEndError(
        answer.failure.fields?.reason ??
          placementErrorText(answer.failure.code) ??
          answer.failure.message,
      );
      return;
    }
    setOutcome({
      tone: "success",
      text: `The placement of ${ending.listing.reference} has ended. The listing no longer shows it.`,
    });
    setEnding(null);
    reload();
  }

  return (
    <>
      <BackLink href="/admin">Administration</BackLink>
      <h1 className="mt-1 text-4xl">Featured and sponsored</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Paid placements: the listing shows “Featured” or “Sponsored”, comes
        first in search, and says the advertiser paid for it. Granting charges
        nothing; bill it with an invoice. Every change is in the audit log.
      </p>
      <Card className="mt-8">
        <GrantForm
          onGranted={(p) => {
            setOutcome({
              tone: "success",
              text: `${p.listing.reference} is ${p.label.toLowerCase()} from ${formatWhen(p.starts_at)} to ${formatWhen(p.ends_at)}.`,
            });
            reload();
          }}
        />
      </Card>
      <div aria-live="polite" className="mt-6">
        {outcome && (
          <Alert
            tone={outcome.tone}
            title={outcome.text}
            traceId={outcome.traceId}
          />
        )}
      </div>
      <div className="mt-6">
        <ChipNav
          label="Placement status"
          items={STATUSES.map((s) => ({
            key: s.key || "all",
            href: href(s.key),
            label: s.label,
            current: s.key === status,
          }))}
        />
      </div>
      {state.status === "loading" && (
        <LoadingBlock label="Loading placements" rows={3} />
      )}
      {state.status === "error" && (
        <LoadError failure={state.failure} onRetry={reload} />
      )}
      {state.status === "ready" &&
        (state.data.items.length === 0 ? (
          <div className="mt-6">
            <EmptyState title="No placements here" />
          </div>
        ) : (
          <>
            <ul className="mt-6 divide-y divide-line rounded-xl border border-line bg-surface">
              {state.data.items.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-start gap-3 px-4 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                      <a
                        href={`/listings/${p.listing.slug}`}
                        className="text-primary-ink hover:underline"
                      >
                        {p.listing.title}
                      </a>
                      <Badge tone="accent">{p.label}</Badge>
                      <Badge tone={statusTone[p.status]}>
                        {p.status === "ACTIVE"
                          ? "Active"
                          : p.status === "SCHEDULED"
                            ? "Scheduled"
                            : "Ended"}
                      </Badge>
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {p.listing.reference} · {p.listing.market_code} ·{" "}
                      {formatWhen(p.starts_at)} to{" "}
                      {formatWhen(
                        p.ended_at && p.ended_at < p.ends_at
                          ? p.ended_at
                          : p.ends_at,
                      )}
                      {" · "}granted by {p.granted_by}
                    </p>
                    {p.note && (
                      <p className="mt-1 text-sm text-muted">Note: {p.note}</p>
                    )}
                    {p.end_reason && (
                      <p className="mt-1 text-sm text-muted">
                        Ended: {p.end_reason}
                      </p>
                    )}
                  </div>
                  {p.status !== "ENDED" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setReason("");
                        setEndError(undefined);
                        setEnding(p);
                      }}
                    >
                      {p.status === "SCHEDULED" ? "Cancel" : "End now"}
                      <span className="sr-only">
                        {" "}
                        the placement of {p.listing.reference}
                      </span>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            <Pagination
              className="mt-8"
              page={state.data.page}
              totalPages={Math.ceil(state.data.total / state.data.page_size)}
              hrefFor={(p) => href(status, p)}
              label="Placements"
            />
          </>
        ))}
      <ConfirmDialog
        open={ending !== null}
        title={
          ending?.status === "SCHEDULED"
            ? "Cancel this placement?"
            : "End this placement now?"
        }
        confirmLabel={
          ending?.status === "SCHEDULED"
            ? "Cancel the placement"
            : "End the placement"
        }
        busyLabel="Saving…"
        busy={busy}
        error={endError}
        onConfirm={() => void confirmEnd()}
        onCancel={() => setEnding(null)}
      >
        <p>
          {ending?.listing.title} stops showing “{ending?.label}” at once.
          Nothing is refunded here.
        </p>
        <Field id="pl-end-reason" label="Reason" className="mt-4">
          <Textarea
            id="pl-end-reason"
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
      </ConfirmDialog>
    </>
  );
}

/** `/admin/placements` (API 0.53.0). */
export function Placements() {
  return (
    <RoleGate roles={PLACEMENT_ROLES} what="the paid placements">
      {() => <List />}
    </RoleGate>
  );
}

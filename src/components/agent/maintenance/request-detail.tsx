"use client";

import { BadgeCheck, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useCallback, useState, type FormEvent } from "react";
import { todayLocal } from "@/components/agent/books/shared";
import { ErrorSummary } from "@/components/agent/property/form-bits";
import { Linked, ManagementShell } from "@/components/agent/property/shared";
import { EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import type { DashboardOrganisation } from "@/lib/api/dashboard";
import { addComment, assignProvider, changeStatus, getRequest, recordCost, searchProviders, uploadRequestPhoto } from "@/lib/api/maintenance";
import { amountProblem, currencyMinorUnits, entryHref, formatLedgerAmount } from "@/lib/ledger";
import {
  ASSIGN_MESSAGE_MAX,
  assignBody,
  assignedEnquiry,
  assignProblems,
  categoryLabel,
  COST_DESCRIPTION_MAX,
  costBody,
  costFormProblems,
  emptyCostForm,
  hasProblems,
  isMaintenanceStatus,
  maintenanceActions,
  maintenancePath,
  moveNeedsNote,
  moveNoteProblem,
  moveWords,
  NOTE_MAX,
  normaliseCost,
  providerHref,
  QUERY_MAX,
  requestPlace,
  STATUS_EXPLAINED,
  type CostForm,
  type CostProblems,
  type MaintenanceOptions,
  type MaintenanceRequest,
  type ProviderRef,
} from "@/lib/maintenance";
import { propertyHref, tenancyHref } from "@/lib/tenancies";
import {
  AddPhotos,
  CommentComposer,
  MaintenanceStatusBadge,
  PhotoGallery,
  PriorityBadge,
  RequestTimeline,
  sectionHeading,
  useMaintenanceOptions,
} from "./shared";

/** `/agent/maintenance/<id>`: the request, its timeline, comments, status, assignment, costs and photos. */
export function RequestDetail({ id }: { id: string }) {
  return (
    <ManagementShell area="maintenance" path={`/${encodeURIComponent(id)}`} back={{ href: (org) => maintenancePath("", org), label: "Maintenance" }}>
      {(organisation) => <Detail id={id} organisation={organisation} />}
    </ManagementShell>
  );
}

function Detail({ id, organisation }: { id: string; organisation: DashboardOrganisation }) {
  const org = organisation.id;
  const load = useCallback(() => getRequest(org, id), [org, id]);
  const { state, reload, replace } = useApi(load);
  const options = useMaintenanceOptions(org);
  const request = state.status === "ready" ? state.data : state.status === "loading" ? state.previous : undefined;

  if (state.status === "error" && state.failure.status === 404) {
    return (
      <EmptyState
        title="We could not find that request"
        action={
          <ButtonLink href={maintenancePath("", org)} variant="secondary">
            See all requests
          </ButtonLink>
        }
      >
        It may belong to another organisation.
      </EmptyState>
    );
  }
  if (state.status === "error") return <LoadError failure={state.failure} onRetry={reload} />;
  if (!request) return <LoadingBlock label="Loading the request" rows={3} />;

  const actions = maintenanceActions(request, organisation.role);
  const tenants = request.tenancy ? request.tenancy.tenants.join(", ") : "";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <MaintenanceStatusBadge status={request.status} label={request.statusLabel} />
        <PriorityBadge priority={request.priority} label={request.priorityLabel} />
        {request.reference && <span className="text-sm text-muted">{request.reference}</span>}
      </div>
      <h1 className="mt-2 text-3xl break-words md:text-4xl">{request.title}</h1>
      <p className="mt-2 max-w-2xl break-words text-muted">
        {request.property?.id && !request.property.archived ? (
          <Linked href={propertyHref(request.property.id, org)}>{request.property.name}</Linked>
        ) : (
          (request.property?.name ?? "No property") + (request.property?.archived ? " (deleted)" : "")
        )}
        {request.unit ? ` · ${request.unit.label}${request.unit.archived ? " (removed)" : ""}` : " · the whole property"}
        {` · ${categoryLabel(request.category, request.categoryLabel)}`}
      </p>
      {request.tenancy && (
        <p className="mt-1 text-sm text-muted">
          Tenancy: <Linked href={tenancyHref(request.tenancy.id, org)}>{tenants || "Open the tenancy"}</Linked>
        </p>
      )}
      <p className="mt-1 text-sm text-muted">
        Reported{request.raisedBy?.name ? ` by ${request.raisedBy.name}` : ""}
        {request.raisedBy?.kind === "TENANT" ? " (the tenant)" : ""}
        {request.createdAt && (
          <>
            {" "}
            on <time dateTime={request.createdAt}>{formatWhen(request.createdAt)}</time>
          </>
        )}
      </p>
      {isMaintenanceStatus(request.status) && <p className="mt-1 text-sm text-muted">{STATUS_EXPLAINED[request.status]}</p>}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="grid min-w-0 content-start gap-6">
          <Card>
            <h2 className={sectionHeading}>Details</h2>
            {request.description ? (
              <p className="mt-2 text-sm whitespace-pre-line break-words text-ink">{request.description}</p>
            ) : (
              <p className="mt-2 text-sm text-muted">No details were given.</p>
            )}
          </Card>
          <Card>
            <PhotoGallery photos={request.photos}>
              {actions.addPhoto && (
                <AddPhotos
                  id="request-add-photos"
                  already={request.photos.length}
                  rules={options.photoRules}
                  upload={(file, progress) => uploadRequestPhoto(org, request.id, file, progress)}
                  onSent={reload}
                />
              )}
            </PhotoGallery>
          </Card>
          <Card>
            <RequestTimeline request={request} org={org} />
          </Card>
          {actions.comment && (
            <CommentComposer
              id="request-comment"
              allowInternal
              hint="The tenant sees comments on requests linked to their tenancy, unless it is for the team only."
              send={(text, internal) => addComment(org, request.id, text, internal)}
              onSent={reload}
            />
          )}
        </div>
        <div className="grid min-w-0 content-start gap-6">
          {actions.moves.length > 0 && <StatusCard key={request.status} org={org} request={request} moves={actions.moves} onChanged={replace} onStale={reload} />}
          <AssignCard org={org} request={request} canAssign={actions.assign} onChanged={replace} />
          <CostsCard org={org} request={request} options={options} canAdd={actions.addCost} onChanged={replace} />
          {actions.moves.length === 0 && !actions.assign && !actions.addCost && (
            <p className="text-sm text-muted">
              {organisation.role === "STAFF" ? "You can read this request but not change it." : "This request is finished: it can no longer be moved."}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

// ---- Status ---------------------------------------------------------------------------------------------

function StatusCard({
  org,
  request,
  moves,
  onChanged,
  onStale,
}: {
  org: string;
  request: MaintenanceRequest;
  moves: string[];
  onChanged: (request: MaintenanceRequest) => void;
  onStale: () => void;
}) {
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [problems, setProblems] = useState<{ to?: string; note?: string }>({});
  const [failure, setFailure] = useState<{ message: string; traceId?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const noteRequired = to ? moveNeedsNote(request.status, to) : false;
  const noteHint = noteRequired ? "Required: the tenant sees it on the timeline." : "Optional. The tenant sees it on the timeline.";

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = { to: to ? undefined : "Choose the new status.", note: to ? (moveNoteProblem(request.status, to, note) ?? undefined) : undefined };
    setProblems(found);
    setFailure(null);
    if (found.to || found.note) return;
    setBusy(true);
    const answer = await changeStatus(org, request.id, to, note);
    setBusy(false);
    if (!answer.ok) {
      if (answer.failure.fields?.note) setProblems({ note: answer.failure.fields.note });
      else setFailure({ message: answer.failure.message, traceId: answer.failure.traceId });
      if (answer.failure.code === "MAINTENANCE_INVALID_TRANSITION") onStale();
      return;
    }
    const next = await getRequest(org, request.id);
    if (next.ok) onChanged(next.data);
    else onStale();
  }

  const options: SelectOption[] = [{ value: "", label: "Choose a status" }, ...moves.map((status) => ({ value: status, label: moveWords(request.status, status) }))];
  return (
    <Card>
      <h2 className={sectionHeading}>Status</h2>
      <p className="mt-2 text-sm text-muted">
        Every change goes on the timeline, and the tenant and the managers are told. To assign a provider, use &ldquo;Assign to a service
        provider&rdquo;.
      </p>
      <form onSubmit={submit} noValidate className="mt-4 grid gap-4">
        <Field id="request-move" label="Move to" error={problems.to}>
          <SearchableSelect
            id="request-move"
            options={options}
            value={to}
            onValueChange={setTo}
            aria-invalid={Boolean(problems.to)}
            aria-describedby={fieldDescribedBy("request-move", { error: problems.to })}
          />
        </Field>
        <Field id="request-move-note" label={noteRequired ? "Why is it cancelled?" : "Note"} optional={!noteRequired} hint={noteHint} error={problems.note}>
          <Textarea
            id="request-move-note"
            rows={2}
            value={note}
            maxLength={NOTE_MAX}
            onChange={(event) => setNote(event.target.value)}
            aria-invalid={Boolean(problems.note)}
            aria-describedby={fieldDescribedBy("request-move-note", { hint: noteHint, error: problems.note })}
          />
        </Field>
        <Button type="submit" variant={to === "CANCELLED" ? "danger" : "primary"} disabled={busy} aria-busy={busy}>
          {busy ? "Saving…" : to ? moveWords(request.status, to) : "Change the status"}
        </Button>
        <div aria-live="polite">{failure && <Alert title={failure.message} traceId={failure.traceId} />}</div>
      </form>
    </Card>
  );
}

// ---- Assign to a service provider -------------------------------------------------------------------------

type Found = { status: "idle" | "loading" } | { status: "ready"; items: ProviderRef[] } | { status: "error"; message: string };

function AssignCard({
  org,
  request,
  canAssign,
  onChanged,
}: {
  org: string;
  request: MaintenanceRequest;
  canAssign: boolean;
  onChanged: (request: MaintenanceRequest) => void;
}) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found>({ status: "idle" });
  const [chosen, setChosen] = useState("");
  const [message, setMessage] = useState("");
  const [problems, setProblems] = useState<{ provider?: string; message?: string }>({});
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [sent, setSent] = useState<{ provider: string; reference: string | null; replayed: boolean } | null>(null);
  const assignment = request.assignment;
  const provider = found.status === "ready" ? found.items.find((item) => item.id === chosen) : undefined;

  async function search() {
    const text = q.trim().slice(0, QUERY_MAX);
    setFound({ status: "loading" });
    setChosen("");
    const answer = await searchProviders(org, text);
    setFound(answer.ok ? { status: "ready", items: answer.data } : { status: "error", message: answer.failure.message });
  }

  function ask(event: FormEvent) {
    event.preventDefault();
    const found = assignProblems(chosen, message);
    setProblems(found);
    if (hasProblems(found)) return;
    setError(undefined);
    setOpen(true);
  }

  async function assign() {
    if (!provider?.id) return;
    setBusy(true);
    setError(undefined);
    const answer = await assignProvider(org, request.id, assignBody(provider.id, message));
    setBusy(false);
    if (!answer.ok) {
      const fields = answer.failure.fields ?? {};
      if (fields.directory_profile_id || fields.message) {
        setProblems({ provider: fields.directory_profile_id, message: fields.message });
        setOpen(false);
      }
      setError(answer.failure.message);
      return;
    }
    setOpen(false);
    const enquiry = assignedEnquiry(answer.data);
    setSent({ provider: provider.name, reference: enquiry?.reference ?? null, replayed: enquiry?.replayed ?? false });
    setMessage("");
    setChosen("");
    setFound({ status: "idle" });
    const next = await getRequest(org, request.id);
    if (next.ok) onChanged(next.data);
  }

  const providerOptions: SelectOption[] = [
    { value: "", label: "Choose a service provider" },
    ...(found.status === "ready"
      ? found.items.map((item) => ({
          value: item.id ?? "",
          label: item.name,
          secondary: [item.trade, item.city, item.verified ? "Verified" : null].filter(Boolean).join(" · ") || undefined,
        }))
      : []),
  ];
  const messageHint = `Optional. Anything the provider needs to know: access, times, the gate code. ${message.length} of ${ASSIGN_MESSAGE_MAX} characters.`;

  return (
    <Card>
      <h2 className={sectionHeading}>Service provider</h2>
      {assignment ? (
        <div className="mt-3 rounded-md border border-line bg-sunken p-3 text-sm">
          <p className="font-medium break-words text-ink">
            {assignment.provider.name}
            {assignment.provider.verified && <BadgeCheck className="ml-1 inline size-4 text-success" aria-label="Verified" />}
          </p>
          {assignment.enquiry?.reference && (
            <p className="mt-1 text-muted">
              Linked business enquiry: <span className="font-medium text-ink">{assignment.enquiry.reference}</span>
            </p>
          )}
          <p className="mt-1 text-muted">
            {assignment.at && <>Assigned {formatWhen(assignment.at)}</>}
            {assignment.by && ` by ${assignment.by}`}
          </p>
          {providerHref(assignment.provider) && (
            <p className="mt-2">
              <Link href={providerHref(assignment.provider) as string} className="inline-flex min-h-11 items-center gap-1 font-medium text-primary-ink hover:underline">
                See their profile
                <ExternalLink className="size-4" aria-hidden="true" />
              </Link>
            </p>
          )}
        </div>
      ) : request.provider ? (
        <p className="mt-2 text-sm text-ink">{request.provider.name}</p>
      ) : (
        <p className="mt-2 text-sm text-muted">No provider assigned.</p>
      )}
      <div aria-live="polite">
        {sent && (
          <Alert tone="success" className="mt-3" title={`Assigned to ${sent.provider}.`}>
            {sent.replayed ? "The enquiry had already been sent; it was not sent twice." : "A business enquiry was sent to them"}
            {sent.reference ? ` (${sent.reference}).` : "."}
          </Alert>
        )}
      </div>

      {canAssign && (
        <>
          <h3 className="mt-5 text-base font-semibold text-ink">{assignment ? "Assign another provider" : "Assign to a service provider"}</h3>
          <p className="mt-1 text-sm text-muted">
            Search the directory&rsquo;s verified service providers. Assigning sends them a <strong>business enquiry from you</strong>, quoting{" "}
            {request.reference ?? "the request's reference"}, its category, priority and the property. The title, the details, the photos and
            the tenant&rsquo;s contact details are not shared: add what they need in the message. Their reply comes to your email.
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end lg:flex-col lg:items-stretch">
            <Field id="provider-search" label="Find a provider" className="flex-1">
              <Input
                id="provider-search"
                type="search"
                maxLength={QUERY_MAX}
                value={q}
                placeholder="Name or trade, for example plumber"
                onChange={(event) => setQ(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void search();
                  }
                }}
              />
            </Field>
            <Button variant="secondary" onClick={() => void search()} disabled={found.status === "loading"} aria-busy={found.status === "loading"}>
              {found.status === "loading" ? "Searching…" : "Search"}
            </Button>
          </div>
          <p aria-live="polite" className="mt-2 text-sm text-muted">
            {found.status === "ready" &&
              (found.items.length === 0
                ? "No verified service providers match. Try another word, or leave the search empty to see them all."
                : `${found.items.length === 1 ? "1 provider" : `${found.items.length} providers`} found. Choose one below.`)}
            {found.status === "error" && <span className="text-danger">{found.message}</span>}
          </p>
          {found.status === "ready" && found.items.length > 0 && (
            <form onSubmit={ask} noValidate className="mt-2 grid gap-4">
              <Field id="provider-choice" label="Service provider" error={problems.provider}>
                <SearchableSelect
                  id="provider-choice"
                  options={providerOptions}
                  value={chosen}
                  onValueChange={setChosen}
                  aria-invalid={Boolean(problems.provider)}
                  aria-describedby={fieldDescribedBy("provider-choice", { error: problems.provider })}
                />
              </Field>
              <Field id="provider-message" label="Message to the provider" optional hint={messageHint} error={problems.message}>
                <Textarea
                  id="provider-message"
                  rows={3}
                  value={message}
                  maxLength={ASSIGN_MESSAGE_MAX}
                  onChange={(event) => setMessage(event.target.value)}
                  aria-invalid={Boolean(problems.message)}
                  aria-describedby={fieldDescribedBy("provider-message", { hint: messageHint, error: problems.message })}
                />
              </Field>
              <Button type="submit">Assign and send the enquiry</Button>
              {error && !open && <Alert title={error} />}
            </form>
          )}
          <ConfirmDialog
            open={open}
            tone="primary"
            title={`Send ${provider?.name ?? "the provider"} a business enquiry?`}
            confirmLabel="Yes, assign and send"
            busyLabel="Sending…"
            cancelLabel="Not yet"
            busy={busy}
            error={error}
            onConfirm={assign}
            onCancel={() => setOpen(false)}
          >
            The enquiry comes from you and quotes {request.reference ?? "the request"}, {categoryLabel(request.category, request.categoryLabel)},{" "}
            {request.priorityLabel ?? request.priority} priority, at {requestPlace(request)}
            {message.trim() ? ", with your message" : ""}. The request becomes assigned.
          </ConfirmDialog>
        </>
      )}
    </Card>
  );
}

// ---- Costs ------------------------------------------------------------------------------------------------

const decimalsHint = (currency: string) => {
  const units = currencyMinorUnits(currency || "USD");
  return units === 0 ? `In ${currency}: a whole number.` : `In ${currency}: up to ${units} decimal place${units === 1 ? "" : "s"}.`;
};

const COST_IDS: Record<string, string> = {
  amount: "cost-amount",
  currency: "cost-currency",
  description: "cost-description",
  method: "cost-method",
  incurredOn: "cost-date",
};
const COST_LABELS: Record<string, string> = { amount: "Amount", currency: "Currency", description: "What it was for", method: "Paid by", incurredOn: "Date" };

function CostsCard({
  org,
  request,
  options,
  canAdd,
  onChanged,
}: {
  org: string;
  request: MaintenanceRequest;
  options: MaintenanceOptions;
  canAdd: boolean;
  onChanged: (request: MaintenanceRequest) => void;
}) {
  const today = todayLocal();
  const currencies = options.currencies.length ? options.currencies.map((item) => item.code) : ["USD"];
  const [form, setForm] = useState<CostForm>(() => emptyCostForm(request.costs[0]?.currency ?? currencies[0], today));
  const [problems, setProblems] = useState<CostProblems & { other?: string[] }>({});
  const [failure, setFailure] = useState<{ message: string; traceId?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [recorded, setRecorded] = useState<{ amount: string; currency: string; ledgerEntryId: string | null } | null>(null);
  const set = (patch: Partial<CostForm>) => setForm((current) => ({ ...current, ...patch }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = costFormProblems(form, (value, currency) => amountProblem(value, currency), today);
    setProblems(found);
    setFailure(null);
    setRecorded(null);
    if (hasProblems(found)) return;
    setBusy(true);
    const answer = await recordCost(org, request.id, costBody(form));
    setBusy(false);
    if (!answer.ok) {
      const fields = answer.failure.fields ?? {};
      const mapped: CostProblems & { other?: string[] } = {
        amount: fields.amount,
        currency: fields.currency,
        description: fields.description,
        method: fields.method,
        incurredOn: fields.incurred_on,
      };
      const other = Object.entries(fields)
        .filter(([key]) => !["amount", "currency", "description", "method", "incurred_on"].includes(key))
        .map(([key, text]) => (key.startsWith("ledger.") ? `The books: ${text}` : text));
      if (other.length) mapped.other = other;
      setProblems(mapped);
      if (!Object.keys(fields).length) setFailure({ message: answer.failure.message, traceId: answer.failure.traceId });
      return;
    }
    const cost = normaliseCost(answer.data);
    setRecorded(cost ? { amount: cost.amount, currency: cost.currency, ledgerEntryId: cost.ledgerEntryId } : { amount: form.amount, currency: form.currency, ledgerEntryId: null });
    setForm(emptyCostForm(form.currency, today));
    const next = await getRequest(org, request.id);
    if (next.ok) onChanged(next.data);
  }

  const summary = Object.entries(problems)
    .filter(([key, text]) => key !== "other" && typeof text === "string")
    .map(([key, text]) => ({ id: COST_IDS[key] ?? "cost-amount", text: `${COST_LABELS[key] ?? key}: ${text as string}` }));
  for (const text of problems.other ?? []) summary.push({ id: "cost-amount", text });
  const currencyOptions: SelectOption[] = currencies.map((code) => ({ value: code, label: code }));
  const methodOptions: SelectOption[] = options.methods.map((item) => ({ value: item.code, label: item.label }));
  const amountHint = decimalsHint(form.currency);

  return (
    <Card>
      <h2 className={sectionHeading}>Costs</h2>
      {request.costTotals.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm" aria-label="Total per currency">
          {request.costTotals.map((total) => (
            <li key={total.currency} className="flex justify-between gap-2">
              <span className="text-muted">
                Total in {total.currency} ({total.count === 1 ? "1 cost" : `${total.count} costs`})
              </span>
              <span className="font-semibold tabular-nums text-ink">{formatLedgerAmount(total.amount, total.currency)}</span>
            </li>
          ))}
        </ul>
      )}
      {request.costs.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No costs recorded.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line rounded-md border border-line">
          {request.costs.map((cost) => (
            <li key={cost.id} className="p-3 text-sm">
              <p className="flex flex-wrap justify-between gap-2">
                <span className={`font-semibold tabular-nums ${cost.reversed ? "text-muted line-through" : "text-ink"}`}>{formatLedgerAmount(cost.amount, cost.currency)}</span>
                {cost.reversed && <span className="text-muted">Reversed</span>}
              </p>
              <p className="mt-1 break-words text-ink">{cost.description}</p>
              <p className="mt-1 text-muted">
                {[cost.incurredOn, cost.methodLabel ?? cost.method, cost.by].filter(Boolean).join(" · ")}
              </p>
              {cost.ledgerEntryId && (
                <p className="mt-1">
                  <Link href={entryHref(cost.ledgerEntryId, org)} className="inline-flex min-h-11 items-center font-medium text-primary-ink hover:underline">
                    Book entry{cost.ledgerStatusLabel ? `: ${cost.ledgerStatusLabel}` : ""}
                  </Link>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted">Totals are per currency: amounts in different currencies are never added together. To undo a cost, reverse its book entry.</p>
      <div aria-live="polite">
        {recorded && (
          <Alert tone="success" className="mt-3" title={`Cost of ${formatLedgerAmount(recorded.amount, recorded.currency)} recorded.`}>
            {recorded.ledgerEntryId ? (
              <Link href={entryHref(recorded.ledgerEntryId, org)} className="font-medium text-primary-ink underline">
                Open the book entry
              </Link>
            ) : (
              "It is in your books as a maintenance expense."
            )}
          </Alert>
        )}
      </div>

      {canAdd && (
        <form onSubmit={submit} noValidate className="mt-5 grid gap-4">
          <h3 className="text-base font-semibold text-ink">Record a cost</h3>
          <p className="-mt-2 text-sm text-muted">It is written to your books as a maintenance expense for {request.property?.name ?? "the property"}, recorded by you and not verified.</p>
          <ErrorSummary items={summary} />
          <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
            <Field id="cost-amount" label="Amount" hint={amountHint} error={problems.amount}>
              <Input
                id="cost-amount"
                inputMode="decimal"
                autoComplete="off"
                value={form.amount}
                onChange={(event) => set({ amount: event.target.value })}
                aria-invalid={Boolean(problems.amount)}
                aria-describedby={fieldDescribedBy("cost-amount", { hint: amountHint, error: problems.amount })}
              />
            </Field>
            <Field id="cost-currency" label="Currency" error={problems.currency}>
              <SearchableSelect
                id="cost-currency"
                options={currencyOptions}
                value={form.currency}
                onValueChange={(value) => set({ currency: value })}
                aria-invalid={Boolean(problems.currency)}
                aria-describedby={fieldDescribedBy("cost-currency", { error: problems.currency })}
              />
            </Field>
          </div>
          <Field id="cost-description" label="What it was for" error={problems.description}>
            <Input
              id="cost-description"
              value={form.description}
              maxLength={COST_DESCRIPTION_MAX}
              onChange={(event) => set({ description: event.target.value })}
              aria-invalid={Boolean(problems.description)}
              aria-describedby={fieldDescribedBy("cost-description", { error: problems.description })}
            />
          </Field>
          <Field id="cost-method" label="Paid by" error={problems.method}>
            <SearchableSelect
              id="cost-method"
              options={methodOptions}
              value={form.method}
              onValueChange={(value) => set({ method: value })}
              aria-invalid={Boolean(problems.method)}
              aria-describedby={fieldDescribedBy("cost-method", { error: problems.method })}
            />
          </Field>
          <Field id="cost-date" label="Date" error={problems.incurredOn}>
            <Input
              id="cost-date"
              type="date"
              max={today}
              value={form.incurredOn}
              onChange={(event) => set({ incurredOn: event.target.value })}
              aria-invalid={Boolean(problems.incurredOn)}
              aria-describedby={fieldDescribedBy("cost-date", { error: problems.incurredOn })}
            />
          </Field>
          <Button type="submit" variant="secondary" disabled={busy} aria-busy={busy}>
            {busy ? "Recording…" : "Record the cost"}
          </Button>
          {failure && <Alert title={failure.message} traceId={failure.traceId} />}
        </form>
      )}
    </Card>
  );
}


"use client";

import { Eye, Plus, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { failureNotice, NoticeArea, PdfActions, type Notice } from "@/components/agreements/shared";
import { RequireAuth } from "@/components/auth/require-auth";
import { BackLink, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { openPdf, pdfName } from "@/components/signing/pdf-file";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { ReminderFrequency } from "@/lib/api/agreements";
import { canUseInbox } from "@/lib/api/auth";
import { listMyListings, type MyListing } from "@/lib/api/availability";
import { getDashboard, type DashboardOrganisation } from "@/lib/api/dashboard";
import type { ApiFailure, ApiResult } from "@/lib/api/http";
import {
  cancelLease,
  createLease,
  deleteLease,
  getLease,
  getLeasePdf,
  listLeaseEvents,
  listOfferedLeaseTemplates,
  patchLease,
  sendLease,
  type Lease,
  type LeaseInput,
  type LeaseTemplate,
  type RentPeriod,
} from "@/lib/api/leases";
import { EMAIL_MAX, emailProblem } from "@/lib/auth-validation";
import {
  amountProblem,
  dayAfter,
  endOfDay,
  eventLabel,
  expiryProblem,
  isSampleReview,
  LEASE_STATUS,
  leaseDatesProblems,
  noticeProblem,
  paymentDayProblem,
  REMINDER_OPTIONS,
  RENT_PERIODS,
  signingMessage,
  statusOf,
  WEEKDAYS,
} from "@/lib/signing";

type Option = { value: string; label: string };

type Party = { key: string; name: string; email: string; phone: string };

type Values = {
  templateId: string;
  listingId: string;
  organisationId: string;
  address: string;
  landlords: Party[];
  tenants: Party[];
  start: string;
  end: string;
  periodic: boolean;
  rentAmount: string;
  rentCurrency: string;
  rentPeriod: RentPeriod;
  paymentDay: string;
  deposit: string;
  notice: string;
  clauses: string[];
  special: string;
  /** A stamp box next to each landlord's signature (API 0.26.0). */
  landlordStamp: boolean;
};

type Problems = Record<string, string | undefined>;

let partyCounter = 0;
const partyKey = () => `p${Date.now().toString(36)}${(partyCounter++).toString(36)}`;
const emptyParty = (): Party => ({ key: partyKey(), name: "", email: "", phone: "" });

const DRAFT_KEY = "rp365.lease-draft";

const blank = (currency: string): Values => ({
  templateId: "",
  listingId: "",
  organisationId: "",
  address: "",
  landlords: [emptyParty()],
  tenants: [emptyParty()],
  start: "",
  end: "",
  periodic: false,
  rentAmount: "",
  rentCurrency: currency,
  rentPeriod: "MONTHLY",
  paymentDay: "1",
  deposit: "",
  notice: "30",
  clauses: [],
  special: "",
  landlordStamp: false,
});

const fromLease = (lease: Lease): Values => ({
  templateId: lease.template.id,
  listingId: lease.listing?.id ?? "",
  organisationId: lease.organisation?.id ?? "",
  address: lease.property_address,
  landlords: lease.landlords.map((party) => ({ key: partyKey(), name: party.name, email: party.email, phone: party.phone ?? "" })),
  tenants: lease.tenants.map((party) => ({ key: partyKey(), name: party.name, email: party.email, phone: party.phone ?? "" })),
  start: lease.start_date,
  end: lease.end_date ?? "",
  periodic: lease.periodic,
  rentAmount: lease.rent_amount,
  rentCurrency: lease.rent_currency,
  rentPeriod: lease.rent_period,
  paymentDay: String(lease.payment_day),
  deposit: lease.deposit_amount ?? "",
  notice: String(lease.notice_period_days),
  clauses: lease.optional_clauses,
  special: lease.special_conditions ?? "",
  landlordStamp: lease.landlord_stamp ?? false,
});

function toInput(values: Values, create: boolean): LeaseInput {
  const party = (item: Party) => ({ name: item.name.trim(), email: item.email.trim(), ...(item.phone.trim() ? { phone: item.phone.trim() } : {}) });
  return {
    template_id: values.templateId,
    ...(create && values.listingId ? { listing_id: values.listingId } : {}),
    ...(create && !values.listingId && values.organisationId ? { organisation_id: values.organisationId } : {}),
    ...(values.address.trim() ? { property_address: values.address.trim() } : {}),
    landlords: values.landlords.map(party),
    tenants: values.tenants.map(party),
    start_date: values.start,
    ...(values.periodic ? { periodic: true } : { periodic: false, end_date: values.end }),
    rent_amount: values.rentAmount.trim(),
    rent_currency: values.rentCurrency,
    rent_period: values.rentPeriod,
    payment_day: Number(values.paymentDay),
    ...(values.deposit.trim() ? { deposit_amount: values.deposit.trim() } : {}),
    notice_period_days: Number(values.notice),
    optional_clauses: values.clauses,
    special_conditions: values.special.trim(),
    landlord_stamp: Boolean(values.landlordStamp),
  };
}

function problemsOf(values: Values, context: { needsOrganisation: boolean; templates: LeaseTemplate[]; market: string | null }): Problems {
  const problems: Problems = {};
  const template = context.templates.find((item) => item.id === values.templateId);
  if (!values.templateId) problems.template = "Choose the lease template.";
  else if (template && context.market && template.market_code.toUpperCase() !== context.market.toUpperCase()) {
    problems.template = "This template is for another country than the property. Choose one for the property's country.";
  }
  if (!values.listingId) {
    if (!values.address.trim()) problems.address = "Choose one of your listings, or type the property's address.";
    if (context.needsOrganisation && !values.organisationId) problems.organisation = "Choose who the lease is for.";
  }
  if (Array.from(values.address).length > 300) problems.address = "Use 300 characters or fewer.";
  const seen = new Set<string>();
  for (const [side, parties, word] of [["landlords", values.landlords, "landlord"], ["tenants", values.tenants, "tenant"]] as const) {
    if (parties.length === 0) problems[side] = `Add at least one ${word}.`;
    for (const party of parties) {
      if (!party.name.trim()) problems[`${party.key}.name`] = `Enter the ${word}'s full name.`;
      else if (Array.from(party.name.trim()).length > 120) problems[`${party.key}.name`] = "Use 120 characters or fewer.";
      const email = party.email.trim().toLowerCase();
      problems[`${party.key}.email`] = email ? emailProblem(email) : `Enter the ${word}'s email address. They sign by email.`;
      if (email && !problems[`${party.key}.email`]) {
        if (seen.has(email)) problems[`${party.key}.email`] = "Each landlord and tenant needs a different email address.";
        seen.add(email);
      }
      if (party.phone.trim() && !/^[+\d][\d\s()-]{5,24}$/.test(party.phone.trim())) problems[`${party.key}.phone`] = "Enter a phone number like +263 77 123 4567.";
    }
  }
  Object.assign(problems, leaseDatesProblems(values.start, values.end, values.periodic));
  problems.rent_amount = amountProblem(values.rentAmount, "rent");
  if (!/^[A-Z]{3}$/.test(values.rentCurrency)) problems.rent_currency = "Choose the currency.";
  problems.payment_day = paymentDayProblem(values.paymentDay ? Number(values.paymentDay) : null, values.rentPeriod);
  problems.deposit_amount = amountProblem(values.deposit, "deposit", true);
  problems.notice_period_days = noticeProblem(values.notice ? Number(values.notice) : null);
  if (Array.from(values.special).length > 4000) problems.special_conditions = "Use 4000 characters or fewer.";
  return problems;
}

const hasProblems = (problems: Problems) => Object.values(problems).some(Boolean);

/** API field names (`tenants[0].email`, `rent_amount`) on the fields of this form. */
function mapApiFields(fields: Record<string, string> | undefined, values: Values): Problems {
  const problems: Problems = {};
  for (const [key, message] of Object.entries(fields ?? {})) {
    const party = /^(landlords|tenants)\[(\d+)\]\.(name|email|phone)$/.exec(key);
    if (party) {
      const item = values[party[1] as "landlords" | "tenants"][Number(party[2])];
      problems[item ? `${item.key}.${party[3]}` : party[1]] = message;
      continue;
    }
    const names: Record<string, string> = { template_id: "template", property_address: "address", organisation_id: "organisation", listing_id: "listing" };
    problems[names[key] ?? key.replace(/\[\d+\]$/, "")] = message;
  }
  return problems;
}

const FIELD_IDS: Record<string, string> = {
  template: "lease-template",
  listing: "lease-listing",
  organisation: "lease-organisation",
  address: "lease-address",
  start_date: "lease-start",
  end_date: "lease-end",
  rent_amount: "lease-rent",
  rent_currency: "lease-currency",
  payment_day: "lease-payment-day",
  deposit_amount: "lease-deposit",
  notice_period_days: "lease-notice",
  special_conditions: "lease-special",
};

const controlIdOf = (key: string) => FIELD_IDS[key] ?? (key.includes(".") ? `party-${key.replace(".", "-")}` : null);

type Context = {
  templates: LeaseTemplate[];
  listings: MyListing[];
  organisations: DashboardOrganisation[];
};

async function loadContext(): Promise<ApiResult<Context>> {
  const [templates, listings, dashboard] = await Promise.all([listOfferedLeaseTemplates(), listMyListings(1), getDashboard()]);
  if (!templates.ok) return templates;
  return {
    ok: true,
    status: 200,
    data: {
      templates: templates.data.items,
      listings: listings.ok ? listings.data.items : [],
      organisations: dashboard.ok ? dashboard.data.organisations.filter((item) => item.can_create_leases ?? item.can_manage_listings) : [],
    },
  };
}

function TemplateNote({ template, organisations }: { template: LeaseTemplate; organisations: DashboardOrganisation[] }) {
  const review = template.legal_review;
  if (template.source === "ORGANISATION" || template.organisation_id) {
    const owner = organisations.find((item) => item.id === template.organisation_id);
    return (
      <p className="mt-2 text-sm text-muted">
        {owner ? `${owner.name}'s own template` : "Your organisation's own template"}
        {template.approved_at && `, published ${formatWhen(template.approved_at)}`}
        {template.approved_by_name && ` by ${template.approved_by_name}`}.
      </p>
    );
  }
  if (isSampleReview(review)) {
    return (
      <Alert tone="warning" title="The wording of this template is a sample" className="mt-3">
        <p>
          It is a starting point and has not been checked by a lawyer{review ? ` (${review.reviewer_name}, ${review.organisation})` : ""}. Check
          that it suits this lease before anyone signs it, or{" "}
          <Link href="/agent/lease-templates" className="font-medium text-primary-ink underline">
            copy it as a template of your own
          </Link>{" "}
          and change its wording.
        </p>
      </Alert>
    );
  }
  return (
    <p className="mt-2 text-sm text-muted">
      Wording reviewed by {review!.reviewer_name}, {review!.organisation}, on {review!.reviewed_on}.
      {review!.note && ` ${review!.note}`}
    </p>
  );
}

function PartyRows({
  side,
  word,
  parties,
  problems,
  onChange,
  disabled,
}: {
  side: "landlords" | "tenants";
  word: string;
  parties: Party[];
  problems: Problems;
  onChange: (parties: Party[], delay?: number) => void;
  disabled: boolean;
}) {
  const set = (key: string, change: Partial<Party>) => onChange(parties.map((party) => (party.key === key ? { ...party, ...change } : party)));
  return (
    <fieldset>
      <legend className="text-xl font-semibold">{side === "landlords" ? "Landlords" : "Tenants"}</legend>
      <p className="mt-1 text-sm text-muted">Each one signs by email. 1 to 5, each with a different email address.</p>
      {problems[side] && <p className="mt-2 text-sm text-danger">{problems[side]}</p>}
      <ol className="mt-3 space-y-3">
        {parties.map((party, index) => {
          const ids = { name: `party-${party.key}-name`, email: `party-${party.key}-email`, phone: `party-${party.key}-phone` };
          const errors = { name: problems[`${party.key}.name`], email: problems[`${party.key}.email`], phone: problems[`${party.key}.phone`] };
          return (
            <li key={party.key} className="grid gap-3 rounded-lg border border-line p-4 sm:grid-cols-[1fr_1fr_12rem_auto]">
              <Field id={ids.name} label={`${word} ${index + 1}: full name`} error={errors.name}>
                <Input
                  id={ids.name}
                  value={party.name}
                  maxLength={140}
                  disabled={disabled}
                  onChange={(event) => set(party.key, { name: event.currentTarget.value })}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={fieldDescribedBy(ids.name, { error: errors.name })}
                />
              </Field>
              <Field id={ids.email} label="Email address" error={errors.email}>
                <Input
                  id={ids.email}
                  type="email"
                  value={party.email}
                  maxLength={EMAIL_MAX}
                  disabled={disabled}
                  onChange={(event) => set(party.key, { email: event.currentTarget.value })}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={fieldDescribedBy(ids.email, { error: errors.email })}
                />
              </Field>
              <Field id={ids.phone} label="Phone" optional error={errors.phone}>
                <Input
                  id={ids.phone}
                  type="tel"
                  value={party.phone}
                  maxLength={30}
                  disabled={disabled}
                  onChange={(event) => set(party.key, { phone: event.currentTarget.value })}
                  aria-invalid={Boolean(errors.phone)}
                  aria-describedby={fieldDescribedBy(ids.phone, { error: errors.phone })}
                />
              </Field>
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  className="text-danger"
                  disabled={disabled || parties.length === 1}
                  onClick={() => onChange(parties.filter((item) => item.key !== party.key), 0)}
                  aria-label={`Remove ${word.toLowerCase()} ${index + 1}`}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
      <Button
        variant="secondary"
        className="mt-3"
        disabled={disabled || parties.length >= 5}
        onClick={() => {
          const party = emptyParty();
          onChange([...parties, party], 0);
          requestAnimationFrame(() => document.getElementById(`party-${party.key}-name`)?.focus());
        }}
      >
        <Plus className="size-4" aria-hidden="true" />
        Add a {word.toLowerCase()}
      </Button>
    </fieldset>
  );
}

function SendPanel({ lease, settle, onSent }: { lease: Lease; settle: () => Promise<boolean>; onSent: (lease: Lease) => void }) {
  const [message, setMessage] = useState("");
  const [expiry, setExpiry] = useState(() => dayAfter(Date.now(), 30));
  const [bounds] = useState(() => ({ min: dayAfter(Date.now(), 1), max: dayAfter(Date.now(), 365) }));
  const [reminder, setReminder] = useState<ReminderFrequency>("EVERY_3_DAYS");
  const [problem, setProblem] = useState<string | undefined>();
  const [failure, setFailure] = useState<Notice | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const parties = [...lease.landlords, ...lease.tenants];

  async function send() {
    setBusy(true);
    setFailure(null);
    if (!(await settle())) {
      setBusy(false);
      setConfirm(false);
      setFailure({ tone: "danger", text: "Some changes are not saved yet. Fix the fields marked in red first." });
      return;
    }
    const result = await sendLease(lease.id, {
      ...(message.trim() ? { message: message.trim() } : {}),
      expires_at: endOfDay(expiry),
      reminder_frequency: reminder,
    });
    setBusy(false);
    setConfirm(false);
    if (result.ok) {
      onSent(result.data.lease);
      return;
    }
    setFailure(failureNotice(result.failure));
  }

  return (
    <Card>
      <h2 className="font-sans text-xl font-semibold tracking-normal">Send for signing</h2>
      <p className="mt-1 text-muted">
        The lease is frozen and every landlord and tenant is emailed a link to sign, in any order. Their initials go on
        every page and their signature, name and date in the signature section: nothing to place by hand.
        {lease.landlord_stamp && " Each landlord also adds their stamp next to their signature."}
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field id="lease-send-message" label="Message" optional className="md:col-span-2">
          <Textarea id="lease-send-message" rows={3} maxLength={2000} value={message} onChange={(event) => setMessage(event.currentTarget.value)} />
        </Field>
        <Field id="lease-send-expiry" label="Can be signed until" error={problem}>
          <Input
            id="lease-send-expiry"
            type="date"
            value={expiry}
            min={bounds.min}
            max={bounds.max}
            onChange={(event) => {
              setExpiry(event.currentTarget.value);
              setProblem(undefined);
            }}
            aria-invalid={Boolean(problem)}
            aria-describedby={fieldDescribedBy("lease-send-expiry", { error: problem })}
          />
        </Field>
        <Field id="lease-send-reminders" label="Reminders">
          <SearchableSelect
            id="lease-send-reminders"
            options={REMINDER_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
            value={reminder}
            onValueChange={(value) => setReminder(value as ReminderFrequency)}
          />
        </Field>
      </div>
      <NoticeArea notice={failure} />
      <Button
        size="lg"
        className="mt-4"
        onClick={() => {
          const wrong = expiryProblem(expiry, Date.now());
          setProblem(wrong);
          if (!wrong) setConfirm(true);
        }}
      >
        <Send className="size-4" aria-hidden="true" />
        Send for signing
      </Button>
      <ConfirmDialog
        open={confirm}
        tone="primary"
        title="Send the lease for signing?"
        confirmLabel="Send it"
        busyLabel="Sending…"
        busy={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={() => void send()}
      >
        <p>
          We email {parties.map((party) => party.name).join(", ")}. The lease can no longer be changed once it is sent; to
          change it then, cancel it and draft a new one.
        </p>
      </ConfirmDialog>
    </Card>
  );
}

function Events({ leaseId, version }: { leaseId: string; version: string }) {
  const load = useCallback(() => listLeaseEvents(leaseId), [leaseId]);
  const { state, reload } = useApi(load);
  const seen = useRef(version);
  useEffect(() => {
    if (seen.current !== version) {
      seen.current = version;
      reload();
    }
  }, [version, reload]);
  if (state.status !== "ready") return null;
  return (
    <section aria-labelledby="lease-history">
      <h2 id="lease-history" className="text-2xl">
        History
      </h2>
      <ol className="mt-4 space-y-3 border-l-2 border-line pl-6">
        {state.data.items.map((event) => (
          <li key={event.id}>
            <p className="font-medium text-ink">
              {eventLabel(event.action)}
              <span className="font-normal text-muted"> · {event.actor.name}</span>
            </p>
            <p className="text-sm text-muted">{formatWhen(event.at)}</p>
            {typeof event.detail?.sha256 === "string" && <p className="break-all font-mono text-xs text-subtle">SHA-256 {event.detail.sha256}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}

type SaveState = { status: "idle" | "saving" | "saved" | "waiting" } | { status: "error"; text: string };

function Editor({ leaseId, currencies, context }: { leaseId: string | null; currencies: Option[]; context: Context }) {
  const router = useRouter();
  const [lease, setLease] = useState<Lease | null>(null);
  const [loadFailure, setLoadFailure] = useState<ApiFailure | null>(null);
  const [values, setValuesState] = useState<Values | null>(leaseId ? null : blank(currencies[0]?.value ?? "USD"));
  const [problems, setProblems] = useState<Problems>({});
  const [touched, setTouched] = useState(false);
  const [save, setSave] = useState<SaveState>({ status: "idle" });
  const [notice, setNotice] = useState<Notice | null>(null);
  const [restored, setRestored] = useState(false);
  const [confirm, setConfirm] = useState<"delete" | "cancel" | null>(null);
  const [reason, setReason] = useState("");
  const [acting, setActing] = useState(false);
  const noticeRef = useRef<HTMLDivElement>(null);
  const session = useRef({ values: values, lease: null as Lease | null, dirty: false, inFlight: false, again: false, timer: undefined as ReturnType<typeof setTimeout> | undefined });

  const { templates, listings, organisations } = context;
  const editable = !lease || (lease.status === "DRAFT" && lease.can_edit);

  // An existing lease is read in the browser; a new one may continue a draft kept on this device.
  useEffect(() => {
    let cancelled = false;
    if (leaseId) {
      getLease(leaseId).then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setLoadFailure(result.failure);
          return;
        }
        session.current.lease = result.data.lease;
        setLease(result.data.lease);
        const next = fromLease(result.data.lease);
        session.current.values = next;
        setValuesState(next);
      });
    } else {
      try {
        const raw = window.localStorage.getItem(DRAFT_KEY);
        const saved = raw ? (JSON.parse(raw) as Values) : null;
        if (saved && Array.isArray(saved.landlords) && Array.isArray(saved.tenants)) {
          session.current.values = saved;
          // Read once, after the first render, so the server and browser agree on the first paint.
          window.setTimeout(() => {
            if (cancelled) return;
            setValuesState(saved);
            setRestored(true);
          }, 0);
        }
      } catch {
        // Nothing kept, or storage blocked.
      }
    }
    return () => {
      cancelled = true;
    };
  }, [leaseId]);

  const listing = listings.find((item) => item.id === values?.listingId) ?? null;
  const organisation = organisations.find((item) => item.id === values?.organisationId) ?? null;
  const market = lease?.template.market_code ?? listing?.country.code ?? organisation?.market_code ?? (organisations.length === 1 ? organisations[0].market_code : null);
  // An organisation's templates are offered for its own leases only; samples for every lease.
  const leaseOrganisation = lease?.organisation?.id ?? (values?.organisationId || (organisations.length === 1 ? organisations[0].id : null));
  const offered = useMemo(
    () =>
      (market ? templates.filter((template) => template.market_code.toUpperCase() === market.toUpperCase()) : templates).filter(
        (template) => !template.organisation_id || !leaseOrganisation || template.organisation_id === leaseOrganisation,
      ),
    [templates, market, leaseOrganisation],
  );
  const isSample = (template: LeaseTemplate) => template.source === "SAMPLE" || !template.organisation_id;
  const ownOffered = offered.filter((template) => !isSample(template));
  const sampleOffered = offered.filter(isSample);
  const templateOption = (item: LeaseTemplate) => ({ value: item.id, label: `${item.name} (version ${item.version})`, secondary: item.market_code });
  const needsOrganisation = !lease && organisations.length > 1;
  const contextFor = useMemo(() => ({ needsOrganisation, templates, market }), [needsOrganisation, templates, market]);
  const current = values ? problemsOf(values, contextFor) : {};
  const shown = touched ? { ...current, ...problems } : problems;
  const template = templates.find((item) => item.id === values?.templateId) ?? null;

  // The latest `flush`, for the save that follows one still on its way.
  const flushRef = useRef<() => Promise<unknown>>(async () => null);

  const flush = useCallback(async (): Promise<boolean> => {
    const s = session.current;
    clearTimeout(s.timer);
    if (!s.values || !s.dirty) return true;
    if (s.inFlight) {
      s.again = true;
      return false;
    }
    const wanted = s.values;
    if (hasProblems(problemsOf(wanted, contextFor))) {
      setSave({ status: "waiting" });
      return false;
    }
    s.inFlight = true;
    s.dirty = false;
    setSave({ status: "saving" });
    const create = !s.lease;
    const result = create ? await createLease(toInput(wanted, true)) : await patchLease(s.lease!.id, toInput(wanted, false));
    s.inFlight = false;
    if (!result.ok) {
      s.dirty = true;
      const apiProblems = mapApiFields(result.failure.fields, wanted);
      if (Object.keys(apiProblems).length > 0) {
        setProblems(apiProblems);
        setTouched(true);
        setSave({ status: "error", text: "Not saved: fix the fields marked in red." });
      } else if (result.failure.code === "LEASE_NOT_EDITABLE" || result.failure.code === "LEASE_STATE_CONFLICT") {
        setSave({ status: "idle" });
        setNotice(failureNotice(result.failure, "warning"));
        const fresh = s.lease ? await getLease(s.lease.id) : null;
        if (fresh?.ok) {
          s.lease = fresh.data.lease;
          setLease(fresh.data.lease);
        }
      } else {
        setSave({ status: "error", text: signingMessage(result.failure) });
      }
      return false;
    }
    s.lease = result.data.lease;
    setLease(result.data.lease);
    setSave({ status: "saved" });
    if (create) {
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        // Storage blocked.
      }
      window.history.replaceState(null, "", `/agent/leases/${result.data.lease.id}`);
    }
    if (s.again) {
      // Edits made while this was saving: save them next.
      s.again = false;
      s.timer = setTimeout(() => void flushRef.current(), 0);
    }
    return true;
  }, [contextFor]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  function change(next: Values, delay = 1200) {
    const s = session.current;
    s.values = next;
    s.dirty = true;
    setValuesState(next);
    setProblems({});
    if (!s.lease) {
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      } catch {
        // Storage full or blocked.
      }
    }
    clearTimeout(s.timer);
    s.timer = setTimeout(() => void flush(), delay);
  }

  useEffect(() => {
    const s = session.current;
    const warn = (event: BeforeUnloadEvent) => {
      if (s.lease && (s.dirty || s.inFlight)) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      clearTimeout(s.timer);
    };
  }, []);

  /** Waits for the save in progress, then saves what is left. True when everything is saved. */
  async function settle(): Promise<boolean> {
    const s = session.current;
    const wait = () => new Promise((resolve) => setTimeout(resolve, 100));
    setTouched(true);
    for (let attempt = 0; attempt < 3; attempt++) {
      while (s.inFlight) await wait();
      if (!s.dirty) break;
      if (!(await flush())) break;
    }
    while (s.inFlight) await wait();
    if (s.dirty) {
      const first = Object.entries(problemsOf(s.values!, contextFor)).find(([, value]) => value)?.[0];
      const id = first ? controlIdOf(first) : null;
      if (id) requestAnimationFrame(() => document.getElementById(id)?.focus());
      return false;
    }
    return Boolean(s.lease);
  }

  async function act(kind: "delete" | "cancel") {
    if (!lease) return;
    setActing(true);
    const result = kind === "delete" ? await deleteLease(lease.id) : await cancelLease(lease.id, reason.trim() || undefined);
    setActing(false);
    setConfirm(null);
    if (!result.ok) {
      setNotice(failureNotice(result.failure));
      noticeRef.current?.focus();
      return;
    }
    if (kind === "delete") {
      router.push("/agent/leases");
      return;
    }
    const cancelled = (result.data as { lease: Lease }).lease;
    session.current.lease = cancelled;
    setLease(cancelled);
    setNotice({ tone: "success", text: "The lease was cancelled." });
  }

  if (loadFailure) return <LoadError failure={loadFailure} onRetry={() => window.location.reload()} />;
  if (!values) return <LoadingBlock label="Loading the lease" rows={4} />;

  const status = lease ? statusOf(LEASE_STATUS, lease.status) : null;
  const paymentOptions =
    values.rentPeriod === "WEEKLY"
      ? WEEKDAYS.map((day, index) => ({ value: String(index + 1), label: day }))
      : Array.from({ length: 31 }, (_, index) => ({ value: String(index + 1), label: `Day ${index + 1}` }));
  const err = (key: string) => shown[key];
  const describe = (id: string, key: string, hint?: boolean) => fieldDescribedBy(id, { error: err(key), hint: hint ? "x" : undefined });

  return (
    <>
      <BackLink href="/agent/leases">Leases</BackLink>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">{lease ? `Lease ${lease.reference}` : "New lease"}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted" role="status" aria-live="polite">
            {status && <Badge tone={status.tone}>{status.label}</Badge>}
            {editable && save.status === "saving" && "Saving…"}
            {editable && save.status === "saved" && "Draft saved. The draft PDF was made again."}
            {editable && save.status === "waiting" && (lease ? "Changes are saved once every required field is filled in." : "The draft is saved once every required field is filled in.")}
            {editable && save.status === "error" && <span className="text-danger">{save.text}</span>}
            {editable && save.status === "idle" && (lease ? `Last saved ${formatWhen(lease.updated_at)}` : "Kept on this device until every required field is filled in.")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {lease?.document && (
            <PreviewButton
              read={async () => {
                if (editable) await settle();
                return getLeasePdf(lease.id);
              }}
              fileName={pdfName("Lease", lease.reference, lease.status === "DRAFT" ? "draft" : undefined)}
              label={lease.status === "DRAFT" ? "Preview PDF" : lease.status === "SIGNED" ? "Open the signed PDF" : "Open the PDF"}
            />
          )}
          {lease?.document && (
            <PdfActions read={() => getLeasePdf(lease.id)} name={`Lease ${lease.reference}`} label="Download" variant="ghost" size="md" />
          )}
          {lease?.agreement_id && (
            <ButtonLink href={`/agent/agreements/${lease.agreement_id}`} variant="secondary">
              Follow the signing
            </ButtonLink>
          )}
          {lease?.can_cancel && lease.status !== "DRAFT" && (
            <Button variant="ghost" className="text-danger" onClick={() => setConfirm("cancel")}>
              Cancel the lease
            </Button>
          )}
          {lease?.can_delete && (
            <Button variant="ghost" className="text-danger" onClick={() => setConfirm("delete")}>
              <Trash2 className="size-4" aria-hidden="true" />
              Delete the draft
            </Button>
          )}
        </div>
      </div>
      <NoticeArea ref={noticeRef} notice={notice} />
      {restored && !lease && (
        <Alert tone="info" title="We filled in the lease you started on this device." className="mt-4">
          <button
            type="button"
            className="font-medium text-primary-ink underline"
            onClick={() => {
              setRestored(false);
              change(blank(currencies[0]?.value ?? "USD"), 0);
            }}
          >
            Start again with an empty form
          </button>
        </Alert>
      )}
      {lease && lease.status !== "DRAFT" && (
        <Alert tone={lease.status === "SIGNED" ? "success" : "info"} title={`This lease is ${status!.label.toLowerCase()}, so it can no longer be changed.`} className="mt-4">
          {lease.status === "SIGNED" && lease.completed_at && <p>Signed by everyone on {formatWhen(lease.completed_at)}.</p>}
          {lease.cancel_reason && <p>Reason: {lease.cancel_reason}</p>}
          {lease.signing_copy && <p className="break-all text-xs">SHA-256 of the copy sent for signing: <span className="font-mono">{lease.signing_copy.sha256}</span></p>}
        </Alert>
      )}

      <div className="mt-8 space-y-10">
        <section aria-labelledby="lease-property" className="space-y-4">
          <h2 id="lease-property" className="text-2xl">
            Template and property
          </h2>
          <Field id="lease-template" label="Lease template" error={err("template")} hint={market ? `Templates for ${market}.` : undefined}>
            <SearchableSelect
              id="lease-template"
              options={[
                { value: "", label: offered.length ? "Choose a template…" : "No template is offered for this country yet" },
                ...(ownOffered.length > 0 ? [{ label: "Your templates", options: ownOffered.map(templateOption) }] : []),
                ...(sampleOffered.length > 0 ? [{ label: "Samples", options: sampleOffered.map(templateOption) }] : []),
              ]}
              value={values.templateId}
              disabled={!editable}
              onValueChange={(value) => change({ ...values, templateId: value, clauses: [] }, 0)}
              aria-invalid={Boolean(err("template"))}
              aria-describedby={describe("lease-template", "template", Boolean(market))}
            />
          </Field>
          {template && <TemplateNote template={template} organisations={organisations} />}
          {editable && (
            <p className="text-sm text-muted">
              <Link href="/agent/lease-templates" className="font-medium text-primary-ink hover:underline">
                Design your own templates
              </Link>{" "}
              to have them offered here once published.
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Field id="lease-listing" label="One of your listings" optional error={err("listing")} hint={lease ? "It cannot change once the draft is saved." : "Fills in the address."}>
              <SearchableSelect
                id="lease-listing"
                options={[
                  { value: "", label: "No listing: type the address" },
                  ...listings.map((item) => ({ value: item.id, label: item.title, secondary: `${item.reference} · ${item.city.label}, ${item.country.name}` })),
                ]}
                value={values.listingId}
                disabled={!editable || Boolean(lease)}
                onValueChange={(value) => {
                  const chosen = listings.find((item) => item.id === value);
                  const address = chosen ? [chosen.city.label, chosen.country.name].filter(Boolean).join(", ") : values.address;
                  const keepTemplate = !chosen || templates.find((item) => item.id === values.templateId)?.market_code.toUpperCase() === chosen.country.code.toUpperCase();
                  change({ ...values, listingId: value, address: chosen && !values.address.trim() ? address : values.address, templateId: keepTemplate ? values.templateId : "" }, 0);
                }}
                aria-invalid={Boolean(err("listing"))}
                aria-describedby={describe("lease-listing", "listing", true)}
              />
            </Field>
            {needsOrganisation && !values.listingId && (
              <Field id="lease-organisation" label="Lease for" error={err("organisation")}>
                <SearchableSelect
                  id="lease-organisation"
                  options={[{ value: "", label: "Choose an organisation…" }, ...organisations.map((item) => ({ value: item.id, label: item.name, secondary: item.market_code }))]}
                  value={values.organisationId}
                  disabled={!editable}
                  onValueChange={(value) => change({ ...values, organisationId: value }, 0)}
                  aria-invalid={Boolean(err("organisation"))}
                  aria-describedby={describe("lease-organisation", "organisation")}
                />
              </Field>
            )}
            <Field
              id="lease-address"
              label="Property address"
              optional={Boolean(values.listingId)}
              error={err("address")}
              hint={values.listingId ? "Listings have no street address: add the street and number." : undefined}
              className="md:col-span-2"
            >
              <Input
                id="lease-address"
                value={values.address}
                maxLength={320}
                disabled={!editable}
                autoComplete="street-address"
                placeholder="12 Sample Road, Avondale, Harare, Zimbabwe"
                onChange={(event) => change({ ...values, address: event.currentTarget.value })}
                aria-invalid={Boolean(err("address"))}
                aria-describedby={describe("lease-address", "address", Boolean(values.listingId))}
              />
            </Field>
          </div>
        </section>

        <div className="space-y-3">
          <PartyRows side="landlords" word="Landlord" parties={values.landlords} problems={shown} disabled={!editable} onChange={(landlords, delay) => change({ ...values, landlords }, delay)} />
          <label className="flex min-h-11 items-center gap-3 text-ink">
            <input
              type="checkbox"
              checked={Boolean(values.landlordStamp)}
              disabled={!editable}
              onChange={(event) => change({ ...values, landlordStamp: event.currentTarget.checked }, 0)}
              className="size-5 accent-primary"
            />
            <span>
              <span className="font-medium">Add a stamp box for each landlord</span>
              <span className="block text-sm text-muted">Next to their signature. Each landlord adopts a company stamp when they sign.</span>
            </span>
          </label>
        </div>
        <PartyRows side="tenants" word="Tenant" parties={values.tenants} problems={shown} disabled={!editable} onChange={(tenants, delay) => change({ ...values, tenants }, delay)} />

        <section aria-labelledby="lease-terms" className="space-y-4">
          <h2 id="lease-terms" className="text-2xl">
            Term and rent
          </h2>
          <label className="flex min-h-11 items-center gap-3 text-ink">
            <input
              type="checkbox"
              checked={values.periodic}
              disabled={!editable}
              onChange={(event) => change({ ...values, periodic: event.currentTarget.checked, end: event.currentTarget.checked ? "" : values.end }, 0)}
              className="size-5 accent-primary"
            />
            <span>
              <span className="font-medium">Periodic lease</span>
              <span className="block text-sm text-muted">It runs from period to period until notice is given, with no end date.</span>
            </span>
          </label>
          <div className="grid gap-4 md:grid-cols-3">
            <Field id="lease-start" label="Starts on" error={err("start_date")}>
              <Input id="lease-start" type="date" value={values.start} disabled={!editable} onChange={(event) => change({ ...values, start: event.currentTarget.value }, 600)} aria-invalid={Boolean(err("start_date"))} aria-describedby={describe("lease-start", "start_date")} />
            </Field>
            {!values.periodic && (
              <Field id="lease-end" label="Ends on" error={err("end_date")}>
                <Input id="lease-end" type="date" value={values.end} min={values.start || undefined} disabled={!editable} onChange={(event) => change({ ...values, end: event.currentTarget.value }, 600)} aria-invalid={Boolean(err("end_date"))} aria-describedby={describe("lease-end", "end_date")} />
              </Field>
            )}
            <Field id="lease-notice" label="Notice period, in days" error={err("notice_period_days")}>
              <Input id="lease-notice" type="number" inputMode="numeric" min={1} max={365} value={values.notice} disabled={!editable} onChange={(event) => change({ ...values, notice: event.currentTarget.value })} aria-invalid={Boolean(err("notice_period_days"))} aria-describedby={describe("lease-notice", "notice_period_days")} />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <Field id="lease-rent" label="Rent" error={err("rent_amount")}>
              <Input id="lease-rent" inputMode="decimal" value={values.rentAmount} placeholder="1200" disabled={!editable} onChange={(event) => change({ ...values, rentAmount: event.currentTarget.value })} aria-invalid={Boolean(err("rent_amount"))} aria-describedby={describe("lease-rent", "rent_amount")} />
            </Field>
            <Field id="lease-currency" label="Currency" error={err("rent_currency")}>
              <SearchableSelect id="lease-currency" options={currencies} value={values.rentCurrency} disabled={!editable} onValueChange={(value) => change({ ...values, rentCurrency: value }, 0)} aria-invalid={Boolean(err("rent_currency"))} aria-describedby={describe("lease-currency", "rent_currency")} />
            </Field>
            <Field id="lease-period" label="Paid">
              <SearchableSelect
                id="lease-period"
                options={RENT_PERIODS.map((option) => ({ value: option.value, label: option.label }))}
                value={values.rentPeriod}
                disabled={!editable}
                onValueChange={(value) => {
                  const period = value as RentPeriod;
                  const day = Number(values.paymentDay);
                  change({ ...values, rentPeriod: period, paymentDay: period === "WEEKLY" && day > 7 ? "1" : values.paymentDay }, 0);
                }}
              />
            </Field>
            <Field id="lease-payment-day" label="Due on" error={err("payment_day")}>
              <SearchableSelect id="lease-payment-day" options={paymentOptions} value={values.paymentDay} disabled={!editable} onValueChange={(value) => change({ ...values, paymentDay: value }, 0)} aria-invalid={Boolean(err("payment_day"))} aria-describedby={describe("lease-payment-day", "payment_day")} />
            </Field>
          </div>
          <Field id="lease-deposit" label="Deposit" optional error={err("deposit_amount")} hint={`In ${values.rentCurrency || "the rent's currency"}.`} className="max-w-xs">
            <Input id="lease-deposit" inputMode="decimal" value={values.deposit} placeholder="1200" disabled={!editable} onChange={(event) => change({ ...values, deposit: event.currentTarget.value })} aria-invalid={Boolean(err("deposit_amount"))} aria-describedby={describe("lease-deposit", "deposit_amount", true)} />
          </Field>
        </section>

        {template && template.optional_clauses.length > 0 && (
          <fieldset>
            <legend className="text-2xl">Optional clauses</legend>
            <p className="mt-1 text-sm text-muted">Tick the ones this lease includes.</p>
            <ul className="mt-3 space-y-2">
              {template.optional_clauses.map((clause) => (
                <li key={clause.code}>
                  <label className="flex items-start gap-3 rounded-lg border border-line p-4">
                    <input
                      type="checkbox"
                      checked={values.clauses.includes(clause.code)}
                      disabled={!editable}
                      onChange={(event) =>
                        change({ ...values, clauses: event.currentTarget.checked ? [...values.clauses, clause.code] : values.clauses.filter((code) => code !== clause.code) }, 0)
                      }
                      className="mt-0.5 size-5 shrink-0 accent-primary"
                    />
                    <span>
                      <span className="font-medium text-ink">{clause.title}</span>
                      <span className="mt-1 block whitespace-pre-line text-sm text-muted">{clause.text}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}

        <Field id="lease-special" label="Special conditions" optional error={err("special_conditions")} hint="Printed in the lease as written.">
          <Textarea id="lease-special" rows={4} maxLength={4100} value={values.special} disabled={!editable} onChange={(event) => change({ ...values, special: event.currentTarget.value })} aria-invalid={Boolean(err("special_conditions"))} aria-describedby={describe("lease-special", "special_conditions", true)} />
        </Field>

        {editable && !lease && (
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
            <Button
              size="lg"
              onClick={async () => {
                if (await settle()) setNotice({ tone: "success", text: "The draft lease is saved. Preview its PDF, then send it for signing." });
              }}
            >
              Save the draft
            </Button>
            <p className="text-sm text-muted">You can preview the PDF and send it once the draft is saved.</p>
          </div>
        )}
        {lease && lease.status === "DRAFT" && lease.can_send && <SendPanel lease={lease} settle={settle} onSent={(sent) => {
          session.current.lease = sent;
          setLease(sent);
          setNotice({ tone: "success", text: "The lease was sent. Every landlord and tenant has been emailed a link to sign." });
          noticeRef.current?.focus();
        }} />}
        {lease && <Events leaseId={lease.id} version={lease.updated_at} />}
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "delete" ? "Delete this draft lease?" : "Cancel this lease?"}
        confirmLabel={confirm === "delete" ? "Delete it" : "Yes, cancel it"}
        cancelLabel="Keep it"
        busyLabel={confirm === "delete" ? "Deleting…" : "Cancelling…"}
        busy={acting}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && void act(confirm)}
      >
        {confirm === "delete" ? (
          <p>The draft, its PDF and its history are deleted. This cannot be undone.</p>
        ) : (
          <>
            <p>Every signing link stops working and nobody can sign it any more. This cannot be undone.</p>
            <Field id="lease-cancel-reason" label="Reason" optional className="mt-4">
              <Textarea id="lease-cancel-reason" rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.currentTarget.value)} />
            </Field>
          </>
        )}
      </ConfirmDialog>

      {lease && lease.status === "DRAFT" && (
        <p className="mt-10 text-sm text-muted">
          Made from {lease.template.name}, version {lease.template.version}. The draft PDF carries a DRAFT watermark on every page.{" "}
          <Link href="/agent/agreements" className="font-medium text-primary-ink hover:underline">
            All agreements
          </Link>
        </p>
      )}
    </>
  );
}

function PreviewButton({ read, fileName, label }: { read: () => Promise<ApiResult<{ bytes: ArrayBuffer; type: string }>>; fileName: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col">
      <Button
        variant="secondary"
        disabled={busy}
        aria-busy={busy || undefined}
        onClick={async () => {
          setBusy(true);
          setProblem(null);
          const failure = await openPdf(read, fileName);
          setBusy(false);
          if (failure) setProblem(signingMessage(failure));
        }}
      >
        <Eye className="size-4" aria-hidden="true" />
        {busy ? "Opening…" : label}
      </Button>
      {problem && (
        <span role="alert" className="mt-1 text-sm text-danger">
          {problem}
        </span>
      )}
    </span>
  );
}

function WithContext({ leaseId, currencies }: { leaseId: string | null; currencies: Option[] }) {
  const { state, reload } = useApi(loadContext);
  if (state.status === "loading") return <LoadingBlock label="Loading the lease" rows={4} />;
  if (state.status === "error") return <LoadError failure={state.failure} onRetry={reload} />;
  return <Editor leaseId={leaseId} currencies={currencies} context={state.data} />;
}

/** `/agent/leases/new` and `/agent/leases/<id>`: draft a lease from an approved template, preview it, send it for signing. */
export function LeaseEditor({ leaseId, currencies }: { leaseId: string | null; currencies: Option[] }) {
  return <RequireAuth allow={canUseInbox}>{() => <WithContext leaseId={leaseId} currencies={currencies} />}</RequireAuth>;
}

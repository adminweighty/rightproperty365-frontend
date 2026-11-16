"use client";

import { ArrowDown, ArrowUp, FileUp, GripVertical, Plus, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { FieldEditor, forgetLocalFields, toEditorFields, toFieldInputs, usableFields, type EditorField } from "@/components/agreements/field-editor";
import { ColourDot, failureNotice, NoticeArea, type Notice } from "@/components/agreements/shared";
import { useAuth } from "@/components/auth/auth-provider";
import { BackLink, formatWhen, LoadingBlock } from "@/components/portal/portal-ui";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  createAgreement,
  deleteAgreement,
  getAgreementPdf,
  patchAgreement,
  putAgreementFields,
  sendAgreement,
  uploadAgreementDocument,
  type Agreement,
  type AgreementInput,
  type RecipientRole,
  type ReminderFrequency,
} from "@/lib/api/agreements";
import { getDashboard, type DashboardOrganisation } from "@/lib/api/dashboard";
import { EMAIL_MAX, emailProblem } from "@/lib/auth-validation";
import { cn } from "@/lib/cn";
import {
  assignOrders,
  dayAfter,
  dayOf,
  endOfDay,
  expiryProblem,
  fieldTypeLabel,
  formatBytes,
  isSequential,
  move,
  pdfFileProblem,
  RECIPIENTS_MAX,
  REMINDER_OPTIONS,
  ROLE_HINTS,
  ROLE_LABELS,
  signersWithoutSignature,
  signingMessage,
} from "@/lib/signing";

/*
 * Adobe's "Send for signature", in four steps: who signs (and in which
 * order), the PDF, where each of them signs, and a last look before sending.
 * The draft is saved as it is filled in.
 */

type Row = { key: string; id?: string; name: string; email: string; role: RecipientRole };

type Settings = {
  name: string;
  message: string;
  expiry: string;
  reminder: ReminderFrequency;
  sequential: boolean;
  rows: Row[];
  organisationId: string;
};

type Problems = Record<string, string | undefined>;

let rowCounter = 0;
const rowKey = () => `r${Date.now().toString(36)}${(rowCounter++).toString(36)}`;

const roleOptions = (["SIGNER", "APPROVER", "CC"] as RecipientRole[]).map((role) => ({ value: role, label: ROLE_LABELS[role] }));

function settingsFrom(agreement: Agreement | null): Settings {
  if (!agreement) {
    return {
      name: "",
      message: "",
      expiry: dayAfter(Date.now(), 30),
      reminder: "NONE",
      sequential: false,
      rows: [{ key: rowKey(), name: "", email: "", role: "SIGNER" }],
      organisationId: "",
    };
  }
  const recipients = [...agreement.recipients].sort((a, b) => a.order - b.order);
  return {
    name: agreement.name,
    message: agreement.message ?? "",
    expiry: dayOf(agreement.expires_at),
    reminder: agreement.reminder_frequency,
    sequential: isSequential(recipients.map((recipient) => recipient.order)),
    rows:
      recipients.length > 0
        ? recipients.map((recipient) => ({ key: recipient.id, id: recipient.id, name: recipient.name, email: recipient.email, role: recipient.role }))
        : [{ key: rowKey(), name: "", email: "", role: "SIGNER" }],
    organisationId: agreement.organisation?.id ?? "",
  };
}

function problemsOf(settings: Settings, needsOrganisation: boolean): Problems {
  const problems: Problems = {};
  const name = settings.name.trim();
  if (!name) problems.name = "Give the document a name. Recipients see it in the email.";
  else if (Array.from(name).length > 200) problems.name = "Use 200 characters or fewer.";
  if (Array.from(settings.message).length > 2000) problems.message = "Use 2000 characters or fewer.";
  problems.expiry = expiryProblem(settings.expiry, Date.now());
  if (needsOrganisation && !settings.organisationId) problems.organisation = "Choose who sends it.";
  const seen = new Map<string, string>();
  settings.rows.forEach((row) => {
    const rowName = row.name.trim();
    if (!rowName) problems[`${row.key}.name`] = "Enter their name.";
    else if (Array.from(rowName).length > 120) problems[`${row.key}.name`] = "Use 120 characters or fewer.";
    const email = row.email.trim().toLowerCase();
    problems[`${row.key}.email`] = email ? emailProblem(email)?.replace("your email address", "their email address") : "Enter their email address.";
    if (email && !problems[`${row.key}.email`]) {
      if (seen.has(email)) problems[`${row.key}.email`] = "Each recipient needs a different email address.";
      seen.set(email, row.key);
    }
  });
  if (settings.rows.length === 0) problems.recipients = "Add at least one recipient.";
  else if (!settings.rows.some((row) => row.role !== "CC")) problems.recipients = "Add at least one signer or approver: a copy recipient does not sign.";
  if (settings.rows.length > RECIPIENTS_MAX) problems.recipients = `At most ${RECIPIENTS_MAX} recipients.`;
  return problems;
}

const hasProblems = (problems: Problems) => Object.values(problems).some(Boolean);

function inputOf(settings: Settings, create: boolean): AgreementInput {
  const orders = assignOrders(settings.rows.length, settings.sequential);
  return {
    name: settings.name.trim(),
    message: settings.message.trim(),
    expires_at: endOfDay(settings.expiry),
    reminder_frequency: settings.reminder,
    recipients: settings.rows.map((row, index) => ({
      ...(row.id && !create ? { id: row.id } : {}),
      name: row.name.trim(),
      email: row.email.trim(),
      role: row.role,
      order: orders[index],
    })),
    ...(create && settings.organisationId ? { organisation_id: settings.organisationId } : {}),
  };
}

/** API field names (`recipients[0].email`) on the rows they are about. */
function mapApiFields(fields: Record<string, string> | undefined, rows: Row[]): Problems {
  const problems: Problems = {};
  for (const [key, message] of Object.entries(fields ?? {})) {
    const match = /^recipients\[(\d+)\](?:\.(name|email|role|order))?$/.exec(key);
    if (match) {
      const row = rows[Number(match[1])];
      if (row) problems[`${row.key}.${match[2] === "email" ? "email" : "name"}`] = message;
      else problems.recipients = message;
      continue;
    }
    if (key === "expires_at") problems.expiry = message;
    else if (key === "organisation_id") problems.organisation = message;
    else problems[key] = message;
  }
  return problems;
}

type SaveState = { status: "idle" | "saving" | "saved" | "waiting" } | { status: "error"; text: string };

const STEPS = ["Recipients", "Document", "Fields", "Review and send"];

function Steps({ step, reachable, onGo }: { step: number; reachable: number; onGo: (step: number) => void }) {
  return (
    <nav aria-label="Steps">
      <ol className="flex flex-wrap gap-2">
        {STEPS.map((label, index) => {
          const number = index + 1;
          const current = number === step;
          const can = number <= reachable;
          return (
            <li key={label}>
              <button
                type="button"
                disabled={!can}
                aria-current={current ? "step" : undefined}
                onClick={() => onGo(number)}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  current ? "border-primary bg-primary text-on-primary" : "border-line-strong bg-surface text-ink hover:bg-sunken",
                )}
              >
                <span className={cn("flex size-6 items-center justify-center rounded-full text-xs tabular-nums", current ? "bg-primary-hover" : "bg-sunken")}>
                  {number}
                </span>
                {label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Step 1: recipients, their order, and the email they get. */
function RecipientsStep({
  settings,
  problems,
  organisations,
  locked,
  onChange,
  me,
}: {
  settings: Settings;
  problems: Problems;
  organisations: DashboardOrganisation[];
  /** The organisation cannot change once the draft exists. */
  locked: boolean;
  onChange: (next: Settings, delay?: number) => void;
  me: { name: string; email: string };
}) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [bounds] = useState(() => ({ min: dayAfter(Date.now(), 1), max: dayAfter(Date.now(), 365) }));
  const rows = settings.rows;
  const orders = assignOrders(rows.length, settings.sequential);
  const setRow = (key: string, change: Partial<Row>, delay = 900) =>
    onChange({ ...settings, rows: rows.map((row) => (row.key === key ? { ...row, ...change } : row)) }, delay);
  const meAdded = rows.some((row) => row.email.trim().toLowerCase() === me.email.toLowerCase());

  function reorder(from: number, to: number) {
    onChange({ ...settings, rows: move(rows, from, to) }, 0);
    requestAnimationFrame(() => document.getElementById(`recipient-${rows[from].key}-up`)?.focus());
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="send-recipients">
        <h2 id="send-recipients" className="text-2xl">
          Who needs to sign?
        </h2>
        <p className="mt-1 max-w-2xl text-muted">
          Signers sign, approvers approve without signing, and copy recipients get the completed document. You can add
          yourself.
        </p>

        <label className="mt-4 flex min-h-11 items-center gap-3 text-ink">
          <input
            type="checkbox"
            checked={settings.sequential}
            onChange={(event) => onChange({ ...settings, sequential: event.currentTarget.checked }, 0)}
            className="size-5 accent-primary"
          />
          <span>
            <span className="font-medium">Complete in order</span>
            <span className="block text-sm text-muted">
              {settings.sequential
                ? "Each recipient is emailed once the one before has finished."
                : "Everyone is emailed at once and can sign in any order."}
            </span>
          </span>
        </label>

        {problems.recipients && <Alert title={problems.recipients} className="mt-3" />}

        <ol className="mt-4 space-y-3">
          {rows.map((row, index) => {
            const nameId = `recipient-${row.key}-name`;
            const emailId = `recipient-${row.key}-email`;
            const roleId = `recipient-${row.key}-role`;
            const nameError = problems[`${row.key}.name`];
            const emailError = problems[`${row.key}.email`];
            return (
              <li
                key={row.key}
                onDragOver={(event: DragEvent) => {
                  if (dragFrom !== null) event.preventDefault();
                }}
                onDrop={() => {
                  if (dragFrom !== null && dragFrom !== index) reorder(dragFrom, index);
                  setDragFrom(null);
                }}
                className={cn("rounded-lg border bg-surface p-4", dragFrom === index ? "border-primary opacity-60" : "border-line")}
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex items-center gap-2 pt-8">
                    <span
                      draggable
                      onDragStart={(event) => {
                        setDragFrom(index);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => setDragFrom(null)}
                      className="cursor-grab text-subtle"
                      title="Drag to change the order"
                      aria-hidden="true"
                    >
                      <GripVertical className="size-5" />
                    </span>
                    <ColourDot index={index} />
                    <span className="w-6 text-sm font-semibold tabular-nums text-ink" aria-label={`Order ${orders[index]}`}>
                      {orders[index]}
                    </span>
                  </div>
                  <Field id={nameId} label="Name" error={nameError} className="min-w-44 flex-1">
                    <Input
                      id={nameId}
                      value={row.name}
                      maxLength={140}
                      autoComplete="off"
                      onChange={(event) => setRow(row.key, { name: event.currentTarget.value })}
                      aria-invalid={Boolean(nameError)}
                      aria-describedby={fieldDescribedBy(nameId, { error: nameError })}
                    />
                  </Field>
                  <Field id={emailId} label="Email address" error={emailError} className="min-w-56 flex-1">
                    <Input
                      id={emailId}
                      type="email"
                      value={row.email}
                      maxLength={EMAIL_MAX}
                      autoComplete="off"
                      onChange={(event) => setRow(row.key, { email: event.currentTarget.value })}
                      aria-invalid={Boolean(emailError)}
                      aria-describedby={fieldDescribedBy(emailId, { error: emailError })}
                    />
                  </Field>
                  <Field id={roleId} label="Role" hint={ROLE_HINTS[row.role]} className="w-full sm:w-44">
                    <SearchableSelect
                      id={roleId}
                      options={roleOptions}
                      value={row.role}
                      onValueChange={(value) => setRow(row.key, { role: value as RecipientRole }, 0)}
                      aria-describedby={`${roleId}-hint`}
                    />
                  </Field>
                  <div className="flex items-center gap-1 pt-7">
                    <Button
                      id={`recipient-${row.key}-up`}
                      size="sm"
                      variant="ghost"
                      disabled={index === 0}
                      onClick={() => reorder(index, index - 1)}
                      aria-label={`Move ${row.name || `recipient ${index + 1}`} up`}
                    >
                      <ArrowUp className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={index === rows.length - 1}
                      onClick={() => reorder(index, index + 1)}
                      aria-label={`Move ${row.name || `recipient ${index + 1}`} down`}
                    >
                      <ArrowDown className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                      disabled={rows.length === 1}
                      onClick={() => onChange({ ...settings, rows: rows.filter((item) => item.key !== row.key) }, 0)}
                      aria-label={`Remove ${row.name || `recipient ${index + 1}`}`}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-3 flex flex-wrap gap-3">
          <Button
            variant="secondary"
            disabled={rows.length >= RECIPIENTS_MAX}
            onClick={() => {
              const key = rowKey();
              onChange({ ...settings, rows: [...rows, { key, name: "", email: "", role: "SIGNER" }] }, 0);
              requestAnimationFrame(() => document.getElementById(`recipient-${key}-name`)?.focus());
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add a recipient
          </Button>
          {!meAdded && (
            <Button
              variant="ghost"
              disabled={rows.length >= RECIPIENTS_MAX}
              onClick={() => {
                const empty = rows.length === 1 && !rows[0].name && !rows[0].email;
                const mine: Row = { key: rowKey(), name: me.name, email: me.email, role: "SIGNER" };
                onChange({ ...settings, rows: empty ? [mine] : [...rows, mine] }, 0);
              }}
            >
              <UserPlus className="size-4" aria-hidden="true" />
              Add me
            </Button>
          )}
        </div>
      </section>

      <section aria-labelledby="send-message" className="grid gap-4 md:grid-cols-2">
        <h2 id="send-message" className="text-2xl md:col-span-2">
          The email they get
        </h2>
        <Field id="send-name" label="Document name" error={problems.name} className="md:col-span-2">
          <Input
            id="send-name"
            value={settings.name}
            maxLength={220}
            placeholder="For example Inventory and condition report, 12 Sample Road"
            onChange={(event) => onChange({ ...settings, name: event.currentTarget.value }, 900)}
            aria-invalid={Boolean(problems.name)}
            aria-describedby={fieldDescribedBy("send-name", { error: problems.name })}
          />
        </Field>
        <Field id="send-text" label="Message" optional error={problems.message} className="md:col-span-2">
          <Textarea
            id="send-text"
            rows={3}
            maxLength={2100}
            value={settings.message}
            placeholder="Please read and sign the document. Call me if anything is unclear."
            onChange={(event) => onChange({ ...settings, message: event.currentTarget.value }, 900)}
            aria-invalid={Boolean(problems.message)}
            aria-describedby={fieldDescribedBy("send-text", { error: problems.message })}
          />
        </Field>
        <Field id="send-expiry" label="Can be signed until" hint="Default 30 days. At most a year." error={problems.expiry}>
          <Input
            id="send-expiry"
            type="date"
            value={settings.expiry}
            min={bounds.min}
            max={bounds.max}
            onChange={(event) => onChange({ ...settings, expiry: event.currentTarget.value }, 600)}
            aria-invalid={Boolean(problems.expiry)}
            aria-describedby={fieldDescribedBy("send-expiry", { error: problems.expiry, hint: "x" })}
          />
        </Field>
        <Field id="send-reminders" label="Reminders">
          <SearchableSelect
            id="send-reminders"
            options={REMINDER_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
            value={settings.reminder}
            onValueChange={(value) => onChange({ ...settings, reminder: value as ReminderFrequency }, 0)}
          />
        </Field>
        {organisations.length > 1 && (
          <Field id="send-organisation" label="Sent for" error={problems.organisation} hint={locked ? "It cannot change once the draft is saved." : undefined}>
            <SearchableSelect
              id="send-organisation"
              options={[{ value: "", label: "Choose an organisation…" }, ...organisations.map((item) => ({ value: item.id, label: item.name, secondary: item.market_code }))]}
              value={settings.organisationId}
              disabled={locked}
              onValueChange={(value) => onChange({ ...settings, organisationId: value }, 0)}
              aria-invalid={Boolean(problems.organisation)}
              aria-describedby={fieldDescribedBy("send-organisation", { error: problems.organisation, hint: locked ? "x" : undefined })}
            />
          </Field>
        )}
      </section>
    </div>
  );
}

/** Step 2: the PDF to sign. */
function DocumentStep({ agreement, onUploaded }: { agreement: Agreement; onUploaded: (agreement: Agreement, bytes: ArrayBuffer) => void }) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | undefined>();
  const [confirmFile, setConfirmFile] = useState<File | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const document_ = agreement.document;

  async function upload(file: File) {
    setProblem(undefined);
    const wrong = pdfFileProblem(file);
    if (wrong) {
      setProblem(wrong);
      return;
    }
    setBusy(true);
    const [result, bytes] = await Promise.all([uploadAgreementDocument(agreement.id, file), file.arrayBuffer()]);
    setBusy(false);
    if (result.ok) {
      forgetLocalFields(agreement.id);
      onUploaded(result.data.agreement, bytes);
      return;
    }
    setProblem(result.failure.fields?.file ?? signingMessage(result.failure));
  }

  function choose(file: File | undefined) {
    if (!file) return;
    if (document_ && agreement.fields.length > 0) setConfirmFile(file);
    else void upload(file);
  }

  return (
    <section aria-labelledby="send-document">
      <h2 id="send-document" className="text-2xl">
        The document to sign
      </h2>
      <p className="mt-1 max-w-2xl text-muted">A PDF of at most 20 MB and 50 pages that opens without a password.</p>
      {document_ && (
        <Card className="mt-4">
          <p className="font-medium text-ink">{document_.file_name}</p>
          <p className="text-sm text-muted">
            {formatBytes(document_.size_bytes)} · {document_.pages?.length ?? 0} {document_.pages?.length === 1 ? "page" : "pages"}
          </p>
        </Card>
      )}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          choose(event.dataTransfer.files?.[0]);
        }}
        className={cn(
          "mt-4 flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 text-center transition-colors",
          over ? "border-primary bg-primary-soft" : "border-line-strong bg-soft",
        )}
      >
        <FileUp className="size-8 text-muted" aria-hidden="true" />
        <p className="text-ink">{busy ? "Uploading the PDF…" : document_ ? "Drop another PDF here to replace it" : "Drop the PDF here"}</p>
        <Button variant="secondary" onClick={() => input.current?.click()} disabled={busy} aria-busy={busy || undefined}>
          {document_ ? "Choose another PDF" : "Choose a PDF"}
        </Button>
        <input
          ref={input}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose a PDF"
          onChange={(event) => {
            choose(event.currentTarget.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
      </div>
      {problem && <Alert title={problem} className="mt-3" />}
      <ConfirmDialog
        open={confirmFile !== null}
        title="Replace the PDF?"
        confirmLabel="Replace it"
        busy={busy}
        onCancel={() => setConfirmFile(null)}
        onConfirm={() => {
          const file = confirmFile;
          setConfirmFile(null);
          if (file) void upload(file);
        }}
      >
        <p>The fields you placed are removed, because they belong to the old pages.</p>
      </ConfirmDialog>
    </section>
  );
}

function Review({ agreement, settings, fields: all }: { agreement: Agreement; settings: Settings; fields: EditorField[] }) {
  const recipients = [...agreement.recipients].sort((a, b) => a.order - b.order);
  const fields = usableFields(all, recipients);
  const missing = signersWithoutSignature(recipients, fields);
  return (
    <section aria-labelledby="send-review" className="space-y-6">
      <h2 id="send-review" className="text-2xl">
        Review and send
      </h2>
      <Card>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted">Document</dt>
          <dd className="font-medium text-ink">{agreement.name}</dd>
          <dt className="text-muted">File</dt>
          <dd className="text-ink">
            {agreement.document?.file_name} · {agreement.document?.pages?.length ?? 0} pages
          </dd>
          <dt className="text-muted">Order</dt>
          <dd className="text-ink">{settings.sequential ? "One after the other" : "Everyone at once"}</dd>
          <dt className="text-muted">Can be signed until</dt>
          <dd className="text-ink">{formatWhen(agreement.expires_at)}</dd>
          <dt className="text-muted">Reminders</dt>
          <dd className="text-ink">{REMINDER_OPTIONS.find((option) => option.value === agreement.reminder_frequency)?.label}</dd>
          {agreement.message && (
            <>
              <dt className="text-muted">Message</dt>
              <dd className="whitespace-pre-line text-ink">{agreement.message}</dd>
            </>
          )}
        </dl>
      </Card>
      <Card padded={false}>
        <ul className="divide-y divide-line">
          {recipients.map((recipient, index) => {
            const own = fields.filter((field) => field.recipient_id === recipient.id);
            const kinds = [...new Set(own.map((field) => fieldTypeLabel(field.type)))];
            return (
              <li key={recipient.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                <ColourDot index={index} />
                <span className="w-6 text-sm font-semibold tabular-nums">{recipient.order}</span>
                <span className="font-medium text-ink">{recipient.name}</span>
                <span className="break-all text-sm text-muted">{recipient.email}</span>
                <Badge>{ROLE_LABELS[recipient.role]}</Badge>
                <span className="text-sm text-muted sm:ml-auto">
                  {recipient.role === "CC" ? "Gets the completed copy" : own.length === 0 ? "No fields" : `${own.length === 1 ? "1 field" : `${own.length} fields`}: ${kinds.join(", ")}`}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
      {missing.length > 0 && (
        <Alert title={`${missing.join(", ")} ${missing.length === 1 ? "has" : "have"} no signature field yet.`}>
          Go back to Fields and add one for every signer.
        </Alert>
      )}
    </section>
  );
}

export function SendFlow({ initial, onSent }: { initial: Agreement | null; onSent: (agreement: Agreement) => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const [agreement, setAgreement] = useState<Agreement | null>(initial);
  const [settings, setSettingsState] = useState<Settings>(() => settingsFrom(initial));
  const [problems, setProblems] = useState<Problems>({});
  const [showProblems, setShowProblems] = useState(false);
  const [organisations, setOrganisations] = useState<DashboardOrganisation[] | null>(null);
  const [step, setStep] = useState(() => (!initial || initial.recipients.length === 0 ? 1 : !initial.document ? 2 : 3));
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [fields, setFields] = useState<EditorField[]>(() => (initial ? toEditorFields(initial) : []));
  const [save, setSave] = useState<SaveState>({ status: "idle" });
  const [notice, setNotice] = useState<Notice | null>(null);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const noticeRef = useRef<HTMLDivElement>(null);
  const session = useRef({ settings, agreement, inFlight: false, again: false, timer: undefined as ReturnType<typeof setTimeout> | undefined });

  useEffect(() => {
    let cancelled = false;
    getDashboard().then((result) => {
      if (cancelled) return;
      setOrganisations(result.ok ? result.data.organisations.filter((item) => item.can_create_leases ?? item.can_manage_listings) : []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const needsOrganisation = (organisations?.length ?? 0) > 1 && !agreement;
  const currentProblems = useMemo(() => problemsOf(settings, needsOrganisation), [settings, needsOrganisation]);

  // The PDF of a draft that already has one, for the field editor.
  const documentSha = agreement?.document?.sha256;
  const agreementId = agreement?.id;
  useEffect(() => {
    if (!agreementId || !documentSha || bytes) return;
    let cancelled = false;
    getAgreementPdf(agreementId).then((result) => {
      if (!cancelled && result.ok) setBytes(result.data.bytes);
    });
    return () => {
      cancelled = true;
    };
  }, [agreementId, documentSha, bytes]);

  // The latest `flush`, for the save that follows one still on its way.
  const flushRef = useRef<() => Promise<unknown>>(async () => null);

  /** Saves step 1 when it is complete: creates the draft the first time. */
  const flush = useCallback(async (): Promise<Agreement | null> => {
    const s = session.current;
    clearTimeout(s.timer);
    if (s.inFlight) {
      s.again = true;
      return s.agreement;
    }
    const wanted = s.settings;
    const found = problemsOf(wanted, (organisations?.length ?? 0) > 1 && !s.agreement);
    if (hasProblems(found)) {
      setSave({ status: "waiting" });
      return null;
    }
    s.inFlight = true;
    setSave({ status: "saving" });
    const create = !s.agreement;
    const result = create ? await createAgreement(inputOf(wanted, true)) : await patchAgreement(s.agreement!.id, inputOf(wanted, false));
    s.inFlight = false;
    if (!result.ok) {
      const apiProblems = mapApiFields(result.failure.fields, wanted.rows);
      if (Object.keys(apiProblems).length > 0) {
        setProblems(apiProblems);
        setShowProblems(true);
        setSave({ status: "error", text: "Not saved: fix the fields marked in red." });
      } else {
        setSave({ status: "error", text: signingMessage(result.failure) });
      }
      return null;
    }
    const saved = result.data.agreement;
    s.agreement = saved;
    setAgreement(saved);
    // Keep the ids the API gave the recipients, so their fields stay with them.
    const byEmail = new Map(saved.recipients.map((recipient) => [recipient.email.toLowerCase(), recipient.id]));
    const withIds = { ...s.settings, rows: s.settings.rows.map((row) => ({ ...row, id: byEmail.get(row.email.trim().toLowerCase()) })) };
    s.settings = withIds;
    setSettingsState(withIds);
    setSave({ status: "saved" });
    if (create) window.history.replaceState(null, "", `/agent/agreements/${saved.id}`);
    if (s.again) {
      // Edits made while this was saving: save them next.
      s.again = false;
      s.timer = setTimeout(() => void flushRef.current(), 0);
    }
    return saved;
  }, [organisations]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  function change(next: Settings, delay = 900) {
    const s = session.current;
    s.settings = next;
    setSettingsState(next);
    setProblems({});
    clearTimeout(s.timer);
    s.timer = setTimeout(() => void flush(), delay);
  }

  useEffect(() => {
    const s = session.current;
    return () => clearTimeout(s.timer);
  }, []);

  const shownProblems = showProblems ? { ...currentProblems, ...problems } : problems;
  const reachable = !agreement || agreement.recipients.length === 0 ? 1 : !agreement.document ? 2 : 4;

  async function goTo(target: number) {
    setNotice(null);
    if (step === 1 && target > 1) {
      setShowProblems(true);
      if (hasProblems(currentProblems)) {
        const first = Object.entries(currentProblems).find(([, value]) => value)?.[0];
        const id = first === "name" ? "send-name" : first === "expiry" ? "send-expiry" : first?.includes(".") ? `recipient-${first.replace(".", "-")}` : null;
        if (id) requestAnimationFrame(() => document.getElementById(id)?.focus());
        return;
      }
      while (session.current.inFlight) await new Promise((resolve) => setTimeout(resolve, 100));
      const saved = await flush();
      if (!saved) return;
      target = Math.min(target, !saved.document ? 2 : 4);
    }
    setStep(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function send() {
    if (!agreement) return;
    setSending(true);
    setNotice(null);
    const fieldsToSend = usableFields(fields, agreement.recipients);
    const missing = signersWithoutSignature(agreement.recipients, fieldsToSend);
    if (missing.length > 0) {
      setSending(false);
      setNotice({ tone: "danger", text: `Add a signature field for ${missing.join(", ")} first.` });
      noticeRef.current?.focus();
      return;
    }
    // The newest layout first, so what is sent is what is on screen.
    const stored = await putAgreementFields(agreement.id, toFieldInputs(fieldsToSend));
    if (!stored.ok) {
      setSending(false);
      setNotice(failureNotice(stored.failure));
      noticeRef.current?.focus();
      return;
    }
    const result = await sendAgreement(agreement.id);
    setSending(false);
    if (result.ok) {
      forgetLocalFields(agreement.id);
      onSent(result.data.agreement);
      return;
    }
    const detail = result.failure.fields ? ` ${Object.values(result.failure.fields).join(" ")}` : "";
    setNotice({ ...failureNotice(result.failure), text: `${signingMessage(result.failure)}${detail}` });
    noticeRef.current?.focus();
  }

  async function remove() {
    if (!agreement) return;
    setDeleting(true);
    const result = await deleteAgreement(agreement.id);
    setDeleting(false);
    setConfirmDelete(false);
    if (result.ok || result.failure.status === 404) {
      forgetLocalFields(agreement.id);
      router.push("/agent/agreements?view=drafts");
      return;
    }
    setNotice(failureNotice(result.failure));
  }

  if (!user) return null;

  return (
    <>
      <BackLink href="/agent/agreements?view=drafts">Agreements</BackLink>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">{agreement ? agreement.name || "Untitled document" : "Send for signature"}</h1>
          <p className="mt-1 text-sm text-muted" role="status" aria-live="polite">
            {agreement && <span className="font-mono">{agreement.reference} · </span>}
            {save.status === "saving" && "Saving…"}
            {save.status === "saved" && "Draft saved"}
            {save.status === "waiting" && (agreement ? "Changes are saved once every recipient has a name and an email address." : "The draft is saved once it has a name and its recipients.")}
            {save.status === "error" && <span className="text-danger">{save.text}</span>}
            {save.status === "idle" && (agreement ? `Draft, last saved ${formatWhen(agreement.updated_at)}` : "Nothing is sent until you press Send.")}
          </p>
        </div>
        {agreement && (
          <Button variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-4" aria-hidden="true" />
            Delete the draft
          </Button>
        )}
      </div>

      <div className="mt-6">
        <Steps step={step} reachable={reachable} onGo={(target) => void goTo(target)} />
      </div>
      <NoticeArea ref={noticeRef} notice={notice} />

      <div className="mt-8">
        {step === 1 && (
          <RecipientsStep
            settings={settings}
            problems={shownProblems}
            organisations={organisations ?? []}
            locked={Boolean(agreement)}
            onChange={change}
            me={{ name: user.name, email: user.email }}
          />
        )}
        {step === 2 && agreement && (
          <DocumentStep
            agreement={agreement}
            onUploaded={(next, data) => {
              setAgreement(next);
              session.current.agreement = next;
              setBytes(data);
              setFields([]);
              setStep(3);
            }}
          />
        )}
        {step === 3 && agreement && agreement.document && (
          bytes ? (
            <FieldEditor
              key={agreement.document.sha256}
              agreement={agreement}
              bytes={bytes}
              onSaved={(next) => {
                session.current.agreement = next;
                setAgreement(next);
              }}
              onFieldsChange={setFields}
            />
          ) : (
            <LoadingBlock label="Loading the document" rows={2} />
          )
        )}
        {step === 4 && agreement && <Review agreement={agreement} settings={settings} fields={fields} />}
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
        <Button variant="secondary" disabled={step === 1} onClick={() => void goTo(step - 1)}>
          Back
        </Button>
        {step < 4 ? (
          <Button onClick={() => void goTo(step + 1)} disabled={step === 2 && !agreement?.document}>
            Next: {STEPS[step]}
          </Button>
        ) : (
          <Button size="lg" onClick={() => void send()} disabled={sending} aria-busy={sending || undefined}>
            {sending ? "Sending…" : "Send"}
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this draft?"
        confirmLabel="Delete it"
        busyLabel="Deleting…"
        busy={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
      >
        <p>The draft and its uploaded PDF are deleted. Nothing was sent to anyone.</p>
      </ConfirmDialog>
    </>
  );
}

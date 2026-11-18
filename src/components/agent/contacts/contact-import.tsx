"use client";

import { FileUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ContactsShell } from "@/components/agent/contacts/shared";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { importContacts, type ImportReport, type ImportRow } from "@/lib/api/contacts";
import type { DashboardOrganisation } from "@/lib/api/dashboard";
import type { ApiFailure } from "@/lib/api/http";
import { canExportContacts, checkContactCsv, contactHref, contactsPath, IMPORT_MAX_BYTES, IMPORT_MAX_ROWS } from "@/lib/contacts";

type Step =
  | { name: "choose" }
  | { name: "checking"; file: File }
  | { name: "preview"; file: File; report: ImportReport }
  | { name: "done"; report: ImportReport };

const count = (value: number | undefined, one: string, many: string) =>
  `${(value ?? 0).toLocaleString("en-GB")} ${value === 1 ? one : many}`;

/** The counts of a preview or a result: the API's summary, else counted from its rows. */
function totals(report: ImportReport) {
  const rows = report.rows ?? [];
  const by = (status: string) => rows.filter((row) => row.status === status).length;
  const summary = report.summary ?? {};
  return {
    create: summary.create ?? by("CREATE"),
    duplicate: summary.duplicate ?? by("DUPLICATE"),
    error: summary.error ?? (typeof report.errors === "number" ? report.errors : by("ERROR")),
    created: summary.created ?? report.created,
    skipped: summary.skipped ?? report.skipped,
    total: summary.total ?? rows.length,
  };
}

function rowProblems(row: ImportRow): string[] {
  if (Array.isArray(row.errors)) return row.errors;
  if (row.errors && typeof row.errors === "object") return Object.entries(row.errors).map(([column, message]) => `${column}: ${message}`);
  return row.message ? [row.message] : [];
}

function RowResult({ row, org }: { row: ImportRow; org: string }) {
  if (row.status === "CREATE" || row.status === "CREATED") return <Badge tone="success">{row.status === "CREATED" ? "Created" : "Will be created"}</Badge>;
  if (row.status === "DUPLICATE") {
    return (
      <span className="flex flex-col gap-1">
        <Badge tone="warning">Already in the book</Badge>
        {row.duplicate_of && (
          <Link href={contactHref(row.duplicate_of, org)} className="text-sm font-medium text-primary-ink hover:underline">
            {row.duplicate_of_name ? `Open ${row.duplicate_of_name}` : "Open the existing contact"}
          </Link>
        )}
      </span>
    );
  }
  const problems = rowProblems(row);
  return (
    <span className="flex flex-col gap-1">
      <Badge tone="danger">{row.status === "ERROR" ? "Not imported" : row.status}</Badge>
      {problems.map((problem) => (
        <span key={problem} className="text-sm text-danger">
          {problem}
        </span>
      ))}
    </span>
  );
}

function RowsTable({ rows, org, caption }: { rows: ImportRow[]; org: string; caption: string }) {
  if (rows.length === 0) return null;
  return (
    <div role="region" aria-label={caption} tabIndex={0} className="mt-4 overflow-x-auto rounded-md border border-line">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-sunken text-muted">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              Row
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Name
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Email or phone
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Result
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={row.row} className="align-top">
              <th scope="row" className="px-3 py-2 font-normal tabular-nums text-muted">
                {row.row}
              </th>
              <td className="px-3 py-2 text-ink">{row.name || <span className="text-muted">No name</span>}</td>
              <td className="break-all px-3 py-2 text-ink">{[row.email, row.phone].filter(Boolean).join(" · ")}</td>
              <td className="px-3 py-2">
                <RowResult row={row} org={org} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Import({ organisation }: { organisation: DashboardOrganisation }) {
  const org = organisation.id;
  const [step, setStep] = useState<Step>({ name: "choose" });
  const [problem, setProblem] = useState<string | undefined>();
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const input = useRef<HTMLInputElement>(null);
  const result = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (step.name === "preview" || step.name === "done") result.current?.focus();
  }, [step.name]);

  if (!canExportContacts(organisation.role)) {
    return (
      <div className="rounded-lg border border-dashed border-line-strong p-8 text-center">
        <p className="font-medium text-ink">Only the Agency Principal and managers can import contacts</p>
        <p className="mx-auto mt-2 max-w-md text-muted">Ask one of them to import the file, or add contacts one at a time.</p>
        <ButtonLink href={contactsPath("/new", org)} variant="secondary" className="mt-4">
          Add a contact
        </ButtonLink>
      </div>
    );
  }

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setProblem(undefined);
    setFailure(null);
    if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
      setProblem("Choose a CSV file (.csv). Save a spreadsheet as “CSV UTF-8” first.");
      return;
    }
    if (file.size > IMPORT_MAX_BYTES) {
      setProblem(`That file is larger than ${IMPORT_MAX_BYTES / 1024 / 1024} MB. Split it into smaller files.`);
      return;
    }
    const check = checkContactCsv(await file.text());
    if (!check.ok) {
      setProblem(check.problem);
      return;
    }
    setStep({ name: "checking", file });
    const answer = await importContacts(org, file, true);
    if (!answer.ok) {
      setStep({ name: "choose" });
      setFailure(answer.failure);
      if (answer.failure.fields?.file) setProblem(answer.failure.fields.file);
      if (input.current) input.current.value = "";
      return;
    }
    setStep({ name: "preview", file, report: answer.data });
  }

  async function confirm() {
    if (step.name !== "preview") return;
    setBusy(true);
    setConfirmError(undefined);
    const answer = await importContacts(org, step.file, false);
    setBusy(false);
    if (!answer.ok) {
      setConfirmError(answer.failure.message);
      return;
    }
    setOpen(false);
    setStep({ name: "done", report: answer.data });
  }

  function startAgain() {
    setStep({ name: "choose" });
    setProblem(undefined);
    setFailure(null);
  }

  if (step.name === "done") {
    const sums = totals(step.report);
    const created = sums.created ?? sums.create;
    return (
      <Card>
        <h2 ref={result} tabIndex={-1} className="text-xl outline-none">
          Import finished
        </h2>
        <Alert
          tone="success"
          className="mt-3"
          title={`${count(created, "contact was", "contacts were")} added.`}
        >
          {sums.skipped !== undefined && <p>{count(sums.skipped, "row was", "rows were")} left out: already in the book or not valid. Nothing was overwritten.</p>}
          <p>The import is recorded in the team’s activity log.</p>
        </Alert>
        <RowsTable rows={step.report.rows ?? []} org={org} caption="What happened to each row" />
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href={contactsPath("", org)}>See the contacts</ButtonLink>
          <Button variant="secondary" onClick={startAgain}>
            Import another file
          </Button>
        </div>
      </Card>
    );
  }

  if (step.name === "preview") {
    const sums = totals(step.report);
    return (
      <Card>
        <h2 ref={result} tabIndex={-1} className="text-xl outline-none">
          Check the preview of {step.file.name}
        </h2>
        <p className="mt-2 text-ink">Nothing has been imported yet.</p>
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Preview summary">
          <li>
            <Badge tone="success">{count(sums.create, "new contact", "new contacts")}</Badge>
          </li>
          <li>
            <Badge tone="warning">{count(sums.duplicate, "already in the book", "already in the book")}</Badge>
          </li>
          <li>
            <Badge tone="danger">{count(sums.error, "row with errors", "rows with errors")}</Badge>
          </li>
        </ul>
        <p className="mt-3 text-sm text-muted">
          Only the new contacts are added. Rows already in the book and rows with errors are left out, and no existing contact is
          changed. To include a row with errors, correct the file and check it again.
        </p>
        <RowsTable rows={step.report.rows ?? []} org={org} caption={`Preview of ${step.file.name}, row by row`} />
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => setOpen(true)} disabled={sums.create === 0}>
            Import {count(sums.create, "contact", "contacts")}
          </Button>
          <Button variant="secondary" onClick={startAgain}>
            Choose another file
          </Button>
        </div>
        {sums.create === 0 && <p className="mt-2 text-sm text-muted">There is nothing new to import in this file.</p>}
        <ConfirmDialog
          open={open}
          tone="primary"
          title={`Import ${count(sums.create, "contact", "contacts")}?`}
          confirmLabel="Yes, import them"
          busyLabel="Importing…"
          cancelLabel="Not yet"
          busy={busy}
          error={confirmError}
          onConfirm={confirm}
          onCancel={() => {
            setOpen(false);
            setConfirmError(undefined);
          }}
        >
          They are added to {organisation.name}’s contact book, where everyone in the team can see them.
        </ConfirmDialog>
      </Card>
    );
  }

  const checking = step.name === "checking";
  return (
    <Card>
      <h2 className="text-xl">Upload a CSV file</h2>
      <p className="mt-2 text-ink">
        One contact per row, at most {IMPORT_MAX_ROWS.toLocaleString("en-GB")}. The first row names the columns: <code className="font-mono text-sm">name</code>{" "}
        is needed; <code className="font-mono text-sm">email</code>, <code className="font-mono text-sm">phone</code>,{" "}
        <code className="font-mono text-sm">type</code>, <code className="font-mono text-sm">tags</code> and{" "}
        <code className="font-mono text-sm">source</code> are optional.
      </p>
      <p className="mt-2 text-sm text-muted">We check every row first and show you the result. Nothing is added until you confirm.</p>
      <div className="mt-4">
        <label htmlFor="import-file" className="text-sm font-medium text-ink">
          CSV file
        </label>
        <input
          ref={input}
          id="import-file"
          type="file"
          accept=".csv,text/csv"
          onChange={choose}
          disabled={checking}
          aria-invalid={Boolean(problem)}
          aria-describedby={problem ? "import-file-error" : undefined}
          className="mt-1.5 block w-full text-sm text-ink file:mr-3 file:inline-flex file:h-11 file:cursor-pointer file:rounded-md file:border file:border-line-strong file:bg-surface file:px-4 file:text-sm file:font-semibold file:text-ink hover:file:bg-sunken"
        />
        {problem && (
          <p id="import-file-error" className="mt-1.5 text-sm text-danger">
            {problem}
          </p>
        )}
      </div>
      <div aria-live="polite" className="mt-4">
        {checking && (
          <p className="flex items-center gap-2 text-ink" aria-busy="true">
            <FileUp className="size-4 text-primary-ink" aria-hidden="true" />
            Checking {step.file.name}…
          </p>
        )}
        {failure && !failure.fields?.file && <Alert title={failure.message} traceId={failure.traceId} />}
      </div>
    </Card>
  );
}

/** `/agent/contacts/import`: upload a CSV, check the preview row by row, then confirm. OWNER and MANAGER only. */
export function ContactImport() {
  return (
    <ContactsShell
      path="/import"
      section="import"
      title="Import contacts"
      back={{ href: (org) => contactsPath("", org), label: "Contacts" }}
    >
      {(organisation) => <Import organisation={organisation} />}
    </ContactsShell>
  );
}

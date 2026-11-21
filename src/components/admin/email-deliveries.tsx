"use client";

import { MailWarning, RefreshCw } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { RoleGate } from "@/components/admin/admin-gate";
import { BackLink, formatWhen, LoadError, LoadingBlock, StatTile } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import { EMAIL_DELIVERY_ROLES } from "@/lib/api/auth";
import { clearEmailSuppression, getEmailDeliveries, listEmailSuppressions } from "@/lib/api/email-delivery";
import {
  alertLabel,
  clearReasonProblem,
  emailKindLabel,
  formatEmailRate,
  problemLabel,
  suppressionReasonLabel,
  type EmailCounts,
  type EmailDeliveryOverview,
  type EmailSuppression,
} from "@/lib/email-delivery";

const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap text-muted";
const td = "px-3 py-2 align-top text-sm text-ink";

const when = (iso: string) => <time dateTime={iso}>{formatWhen(iso)}</time>;

/** A table that scrolls sideways inside its own box at 320px; the page never does. */
function TableRegion({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="mt-4 overflow-x-auto rounded-lg border border-line bg-surface">
      {children}
    </div>
  );
}

function Section({ id, title, intro, children }: { id: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-2xl">
        {title}
      </h2>
      {intro && <p className="mt-1 max-w-3xl text-sm text-muted">{intro}</p>}
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="mt-4 rounded-lg border border-dashed border-line-strong p-6 text-center text-muted">{children}</p>;
}

function Figures({ title, counts }: { title: string; counts: EmailCounts }) {
  return (
    <div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <ul className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <li><StatTile label="Accepted by the provider" value={counts.accepted} /></li>
        <li><StatTile label="Delivered" value={counts.delivered} /></li>
        <li><StatTile label={`Bounced (${formatEmailRate(counts.bounce_rate)})`} value={counts.bounced} emphasis /></li>
        <li><StatTile label={`Marked as spam (${formatEmailRate(counts.complaint_rate)})`} value={counts.complained} emphasis /></li>
        <li><StatTile label="Delayed" value={counts.delayed} /></li>
        <li><StatTile label="Not sent: suppressed" value={counts.suppressed} /></li>
        <li><StatTile label="Refused by the provider" value={counts.failed} emphasis /></li>
      </ul>
    </div>
  );
}

function Overview({ data }: { data: EmailDeliveryOverview }) {
  return (
    <div className="space-y-10">
      {!data.webhook_configured && (
        <Card className="flex items-start gap-3">
          <MailWarning className="mt-1 size-6 shrink-0 text-muted" aria-hidden="true" />
          <div>
            <h2 className="text-2xl">Delivery reports are off</h2>
            <p className="mt-2 max-w-2xl text-muted">
              This server does not receive the email provider&rsquo;s delivery reports, so bounces and spam complaints are
              not recorded and no address is suppressed. They are turned on with the provider&rsquo;s webhook signing secret
              in the server&rsquo;s settings (<code className="font-mono text-sm">RESEND_WEBHOOK_SECRET</code>).
            </p>
          </div>
        </Card>
      )}
      <Section id="email-figures" title="Figures" intro="Delivered, bounced and spam figures come from the provider's reports. Rates are of the messages accepted in the period.">
        <div className="mt-4 space-y-6">
          <Figures title="Last 24 hours" counts={data.last_24h} />
          <Figures title="Last 7 days" counts={data.last_7d} />
        </div>
      </Section>
      <Section
        id="email-alerts"
        title="Spikes"
        intro="Checked every 5 minutes over the last hour: at least 5 bounces that are 5% or more of the email accepted, or at least 3 spam complaints that are 0.1% or more."
      >
        {data.alerts.length === 0 ? (
          <Empty>No spike in the last 7 days.</Empty>
        ) : (
          <ul className="mt-4 space-y-3">
            {data.alerts.map((a) => (
              <li key={a.id}>
                <Alert tone="warning" title={`${alertLabel(a.kind)}: ${a.events} in the hour to ${formatWhen(a.window_end)}`}>
                  Out of {a.accepted} email{a.accepted === 1 ? "" : "s"} accepted in that hour. Check what was sent then and to
                  whom; a list that is out of date or a template that looks like spam are the usual causes.
                </Alert>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section id="email-problems" title="Recent problems" intro="The latest 50. Addresses are never stored: each recipient is shown as the start of its fingerprint.">
        {data.problems.length === 0 ? (
          <Empty>No email has bounced, been marked as spam or been refused.</Empty>
        ) : (
          <TableRegion label="Recent problems">
            <table className="w-full min-w-[40rem] border-collapse">
              <thead className="border-b border-line">
                <tr>
                  <th scope="col" className={th}>Email</th>
                  <th scope="col" className={th}>What happened</th>
                  <th scope="col" className={th}>Recipient</th>
                  <th scope="col" className={th}>When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.problems.map((p, i) => (
                  <tr key={`${p.recipient}-${p.updated_at}-${i}`}>
                    <td className={td}>{emailKindLabel(p.kind)}</td>
                    <td className={td}>{problemLabel(p)}</td>
                    <td className={`${td} font-mono text-xs`}>{p.recipient}</td>
                    <td className={`${td} whitespace-nowrap`}>{when(p.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableRegion>
        )}
      </Section>
    </div>
  );
}

function Suppressions() {
  const [email, setEmail] = useState("");
  const [searched, setSearched] = useState<string | null>(null);
  const [items, setItems] = useState<EmailSuppression[] | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<EmailSuppression | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [dialogError, setDialogError] = useState<string | undefined>();
  const [cleared, setCleared] = useState<string | null>(null);

  async function search(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setBusy(true);
    setError(undefined);
    setCleared(null);
    const answer = await listEmailSuppressions(email.trim() || undefined);
    setBusy(false);
    if (!answer.ok) {
      setError(answer.failure.fields?.email ?? answer.failure.message);
      return;
    }
    setItems(answer.data.items);
    setSearched(email.trim());
  }

  async function clear() {
    if (!pending) return;
    const problem = clearReasonProblem(reason);
    setReasonError(problem);
    if (problem) return;
    setBusy(true);
    setDialogError(undefined);
    const answer = await clearEmailSuppression(pending.hash, reason.trim());
    setBusy(false);
    if (!answer.ok && answer.failure.status !== 404) {
      setDialogError(answer.failure.fields?.reason ?? answer.failure.message);
      return;
    }
    setItems((current) => (current ?? []).filter((item) => item.hash !== pending.hash));
    setCleared(answer.ok ? "The address can be emailed again." : "It was already cleared.");
    setPending(null);
    setReason("");
  }

  return (
    <Section
      id="email-suppressions"
      title="Suppressed addresses"
      intro="After a permanent bounce or a spam complaint we stop emailing an address, except for sign-in codes, password and address changes and account notices. Look an address up, or list the latest 200."
    >
      <form onSubmit={search} noValidate className="mt-4 flex flex-wrap items-start gap-3">
        <Field id="suppression-email" label="Email address" optional error={error} className="w-full max-w-sm">
          <Input
            id="suppression-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={fieldDescribedBy("suppression-email", { error })}
          />
        </Field>
        <Button type="submit" variant="secondary" className="sm:mt-[26px]" disabled={busy} aria-busy={busy}>
          {email.trim() ? "Look up" : "List the latest"}
        </Button>
      </form>
      <p role="status" className="mt-2 text-sm text-muted">
        {cleared ??
          (items === null
            ? ""
            : items.length === 0
              ? searched
                ? "This address is not suppressed."
                : "No address is suppressed."
              : `${items.length} suppressed address${items.length === 1 ? "" : "es"}.`)}
      </p>
      {items && items.length > 0 && (
        <TableRegion label="Suppressed addresses">
          <table className="w-full min-w-[36rem] border-collapse">
            <thead className="border-b border-line">
              <tr>
                <th scope="col" className={th}>Fingerprint</th>
                <th scope="col" className={th}>Why</th>
                <th scope="col" className={th}>Since</th>
                <th scope="col" className={th}><span className="sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((item) => (
                <tr key={item.hash}>
                  <td className={`${td} font-mono text-xs`}>{item.hash.slice(0, 12)}</td>
                  <td className={td}>{suppressionReasonLabel(item.reason)}</td>
                  <td className={`${td} whitespace-nowrap`}>{when(item.updated_at)}</td>
                  <td className={`${td} text-right`}>
                    <Button size="sm" variant="secondary" onClick={() => setPending(item)}>
                      Clear
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableRegion>
      )}
      <ConfirmDialog
        open={pending !== null}
        title="Email this address again?"
        confirmLabel="Clear the suppression"
        busyLabel="Clearing…"
        tone="primary"
        busy={busy}
        error={dialogError}
        onConfirm={() => void clear()}
        onCancel={() => {
          setPending(null);
          setReason("");
          setReasonError(undefined);
          setDialogError(undefined);
        }}
      >
        <p className="text-sm text-muted">
          {pending?.reason === "COMPLAINT"
            ? "This person marked our email as spam. Clear it only if they asked to receive email again."
            : "This address bounced permanently. Clear it only if the person fixed their mailbox."}{" "}
          The change is recorded in the audit log.
        </p>
        <Field id="suppression-reason" label="Why" error={reasonError} className="mt-3">
          <Textarea
            id="suppression-reason"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            aria-invalid={Boolean(reasonError)}
            aria-describedby={fieldDescribedBy("suppression-reason", { error: reasonError })}
          />
        </Field>
      </ConfirmDialog>
    </Section>
  );
}

function EmailDeliveriesPage() {
  const { state, reload } = useApi(getEmailDeliveries);
  const data = state.status === "ready" ? state.data : state.status === "loading" ? state.previous : undefined;
  return (
    <>
      <BackLink href="/admin">Administration</BackLink>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-4xl">Email delivery</h1>
        <Button variant="secondary" onClick={reload} disabled={state.status === "loading"} aria-busy={state.status === "loading" || undefined}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Check again
        </Button>
      </div>
      <p className="mt-2 max-w-3xl text-muted">
        What happened to our email after the provider accepted it: delivered, bounced or marked as spam, the spikes, and the
        addresses we stopped emailing.
      </p>
      <div className="mt-8 space-y-10">
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "loading" && !data && <LoadingBlock label="Loading the email figures" rows={3} />}
        {data && state.status !== "error" && <Overview data={data} />}
        <Suppressions />
      </div>
    </>
  );
}

/** `/admin/email-deliveries` (SUPER_ADMIN, PLATFORM_ADMIN, SUPPORT). */
export function EmailDeliveries() {
  return (
    <RoleGate roles={EMAIL_DELIVERY_ROLES} what="email delivery">
      {() => <EmailDeliveriesPage />}
    </RoleGate>
  );
}

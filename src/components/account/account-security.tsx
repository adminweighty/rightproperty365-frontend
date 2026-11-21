"use client";

import { KeyRound, Mail, MonitorSmartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { RequireAuth } from "@/components/auth/require-auth";
import { BackLink, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import type { ApiResult } from "@/lib/api/http";
import { changePassword, listSessions, requestEmailChange, revokeOtherSessions, revokeSession } from "@/lib/api/security";
import { deviceLine, revokedText, securityErrorText } from "@/lib/account-security";

type Outcome = { tone: "success" | "danger"; text: string; traceId?: string } | null;

function failureOf<T>(answer: ApiResult<T>): { fields: Record<string, string>; outcome: Outcome } {
  if (answer.ok) return { fields: {}, outcome: null };
  if (answer.failure.fields) return { fields: answer.failure.fields, outcome: null };
  const code = answer.failure.status === 429 ? "RATE_LIMITED" : answer.failure.code;
  return { fields: {}, outcome: { tone: "danger", text: securityErrorText(code) ?? answer.failure.message, traceId: answer.failure.traceId } };
}

function PasswordForm({ onChanged }: { onChanged: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<Outcome>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const answer = await changePassword(current, next);
    setBusy(false);
    if (answer.ok) {
      setErrors({});
      setCurrent("");
      setNext("");
      setOutcome({ tone: "success", text: "Password changed. Your other devices were signed out." });
      onChanged();
      return;
    }
    const f = failureOf(answer);
    setErrors(f.fields);
    setOutcome(f.outcome);
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <h2 className="flex items-center gap-2 text-xl">
        <KeyRound className="size-5 text-primary-ink" aria-hidden="true" />
        Change your password
      </h2>
      <Field id="sec-current" label="Current password" error={errors.current_password} className="max-w-sm">
        <Input id="sec-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)}
          aria-invalid={Boolean(errors.current_password)} aria-describedby={fieldDescribedBy("sec-current", { error: errors.current_password })} />
      </Field>
      <Field id="sec-new" label="New password" hint="At least 10 characters." error={errors.new_password} className="max-w-sm">
        <Input id="sec-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)}
          aria-invalid={Boolean(errors.new_password)} aria-describedby={fieldDescribedBy("sec-new", { hint: "x", error: errors.new_password })} />
      </Field>
      <Button type="submit" disabled={busy} aria-busy={busy}>
        {busy ? "Changing…" : "Change password"}
      </Button>
      <div aria-live="polite">{outcome && <Alert tone={outcome.tone} title={outcome.text} traceId={outcome.traceId} />}</div>
    </form>
  );
}

function Devices({ version }: { version: number }) {
  const load = useCallback(() => listSessions(), []);
  const { state, reload } = useApi(load);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [seen, setSeen] = useState(version);
  if (seen !== version) {
    setSeen(version);
    reload();
  }
  const router = useRouter();
  const auth = useAuth();
  async function signOut(id: string, current: boolean) {
    setBusy(id);
    if (current) {
      // This device: the normal sign-out (clears the cookie and the auth state).
      await auth.signOut();
      router.push("/sign-in");
      return;
    }
    const answer = await revokeSession(id);
    setBusy(null);
    if (answer.ok) {
      setOutcome({ tone: "success", text: "That device was signed out." });
      reload();
      return;
    }
    setOutcome(failureOf(answer).outcome);
  }
  async function others() {
    setBusy("others");
    const answer = await revokeOtherSessions();
    setBusy(null);
    if (answer.ok) {
      setOutcome({ tone: "success", text: revokedText(answer.data.revoked) });
      reload();
      return;
    }
    setOutcome(failureOf(answer).outcome);
  }
  return (
    <section aria-labelledby="sec-devices">
      <h2 id="sec-devices" className="flex items-center gap-2 text-xl">
        <MonitorSmartphone className="size-5 text-primary-ink" aria-hidden="true" />
        Signed-in devices
      </h2>
      <p className="mt-1 text-sm text-muted">Sign out a device you do not recognise, then change your password.</p>
      <div aria-live="polite" className="mt-3">
        {outcome && <Alert tone={outcome.tone} title={outcome.text} traceId={outcome.traceId} />}
      </div>
      {state.status === "loading" && <LoadingBlock label="Loading your devices" rows={2} />}
      {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
      {state.status === "ready" && (
        <>
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
            {state.data.items.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{s.client}</p>
                  <p className="text-sm text-muted">{deviceLine(s, formatWhen)}</p>
                </div>
                <Button size="sm" variant={s.current ? "ghost" : "secondary"} disabled={busy !== null} aria-busy={busy === s.id}
                  onClick={() => void signOut(s.id, s.current)}>
                  Sign out<span className="sr-only"> {s.client}</span>
                </Button>
              </li>
            ))}
          </ul>
          {state.data.items.length > 1 && (
            <Button variant="secondary" className="mt-4" disabled={busy !== null} aria-busy={busy === "others"} onClick={() => void others()}>
              Sign out everywhere else
            </Button>
          )}
        </>
      )}
    </section>
  );
}

function EmailForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<Outcome>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const answer = await requestEmailChange(email, password);
    setBusy(false);
    if (answer.ok) {
      setErrors({});
      setPassword("");
      setOutcome({ tone: "success", text: `Check ${email}: we sent a link to confirm it. Your email changes when you open it (within 24 hours).` });
      return;
    }
    const f = failureOf(answer);
    setErrors({ ...f.fields, ...(f.fields.current_password ? { password: f.fields.current_password } : {}) });
    setOutcome(f.outcome);
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <h2 className="flex items-center gap-2 text-xl">
        <Mail className="size-5 text-primary-ink" aria-hidden="true" />
        Change your email address
      </h2>
      <p className="text-sm text-muted">We send a link to the new address, and tell your current address about the change.</p>
      <Field id="sec-email" label="New email address" error={errors.new_email} className="max-w-sm">
        <Input id="sec-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
          aria-invalid={Boolean(errors.new_email)} aria-describedby={fieldDescribedBy("sec-email", { error: errors.new_email })} />
      </Field>
      <Field id="sec-email-password" label="Your password" error={errors.password} className="max-w-sm">
        <Input id="sec-email-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
          aria-invalid={Boolean(errors.password)} aria-describedby={fieldDescribedBy("sec-email-password", { error: errors.password })} />
      </Field>
      <Button type="submit" variant="secondary" disabled={busy} aria-busy={busy}>
        {busy ? "Sending…" : "Send the confirmation link"}
      </Button>
      <div aria-live="polite">{outcome && <Alert tone={outcome.tone} title={outcome.text} traceId={outcome.traceId} />}</div>
    </form>
  );
}

function Page() {
  const [version, setVersion] = useState(0);
  return (
    <>
      <BackLink href="/account">Your account</BackLink>
      <h1 className="mt-1 text-4xl">Security</h1>
      <p className="mt-2 max-w-2xl text-muted">Your password, the devices signed in to your account, and your email address.</p>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <PasswordForm onChanged={() => setVersion((v) => v + 1)} />
        </Card>
        <Card>
          <EmailForm />
        </Card>
        <Card className="lg:col-span-2">
          <Devices version={version} />
        </Card>
      </div>
    </>
  );
}

/** `/account/security` (API 0.50.0). */
export function AccountSecurity() {
  return <RequireAuth>{() => <Page />}</RequireAuth>;
}

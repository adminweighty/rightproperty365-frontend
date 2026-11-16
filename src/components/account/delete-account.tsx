"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { RequireAuth } from "@/components/auth/require-auth";
import { BackLink } from "@/components/portal/portal-ui";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { deleteMe, type User } from "@/lib/api/auth";
import type { ApiFailure } from "@/lib/api/http";
import { actionMessage } from "@/lib/subscriptions";

const linkClass = "font-medium text-primary-ink hover:underline";

function Consequences() {
  return (
    <>
      <h2 className="font-sans text-lg font-semibold tracking-normal">What happens</h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-relaxed text-ink">
        <li>You are signed out everywhere and can never sign in to this account again.</li>
        <li>Your name and email address are removed from the account.</li>
        <li>You leave every organisation. Your open requests and appointments go back to it.</li>
        <li>Listings you advertise yourself are withdrawn. You stop being the agent on your organisation&apos;s listings.</li>
        <li>Your agent profile is hidden.</li>
        <li>
          Subscriptions waiting for payment or in force are cancelled. No refund is recorded: see the{" "}
          <Link href="/legal/refund-policy" className={linkClass}>
            Refund Policy
          </Link>
          .
        </li>
        <li>Your saved signature is deleted.</li>
      </ul>
      <h2 className="mt-6 font-sans text-lg font-semibold tracking-normal">What we keep</h2>
      <p className="mt-2 leading-relaxed text-ink">
        Signed agreements, leases, our records of changes, and the requests and enquiries you sent stay as they are. We send one
        last email to your address to confirm the deletion.
      </p>
    </>
  );
}

function Form({ user }: { user: User }) {
  const { signOut } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; understood?: string }>({});
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  if (user.platform_roles.length > 0) {
    return (
      <Alert tone="warning" title="An administrator account cannot be deleted here." className="mt-6">
        Ask a Super Administrator to remove your administrator roles first.
      </Alert>
    );
  }

  function check(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = {
      password: password ? undefined : "Type your password.",
      understood: understood ? undefined : "Tick the box to confirm you understand.",
    };
    setErrors(next);
    setFailure(null);
    if (next.password) return document.getElementById("delete-password")?.focus();
    if (next.understood) return document.getElementById("delete-understood")?.focus();
    setConfirming(true);
  }

  async function remove() {
    setBusy(true);
    const answer = await deleteMe(password);
    setBusy(false);
    if (answer.ok) {
      router.replace("/account/deleted");
      // The API already cleared the session cookie: this only resets the page's state.
      void signOut().catch(() => undefined);
      return;
    }
    setConfirming(false);
    if (answer.failure.code === "INVALID_PASSWORD") {
      setErrors({ password: "That password is not right." });
      requestAnimationFrame(() => document.getElementById("delete-password")?.focus());
      return;
    }
    setFailure(answer.failure);
  }

  return (
    <form onSubmit={check} noValidate className="mt-6 space-y-5">
      {failure?.code === "SOLE_OWNER" ? (
        <Alert title={failure.message}>
          Make another member a principal, or remove the members, first.{" "}
          <Link href="/agent/team" className={linkClass}>
            Go to your team
          </Link>
        </Alert>
      ) : (
        failure && (
          <Alert
            title={failure.status === 429 ? "Too many attempts. Please wait a minute and try again." : actionMessage(failure)}
            traceId={actionMessage(failure) === failure.message ? failure.traceId : undefined}
          />
        )
      )}
      <Field id="delete-password" label="Your password" hint="Type it again to confirm it is you." error={errors.password} className="max-w-sm">
        <Input
          id="delete-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-required="true"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (errors.password) setErrors((current) => ({ ...current, password: undefined }));
          }}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={fieldDescribedBy("delete-password", { hint: "x", error: errors.password })}
        />
      </Field>
      <div>
        <label htmlFor="delete-understood" className="flex min-h-11 items-start gap-3 text-ink">
          <input
            id="delete-understood"
            type="checkbox"
            checked={understood}
            onChange={(event) => {
              setUnderstood(event.target.checked);
              if (errors.understood) setErrors((current) => ({ ...current, understood: undefined }));
            }}
            className="mt-0.5 size-5 shrink-0 accent-(--rp-color-primary-base)"
            aria-invalid={Boolean(errors.understood)}
            aria-describedby={errors.understood ? "delete-understood-error" : undefined}
          />
          I understand this cannot be undone.
        </label>
        {errors.understood && (
          <p id="delete-understood-error" className="mt-1 text-sm text-danger">
            {errors.understood}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="danger">
          Delete my account
        </Button>
        <ButtonLink href="/account" variant="secondary">
          Keep my account
        </ButtonLink>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Delete your account for good?"
        confirmLabel="Yes, delete it"
        busyLabel="Deleting…"
        busy={busy}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void remove()}
      >
        <p>
          {user.email} will be signed out everywhere and cannot sign in again. This cannot be undone.
        </p>
      </ConfirmDialog>
    </form>
  );
}

/** `/account/delete`: the person deletes their own account (DELETE /v1/me, API 0.25.0). */
export function DeleteAccount() {
  return (
    <RequireAuth>
      {(user) => (
        <>
          <BackLink href="/account">Your account</BackLink>
          <h1 className="mt-1 text-4xl">Delete your account</h1>
          <p className="mt-2 max-w-2xl leading-relaxed text-muted">Read this first. Deleting your account cannot be undone.</p>
          <Card className="mt-8">
            <Consequences />
            <Form user={user} />
          </Card>
        </>
      )}
    </RequireAuth>
  );
}

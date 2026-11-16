"use client";

import { FileSignature, PenLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AgreementStatusBadge, failureNotice, NoticeArea, type Notice } from "@/components/agreements/shared";
import { RequireAuth } from "@/components/auth/require-auth";
import { BackLink, EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { AdoptSignatureDialog, SignaturePreview } from "@/components/signing/adopt-signature";
import { defaultStamp, StampDesigner, StampPreview } from "@/components/signing/stamp-designer";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  createSigningLink,
  fromSaved,
  getMySignature,
  listSigningRequests,
  putMySignature,
  type AdoptedSignature,
  type SavedSignature,
  type SigningRequest,
} from "@/lib/api/agreements";
import type { Stamp } from "@/lib/api/stamps";
import { cleanStamp, RECIPIENT_STATUS, ROLE_LABELS, signingMessage, stampFieldErrors, stampProblems, statusOf } from "@/lib/signing";

function Request({ item, onNotice }: { item: SigningRequest; onNotice: (notice: Notice) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const recipient = statusOf(RECIPIENT_STATUS, item.recipient_status);
  const finished = item.agreement_status === "COMPLETED" || item.recipient_status === "SIGNED" || item.recipient_status === "APPROVED" || item.recipient_status === "DECLINED";

  async function open() {
    setBusy(true);
    const result = await createSigningLink(item.recipient_id);
    if (result.ok) {
      router.push(`/sign/${result.data.token}`);
      return;
    }
    setBusy(false);
    if (result.failure.code === "NOT_OPEN_FOR_SIGNING") {
      onNotice({ tone: "info", text: `It is not your turn to sign “${item.name}” yet. We will email you when it is.` });
      return;
    }
    onNotice(failureNotice(result.failure));
  }

  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
          {item.name}
          <AgreementStatusBadge status={item.agreement_status} />
        </p>
        <p className="text-sm text-muted">
          From {item.sender_name} · <span className="font-mono">{item.reference}</span> · you {item.role === "APPROVER" ? "approve" : item.role === "CC" ? "get a copy" : "sign"} ({ROLE_LABELS[item.role] ?? item.role})
        </p>
        <p className="text-xs text-subtle">
          {item.sent_at && `Sent ${formatWhen(item.sent_at)} · `}
          {item.completed_at ? `Completed ${formatWhen(item.completed_at)}` : `Can be signed until ${formatWhen(item.expires_at)}`}
          {" · "}
          <Badge tone={recipient.tone}>{recipient.label}</Badge>
        </p>
      </div>
      {item.can_sign ? (
        <Button onClick={() => void open()} disabled={busy} aria-busy={busy || undefined}>
          <FileSignature className="size-4" aria-hidden="true" />
          {busy ? "Opening…" : item.role === "APPROVER" ? "Approve now" : "Sign now"}
          <span className="sr-only"> {item.name}</span>
        </Button>
      ) : finished ? (
        <Button variant="secondary" onClick={() => void open()} disabled={busy} aria-busy={busy || undefined}>
          {busy ? "Opening…" : "View and download"}
          <span className="sr-only"> {item.name}</span>
        </Button>
      ) : (
        <span className="text-sm text-muted">Waiting for others to sign first</span>
      )}
    </li>
  );
}

function Requests() {
  const { state, reload } = useApi(listSigningRequests);
  const [notice, setNotice] = useState<Notice | null>(null);
  const waiting = state.status === "ready" ? state.data.items.filter((item) => item.can_sign) : [];
  const others = state.status === "ready" ? state.data.items.filter((item) => !item.can_sign) : [];

  return (
    <>
      <BackLink href="/dashboard">Dashboard</BackLink>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">Documents to sign</h1>
          <p className="mt-2 max-w-2xl text-muted">Leases and other documents sent to your email address for your signature.</p>
        </div>
        <ButtonLink href="/account/signature" variant="secondary">
          <PenLine className="size-4" aria-hidden="true" />
          Your signature
        </ButtonLink>
      </div>
      <NoticeArea notice={notice} />
      <div className="mt-8 space-y-10">
        {state.status === "loading" && <LoadingBlock label="Loading your documents" rows={2} />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" && state.data.items.length === 0 && (
          <EmptyState title="Nothing to sign">
            When someone sends you a document to sign on RightProperty365, it appears here as well as in your email.
          </EmptyState>
        )}
        {waiting.length > 0 && (
          <section aria-labelledby="signing-waiting">
            <h2 id="signing-waiting" className="text-2xl">
              Waiting for you
            </h2>
            <Card padded={false} className="mt-4">
              <ul className="divide-y divide-line">
                {waiting.map((item) => (
                  <Request key={item.recipient_id} item={item} onNotice={setNotice} />
                ))}
              </ul>
            </Card>
          </section>
        )}
        {others.length > 0 && (
          <section aria-labelledby="signing-others">
            <h2 id="signing-others" className="text-2xl">
              Other documents
            </h2>
            <Card padded={false} className="mt-4">
              <ul className="divide-y divide-line">
                {others.map((item) => (
                  <Request key={item.recipient_id} item={item} onNotice={setNotice} />
                ))}
              </ul>
            </Card>
          </section>
        )}
      </div>
    </>
  );
}

/** `/account/signing`: the documents in which the signed-in person is a recipient. */
export function MySigningRequests() {
  return <RequireAuth>{() => <Requests />}</RequireAuth>;
}

function SavedOne({
  title,
  value,
  onChange,
  onClear,
}: {
  title: string;
  value: AdoptedSignature | null;
  onChange: () => void;
  onClear: () => void;
}) {
  return (
    <Card className="flex flex-col">
      <h2 className="font-sans text-lg font-semibold tracking-normal">{title}</h2>
      <div className="mt-3 flex h-24 items-center justify-center rounded-md border border-dashed border-line-strong bg-white px-4">
        {value ? <SignaturePreview value={value} className="max-h-20 text-4xl" /> : <span className="text-sm text-subtle">None saved</span>}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant={value ? "secondary" : "primary"} onClick={onChange}>
          {value ? "Replace" : "Add"}
          <span className="sr-only"> {title.toLowerCase()}</span>
        </Button>
        {value && (
          <Button variant="ghost" className="text-danger" onClick={onClear}>
            Remove<span className="sr-only"> {title.toLowerCase()}</span>
          </Button>
        )}
      </div>
    </Card>
  );
}

type StoreFailure = { fields: Record<string, string>; text?: string };

/** The saved stamp: its preview, or the designer while it is changed. */
function SavedStamp({
  name,
  stamp,
  busy,
  onSave,
  onClear,
}: {
  name: string;
  stamp: Stamp | null;
  busy: boolean;
  /** Null once saved, or what the API refused. */
  onSave: (stamp: Stamp) => Promise<StoreFailure | null>;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState<Stamp | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | undefined>();

  async function save() {
    if (!draft) return;
    setSubmitted(true);
    const cleaned = cleanStamp(draft);
    if (Object.values(stampProblems(cleaned)).some(Boolean)) return;
    setProblem(undefined);
    const failed = await onSave(cleaned);
    if (failed) {
      setErrors(failed.fields);
      setProblem(failed.text);
      return;
    }
    setDraft(null);
    setSubmitted(false);
    setErrors({});
  }

  return (
    <section aria-labelledby="saved-stamp" className="mt-10">
      <h2 id="saved-stamp" className="text-2xl">
        Stamp
      </h2>
      <p className="mt-1 max-w-2xl text-muted">
        A company stamp for documents that ask for one, such as a lease you sign as a landlord. Type its text and we draw
        it. The day it is applied can be printed in the centre.
      </p>
      <Card className="mt-4">
        {draft ? (
          <>
            <StampDesigner
              value={draft}
              onChange={(next) => {
                setDraft(next);
                setErrors({});
              }}
              errors={errors}
              showAll={submitted}
            />
            {problem && <Alert title={problem} className="mt-4" />}
            <div className="mt-6 flex flex-wrap gap-2">
              <Button onClick={() => void save()} disabled={busy} aria-busy={busy || undefined}>
                {busy ? "Saving…" : "Save the stamp"}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => setDraft(null)}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex size-36 shrink-0 items-center justify-center rounded-md border border-dashed border-line-strong bg-white p-2">
              {stamp ? <StampPreview stamp={stamp} className="size-full" /> : <span className="text-sm text-subtle">None saved</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={stamp ? "secondary" : "primary"}
                onClick={() => {
                  setDraft(stamp ?? defaultStamp(name));
                  setSubmitted(false);
                  setErrors({});
                  setProblem(undefined);
                }}
              >
                {stamp ? "Change" : "Design a stamp"}
                {stamp && <span className="sr-only"> stamp</span>}
              </Button>
              {stamp && (
                <Button variant="ghost" className="text-danger" onClick={onClear}>
                  Remove<span className="sr-only"> stamp</span>
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}

function Signature({ name }: { name: string }) {
  const { state, reload, replace } = useApi(getMySignature);
  const [editing, setEditing] = useState<{ kind: "signature" | "initials"; round: number } | null>(null);
  const [clearing, setClearing] = useState<"signature" | "initials" | "stamp" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<Notice | null>(null);

  /**
   * Saves a change: null when saved. The signature and initials are always
   * sent (a missing one is cleared); the stamp only when it changes (a
   * missing stamp is kept, null clears it).
   */
  async function store(
    saved: SavedSignature,
    change: { signature?: AdoptedSignature | null; initials?: AdoptedSignature | null; stamp?: Stamp | null },
  ): Promise<StoreFailure | null> {
    const signature = change.signature !== undefined ? change.signature : fromSaved(saved.signature);
    const initials = change.initials !== undefined ? change.initials : fromSaved(saved.initials);
    setBusy(true);
    setError(undefined);
    const result = await putMySignature({
      ...(signature ? { signature } : {}),
      ...(initials ? { initials } : {}),
      ...(change.stamp !== undefined ? { stamp: change.stamp } : {}),
    });
    setBusy(false);
    if (!result.ok) {
      const fields = stampFieldErrors(result.failure.fields);
      const text = Object.keys(fields).length > 0 ? undefined : signingMessage(result.failure);
      setError(text ?? "Some of the stamp's text was not accepted.");
      return { fields, text };
    }
    replace(result.data);
    return null;
  }

  return (
    <>
      <BackLink href="/account">Your account</BackLink>
      <h1 className="mt-1 text-4xl">Your signature</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Save a signature, initials and a stamp to add them with one click when you sign a document on RightProperty365.
        You can still change them on each document.
      </p>
      <NoticeArea notice={notice} />
      <div className="mt-8">
        {state.status === "loading" && <LoadingBlock label="Loading your signature" rows={1} />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" && (
          <div className="grid gap-6 md:grid-cols-2">
            <SavedOne
              title="Signature"
              value={fromSaved(state.data.signature)}
              onChange={() => setEditing({ kind: "signature", round: Date.now() })}
              onClear={() => setClearing("signature")}
            />
            <SavedOne
              title="Initials"
              value={fromSaved(state.data.initials)}
              onChange={() => setEditing({ kind: "initials", round: Date.now() })}
              onClear={() => setClearing("initials")}
            />
          </div>
        )}
        {state.status === "ready" && (
          <SavedStamp
            name={name}
            stamp={state.data.stamp ?? null}
            busy={busy}
            onSave={async (stamp) => {
              const failed = await store(state.data, { stamp });
              if (!failed) setNotice({ tone: "success", text: "Your stamp is saved." });
              return failed;
            }}
            onClear={() => {
              setError(undefined);
              setClearing("stamp");
            }}
          />
        )}
      </div>
      {editing && state.status === "ready" && (
        <AdoptSignatureDialog
          key={editing.round}
          open
          kind={editing.kind}
          name={name}
          fonts={state.data.signature_fonts}
          current={fromSaved(editing.kind === "initials" ? state.data.initials : state.data.signature)}
          adoptLabel="Save"
          busy={busy}
          error={error}
          onCancel={() => setEditing(null)}
          onAdopt={async (value) => {
            if (!(await store(state.data, { [editing.kind]: value }))) {
              setNotice({ tone: "success", text: editing.kind === "initials" ? "Your initials are saved." : "Your signature is saved." });
              setEditing(null);
            }
          }}
        />
      )}
      <ConfirmDialog
        open={clearing !== null}
        title={clearing === "initials" ? "Remove your saved initials?" : clearing === "stamp" ? "Remove your saved stamp?" : "Remove your saved signature?"}
        confirmLabel="Remove"
        busy={busy}
        error={error}
        onCancel={() => setClearing(null)}
        onConfirm={async () => {
          if (state.status !== "ready" || !clearing) return;
          if (!(await store(state.data, { [clearing]: null }))) {
            setNotice({ tone: "success", text: clearing === "stamp" ? "Removed. Documents you already stamped keep their stamps." : "Removed. Documents you already signed keep their signatures." });
            setClearing(null);
          }
        }}
      >
        <p>{clearing === "stamp" ? "Documents you already stamped keep their stamps." : "Documents you already signed keep their signatures."}</p>
      </ConfirmDialog>
    </>
  );
}

/** `/account/signature`: the signed-in person's saved signature and initials. */
export function MySignature() {
  return <RequireAuth>{(user) => <Signature name={user.name} />}</RequireAuth>;
}

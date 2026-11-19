"use client";

import { Check } from "lucide-react";
import { useCallback, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { RequireAuth } from "@/components/auth/require-auth";
import { BackLink, EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { DraftNotice, VersionBody } from "@/components/legal/version-body";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { acceptLegalVersion, getLegalDocumentAt } from "@/lib/api/legal";
import { LEGAL_INDEX_PATH } from "@/lib/legal";
import { formatUtc, legalKindLabel, marketLabel, pendingDocumentPath, type PendingLegalAcceptance } from "@/lib/legal-versions";

const keyOf = (item: PendingLegalAcceptance) => `${item.kind}-${item.market_code}-${item.version}`;

/** One version waiting: its published text from the API, and Accept. */
function PendingDocument({ item, onAccepted }: { item: PendingLegalAcceptance; onAccepted: () => Promise<void> }) {
  const load = useCallback(() => getLegalDocumentAt(pendingDocumentPath(item)), [item]);
  const { state, reload } = useApi(load);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; traceId?: string } | null>(null);
  const title = item.title || legalKindLabel(item.kind);
  const headingId = `pending-${keyOf(item)}`;

  async function accept() {
    setBusy(true);
    setError(null);
    const result = await acceptLegalVersion({ kind: item.kind, version: item.version, market_code: item.market_code || "GLOBAL" });
    if (!result.ok) {
      setBusy(false);
      setError({ message: result.failure.message, traceId: result.failure.traceId });
      return;
    }
    // /v1/me no longer lists it: the banner and this card go.
    await onAccepted();
    setBusy(false);
  }

  return (
    <section aria-labelledby={headingId}>
      <Card>
        <h2 id={headingId} className="text-2xl">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted">
          Version {item.version} · takes effect {formatUtc(item.effective_from)} · {marketLabel(item.market_code)}
        </p>
        {item.summary_of_changes && (
          <div className="mt-4 rounded-md bg-tint p-3 text-sm">
            <p className="font-medium text-ink">What changed</p>
            <p className="mt-1 whitespace-pre-wrap text-ink">{item.summary_of_changes}</p>
          </div>
        )}

        <div className="mt-5">
          {state.status === "loading" && <LoadingBlock label={`Loading the ${title}`} rows={1} />}
          {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
          {state.status === "ready" && (
            <>
              {state.data.document.draft_notice && <DraftNotice className="mb-4" />}
              <div className="max-h-[28rem] overflow-y-auto rounded-md border border-line p-4" tabIndex={0} aria-label={`Text of the ${title}`}>
                <VersionBody markdown={state.data.document.body_markdown ?? ""} />
              </div>
            </>
          )}
        </div>

        {error && <Alert title={error.message} traceId={error.traceId} className="mt-4" />}
        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={accept} disabled={busy || state.status !== "ready"} aria-busy={busy || undefined}>
            <Check className="size-4" aria-hidden="true" />
            {busy ? "Accepting…" : `Accept the ${title}`}
          </Button>
        </div>
      </Card>
    </section>
  );
}

function Updates() {
  const auth = useAuth();
  const pending = auth.status === "authenticated" ? auth.pendingLegalAcceptances : [];

  return (
    <>
      <BackLink href="/account">Your account</BackLink>
      <h1 className="mt-1 text-4xl">Updated terms and policies</h1>
      <p className="mt-2 max-w-2xl text-muted">
        We have published a new version of a document you agreed to. Read it and accept it to keep a record that you
        agree. Nothing on your account is paused in the meantime.
      </p>
      <p role="status" className="sr-only">
        {pending.length === 0 ? "Nothing is waiting for you to accept." : ""}
      </p>
      <div className="mt-8 space-y-8">
        {pending.length === 0 ? (
          <EmptyState
            title="You are up to date"
            action={
              <ButtonLink href={LEGAL_INDEX_PATH} variant="secondary">
                Read our terms and policies
              </ButtonLink>
            }
          >
            There is no new version for you to accept.
          </EmptyState>
        ) : (
          pending.map((item) => <PendingDocument key={keyOf(item)} item={item} onAccepted={auth.refresh} />)
        )}
      </div>
    </>
  );
}

/** `/account/legal-updates`: where the "We've updated our Terms" banner leads. */
export function LegalUpdates() {
  return <RequireAuth>{() => <Updates />}</RequireAuth>;
}

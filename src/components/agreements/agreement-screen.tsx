"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { AgreementDetail } from "@/components/agreements/agreement-detail";
import { SendFlow } from "@/components/agreements/send-flow";
import { RequireAuth } from "@/components/auth/require-auth";
import { EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { ButtonLink } from "@/components/ui/button";
import { getAgreement } from "@/lib/api/agreements";
import { canUseInbox } from "@/lib/api/auth";

function Screen({ id }: { id: string }) {
  const load = useCallback(() => getAgreement(id), [id]);
  const { state, reload, replace } = useApi(load);

  if (state.status === "loading" && !state.previous) return <LoadingBlock label="Loading the document" rows={3} />;
  if (state.status === "error") {
    if (state.failure.status === 404) {
      return (
        <EmptyState
          title="We could not find this document"
          action={
            <ButtonLink href="/agent/agreements" variant="secondary">
              Back to agreements
            </ButtonLink>
          }
        >
          It may have been deleted, or it belongs to someone you do not work with.
        </EmptyState>
      );
    }
    return <LoadError failure={state.failure} onRetry={reload} />;
  }
  const agreement = state.status === "ready" ? state.data.agreement : state.previous!.agreement;

  if (agreement.status === "DRAFT" && agreement.can_edit) {
    return <SendFlow key={agreement.id} initial={agreement} onSent={(sent) => replace({ agreement: sent })} />;
  }
  // A new key after every reload: the detail starts again from what the API says.
  return <AgreementDetail key={`${agreement.id}-${agreement.updated_at}`} initial={agreement} onReload={reload} />;
}

/** `/agent/agreements/<id>`: a draft continues in the send flow; anything sent shows its detail. */
export function AgreementScreen({ id }: { id: string }) {
  return <RequireAuth allow={canUseInbox}>{() => <Screen id={id} />}</RequireAuth>;
}

/** `/agent/agreements/new`. */
export function NewAgreement() {
  const router = useRouter();
  return (
    <RequireAuth allow={canUseInbox}>
      {() => <SendFlow initial={null} onSent={(sent) => router.replace(`/agent/agreements/${sent.id}`)} />}
    </RequireAuth>
  );
}

"use client";

import { Mail, Phone } from "lucide-react";
import { useCallback } from "react";
import { EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { listDevelopmentEnquiries } from "@/lib/api/developments";

type Props = {
  organisationId: string;
  developmentId: string;
  /** code -> label of the API's `contact_methods` set. */
  contactMethodLabels: Record<string, string>;
};

/**
 * The enquiries customers sent about this project, newest first, with their
 * contact details: OWNER and MANAGER only (the API answers 403 to others).
 * They are also in the organisation's request inbox.
 */
export function DevelopmentEnquiries({ organisationId, developmentId, contactMethodLabels }: Props) {
  const load = useCallback(() => listDevelopmentEnquiries(organisationId, developmentId), [organisationId, developmentId]);
  const { state, reload } = useApi(load);

  if (state.status === "loading") return <LoadingBlock label="Loading enquiries" rows={1} />;
  if (state.status === "error") {
    if (state.failure.status === 403) {
      return <Alert tone="info" title="Only the Owner and Managers of your organisation read the enquiries of a project." />;
    }
    return <LoadError failure={state.failure} onRetry={reload} />;
  }
  if (state.data.items.length === 0) {
    return (
      <EmptyState title="No enquiries yet">
        When a customer enquires from the project&rsquo;s public page, the enquiry appears here and in your request inbox.
      </EmptyState>
    );
  }
  return (
    <>
      <p className="text-sm text-muted" role="status">
        {state.data.items.length === 1 ? "1 enquiry" : `${state.data.items.length} enquiries`}, newest first
      </p>
      <ul className="mt-4 space-y-4">
        {state.data.items.map((item) => (
          <li key={item.enquiry_id}>
            <Card>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="primary">{item.development?.unit_type?.name ?? "Any unit type"}</Badge>
                {item.replied_at && <Badge tone="success">Replied</Badge>}
                <span className="ml-auto text-sm text-muted">{formatWhen(item.created_at)}</span>
              </div>
              <h3 className="mt-3 break-words font-sans text-lg font-medium tracking-normal">{item.contact.name}</h3>
              <p className="mt-2 max-w-prose whitespace-pre-line break-words leading-relaxed text-ink">{item.message}</p>
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-4 text-sm">
                <a href={`mailto:${item.contact.email}`} className="flex min-h-11 items-center gap-1.5 text-primary-ink hover:underline">
                  <Mail className="size-4" aria-hidden="true" />
                  <span className="break-all">{item.contact.email}</span>
                </a>
                {item.contact.phone && (
                  <a href={`tel:${item.contact.phone}`} className="flex min-h-11 items-center gap-1.5 text-primary-ink hover:underline">
                    <Phone className="size-4" aria-hidden="true" />
                    {item.contact.phone}
                  </a>
                )}
                <span className="text-muted">
                  Prefers {(contactMethodLabels[item.preferred_contact_method] ?? item.preferred_contact_method).toLowerCase()}
                </span>
                <span className="font-mono text-xs text-subtle sm:ml-auto">{item.reference}</span>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}

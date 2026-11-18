"use client";

import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { contactFromRequest } from "@/lib/api/contacts";
import { getDashboard, type DashboardOrganisation } from "@/lib/api/dashboard";
import type { ApiFailure } from "@/lib/api/http";
import { canWriteContacts, contactHref, contactIdFrom, contactsPath } from "@/lib/contacts";

/**
 * One read of the dashboard shared by every button on the page (a list of
 * enquiries or appointments has one per card), kept for 30 seconds.
 */
let shared: { at: number; organisations: Promise<DashboardOrganisation[]> } | null = null;

function writableOrganisations(): Promise<DashboardOrganisation[]> {
  if (!shared || Date.now() - shared.at > 30_000) {
    shared = {
      at: Date.now(),
      organisations: getDashboard().then((answer) =>
        answer.ok ? answer.data.organisations.filter((item) => canWriteContacts(item.role)) : [],
      ),
    };
  }
  return shared.organisations;
}

/** The organisations whose contact book the caller may add to (OWNER, MANAGER, AGENT). */
function useWritableOrganisations(): DashboardOrganisation[] | null {
  const [organisations, setOrganisations] = useState<DashboardOrganisation[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    writableOrganisations().then((items) => {
      if (!cancelled) setOrganisations(items);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return organisations;
}

type Props = {
  /** The property request, business enquiry or appointment. */
  requestId: string;
  /** The customer's name, for the button's accessible name in a list. */
  name?: string;
  className?: string;
};

/**
 * "Create contact" on a property request, business enquiry or appointment:
 * `POST …/contacts/from-request/{id}` makes a contact from it, or links it to
 * the matching contact, and opens that contact. Nothing is shown to a person
 * with no contact book they can write to (a direct owner, Agency Staff).
 */
export function CreateContactButton({ requestId, name, className }: Props) {
  const router = useRouter();
  const organisations = useWritableOrganisations();
  const [chosen, setChosen] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const uid = useId();

  if (!organisations || organisations.length === 0) return null;
  const org = organisations.length === 1 ? organisations[0].id : chosen;

  async function create() {
    if (!org) {
      setFailure({ code: "LOCAL", status: 0, message: "Choose the organisation whose contact book it goes into." });
      return;
    }
    setBusy(true);
    setFailure(null);
    const answer = await contactFromRequest(org, requestId);
    setBusy(false);
    if (answer.ok) {
      const id = contactIdFrom(answer.data);
      router.push(id ? contactHref(id, org) : contactsPath("", org));
      return;
    }
    setFailure(
      answer.failure.status === 404
        ? { ...answer.failure, message: "This organisation cannot make a contact from it. It may have been received by another of your organisations." }
        : answer.failure,
    );
  }

  return (
    <div className={className}>
      {organisations.length > 1 && (
        <Field id={`${uid}-org`} label="Contact book" className="mb-3 max-w-md">
          <SearchableSelect
            id={`${uid}-org`}
            options={[{ value: "", label: "Choose an organisation…" }, ...organisations.map((item) => ({ value: item.id, label: item.name, secondary: item.market_code }))]}
            value={chosen}
            onValueChange={setChosen}
          />
        </Field>
      )}
      <Button variant="secondary" onClick={create} disabled={busy} aria-busy={busy}>
        <UserPlus className="size-4" aria-hidden="true" />
        {busy ? "Creating the contact…" : "Create contact"}
        {name && <span className="sr-only"> for {name}</span>}
      </Button>
      <p className="mt-1 text-sm text-muted">If they are already in your contact book, this links to them instead.</p>
      <div aria-live="polite">{failure && <Alert className="mt-2" title={failure.message} traceId={failure.traceId} />}</div>
    </div>
  );
}

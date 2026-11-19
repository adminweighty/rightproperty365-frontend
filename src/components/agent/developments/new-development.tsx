"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { DeveloperShell, withOrg } from "@/components/agent/developments/developer-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { Membership } from "@/lib/api/auth";
import { createDevelopment } from "@/lib/api/developments";
import type { ApiFailure } from "@/lib/api/http";
import type { DevelopmentEditorLists } from "@/lib/api/server/listing-editor";
import { CONTACT_DETAILS_MESSAGE, containsContactDetails } from "@/lib/developments";

function NewForm({ membership, lists }: { membership: Membership; lists: DevelopmentEditorLists }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [market, setMarket] = useState(membership.market_code ?? "");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [nameError, setNameError] = useState<string | undefined>();

  if (membership.role === "STAFF") {
    return (
      <Alert tone="info" title="Staff members can read projects but not create them" className="mt-6">
        Ask an Owner, Manager or Agent of {membership.organisation_name} to start the project.
      </Alert>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = name.replace(/\s+/g, " ").trim();
    if (!value) return setNameError("Enter the project's name.");
    if (value.length > 120) return setNameError("Keep the name to 120 characters or fewer.");
    if (containsContactDetails(value)) return setNameError(CONTACT_DETAILS_MESSAGE);
    setNameError(undefined);
    setPending(true);
    setFailure(null);
    const result = await createDevelopment(membership.organisation_id, { name: value, ...(market && { market }) });
    if (result.ok) {
      router.push(withOrg(`/agent/developments/${result.data.development.id}`, membership.organisation_id));
      return;
    }
    setPending(false);
    if (result.failure.fields?.name) setNameError(result.failure.fields.name);
    setFailure(
      result.failure.code === "NO_DEVELOPER_PROFILE"
        ? {
            ...result.failure,
            message: `${membership.organisation_name} has no Property Developer profile yet. Projects are shown on it, so it must exist first: finish the Property Developer application from your account.`,
          }
        : result.failure,
    );
  }

  return (
    <>
      <h1 className="mt-2 text-3xl md:text-4xl">New development project</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Start with the name and the country. You add the details, photos, phases and unit types next, then submit the
        project for review. Nothing is public until our team approves it.
      </p>
      <Card className="mt-8 max-w-xl">
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <Field id="new-development-name" label="Project name" hint="As buyers know it, such as Borrowdale Heights." error={nameError}>
            <Input
              id="new-development-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              required
              autoComplete="off"
              aria-invalid={Boolean(nameError)}
              aria-describedby={fieldDescribedBy("new-development-name", { hint: "x", error: nameError })}
            />
          </Field>
          <Field
            id="new-development-market"
            label="Country"
            hint="It cannot be changed later."
            error={failure?.fields?.market}
          >
            <SearchableSelect
              id="new-development-market"
              value={market}
              onValueChange={setMarket}
              options={lists.countries}
              aria-invalid={Boolean(failure?.fields?.market)}
              aria-describedby={fieldDescribedBy("new-development-market", { hint: "x", error: failure?.fields?.market })}
            />
          </Field>
          {failure && !failure.fields && <Alert title={failure.message} traceId={failure.traceId} />}
          <Button type="submit" size="lg" disabled={pending} aria-busy={pending || undefined}>
            {pending ? "Creating…" : "Create the project"}
          </Button>
        </form>
      </Card>
    </>
  );
}

export function NewDevelopment({ lists }: { lists: DevelopmentEditorLists }) {
  return (
    <DeveloperShell back={{ href: "/agent/developments", label: "Development projects" }}>
      {(membership) => <NewForm key={membership.organisation_id} membership={membership} lists={lists} />}
    </DeveloperShell>
  );
}

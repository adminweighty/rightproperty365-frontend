"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { BackLink, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { getDashboard, type Dashboard } from "@/lib/api/dashboard";
import { createListing } from "@/lib/api/manage-listings";
import type { EditorOption } from "@/lib/api/server/listing-editor";

const OWNER = "owner";

type Choice = { value: string; label: string; market?: string };

/** Who a new listing can be for: each organisation the person lists for, and themselves as a direct owner. */
function choicesFor(data: Dashboard): Choice[] {
  const choices: Choice[] = data.organisations
    .filter((organisation) => organisation.can_manage_listings)
    .map((organisation) => ({
      value: organisation.id,
      label: `${organisation.name} (${organisation.role_label})`,
      market: organisation.market_code,
    }));
  if (data.direct_owner) choices.push({ value: OWNER, label: "Yourself, as the owner of the property" });
  return choices;
}

function Form({ data, countries }: { data: Dashboard; countries: EditorOption[] }) {
  const router = useRouter();
  const choices = choicesFor(data);
  const [owner, setOwner] = useState(choices.length === 1 ? choices[0].value : "");
  const [country, setCountry] = useState(choices.length === 1 ? (choices[0].market ?? "") : "");
  const [title, setTitle] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<{ message: string; traceId?: string } | null>(null);
  const [sending, setSending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  if (choices.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line-strong p-10 text-center">
        <h1 className="text-2xl">You cannot add listings yet</h1>
        <p className="mx-auto mt-2 max-w-md text-muted">
          Listings are added by verified agencies and other property businesses, and by approved Landlords and Property
          Sellers (Vendors). If your application is still being reviewed, you can add listings once it is approved.
        </p>
        <ButtonLink href="/dashboard" variant="secondary" className="mt-6">
          Back to your dashboard
        </ButtonLink>
      </div>
    );
  }

  function pickOwner(value: string) {
    setOwner(value);
    setErrors((current) => ({ ...current, owner: "" }));
    // The organisation's country is the likely one; a country already chosen is kept.
    const market = choices.find((choice) => choice.value === value)?.market;
    if (market && !country) setCountry(market);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (choices.length > 1 && !owner) found.owner = "Choose who the listing is for.";
    if (!country) found.country = "Choose the country the property is in.";
    if (title.trim().length > 120) found.title = "Keep the title to 120 characters or fewer.";
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length > 0) {
      const first = Object.keys(found)[0];
      formRef.current?.querySelector<HTMLElement>(`#new-listing-${first}`)?.focus();
      return;
    }
    setSending(true);
    const result = await createListing({
      country,
      ...(title.trim() ? { title: title.trim() } : {}),
      ...(choices.length > 1 ? (owner === OWNER ? { as_direct_owner: true } : { organisation_id: owner }) : {}),
    });
    if (result.ok) {
      router.replace(`/agent/listings/${result.data.listing.id}`);
      return;
    }
    setSending(false);
    const fields = result.failure.fields ?? {};
    const mapped: Record<string, string> = {};
    if (fields.country) mapped.country = fields.country;
    if (fields.title) mapped.title = fields.title;
    if (fields.organisation_id || fields.as_direct_owner) mapped.owner = fields.organisation_id ?? fields.as_direct_owner;
    setErrors(mapped);
    if (Object.keys(mapped).length > 0) {
      formRef.current?.querySelector<HTMLElement>(`#new-listing-${Object.keys(mapped)[0]}`)?.focus();
    } else {
      setFailure({ message: result.failure.message, traceId: result.failure.traceId });
    }
  }

  return (
    <>
      <BackLink href="/agent/listings">Your listings</BackLink>
      <h1 className="mt-2 text-4xl">Add a listing</h1>
      <p className="mt-3 max-w-2xl leading-relaxed text-muted">
        We start a draft that only you and your team can see. You then add the details and photos, and submit it for
        review when it is ready. Everything you type is saved as you go.
      </p>

      <Card className="mt-8">
        <form ref={formRef} noValidate onSubmit={submit} className="grid gap-6">
          {choices.length > 1 && (
            <Field id="new-listing-owner" label="Who is this listing for?" error={errors.owner || undefined}>
              <SearchableSelect
                id="new-listing-owner"
                value={owner}
                onValueChange={pickOwner}
                aria-invalid={Boolean(errors.owner)}
                aria-describedby={fieldDescribedBy("new-listing-owner", { error: errors.owner || undefined })}
                options={[{ value: "", label: "Choose…" }, ...choices.map(({ value, label }) => ({ value, label }))]}
              />
            </Field>
          )}
          <Field
            id="new-listing-country"
            label="Country"
            hint="Where the property is. It sets the currency and the places you can choose."
            error={errors.country || undefined}
          >
            <SearchableSelect
              id="new-listing-country"
              value={country}
              onValueChange={(value) => {
                setCountry(value);
                setErrors((current) => ({ ...current, country: "" }));
              }}
              aria-invalid={Boolean(errors.country)}
              aria-describedby={fieldDescribedBy("new-listing-country", {
                hint: "Where the property is.",
                error: errors.country || undefined,
              })}
              options={[{ value: "", label: "Choose a country…" }, ...countries.map(({ value, label, keywords }) => ({ value, label, keywords }))]}
            />
          </Field>
          <Field
            id="new-listing-title"
            label="Title"
            optional
            hint="For example: Three-bedroom house in Borrowdale. You can change it later."
            error={errors.title || undefined}
          >
            <Input
              id="new-listing-title"
              value={title}
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              aria-invalid={Boolean(errors.title)}
              aria-describedby={fieldDescribedBy("new-listing-title", {
                hint: "For example",
                error: errors.title || undefined,
              })}
            />
          </Field>
          {failure && <Alert title={failure.message} traceId={failure.traceId} />}
          <div>
            <Button type="submit" size="lg" disabled={sending} aria-busy={sending || undefined}>
              {sending ? "Starting the draft…" : "Start the listing"}
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}

function Loader({ countries }: { countries: EditorOption[] }) {
  const { state, reload } = useApi(getDashboard);
  if (state.status === "loading") return <LoadingBlock label="Loading" />;
  if (state.status === "error") return <LoadError failure={state.failure} onRetry={reload} />;
  return <Form data={state.data} countries={countries} />;
}

/** `/agent/listings/new`: who the listing is for and its country, then the editor. */
export function NewListing({ countries }: { countries: EditorOption[] }) {
  return <RequireAuth>{() => <Loader countries={countries} />}</RequireAuth>;
}

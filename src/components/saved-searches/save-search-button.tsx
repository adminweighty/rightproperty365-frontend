"use client";

import { BellPlus } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { createSavedSearch } from "@/lib/api/saved-searches";
import { defaultSearchName, FREQUENCIES, savedSearchErrorText, type AlertFrequency } from "@/lib/saved-searches";

type Props = {
  /** The search's API query string (no paging, sort or map box). */
  query: string;
  heading: string;
  className?: string;
};

/** "Save this search" on the search results (API 0.52.0). */
export function SaveSearchButton({ query, heading, className }: Props) {
  const { status } = useAuth();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultSearchName(heading));
  const [frequency, setFrequency] = useState<AlertFrequency>("DAILY");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; field?: string; traceId?: string } | null>(null);
  const [saved, setSaved] = useState(false);

  if (status === "loading") return null;
  if (status === "anonymous") {
    const here = `${pathname}${params.size ? `?${params.toString()}` : ""}`;
    return (
      <ButtonLink href={`/sign-in?next=${encodeURIComponent(here)}`} variant="secondary" size="sm" className={className}>
        <BellPlus className="size-4" aria-hidden="true" />
        Sign in to save this search
      </ButtonLink>
    );
  }
  if (saved) {
    return (
      <div className={className} aria-live="polite">
        <Alert tone="success" title="Search saved.">
          {frequency === "OFF" ? "No alerts will be sent. " : "We will email you when new listings match. "}
          <Link href="/account/saved-searches" className="font-medium text-primary-ink underline underline-offset-2">
            Your saved searches
          </Link>
        </Alert>
      </div>
    );
  }
  if (!open) {
    return (
      <Button variant="secondary" size="sm" className={className} onClick={() => setOpen(true)}>
        <BellPlus className="size-4" aria-hidden="true" />
        Save this search
      </Button>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const answer = await createSavedSearch({ name, query, frequency });
    setBusy(false);
    if (answer.ok) {
      setSaved(true);
      return;
    }
    const fields = answer.failure.fields ?? {};
    if (fields.name) setError({ text: fields.name, field: "name" });
    else if (Object.keys(fields).length > 0) setError({ text: "This search cannot be saved as it is. Change a filter and try again." });
    else
      setError({
        text: savedSearchErrorText(answer.failure.status === 429 ? "RATE_LIMITED" : answer.failure.code) ?? answer.failure.message,
        traceId: answer.failure.traceId,
      });
  }

  return (
    <form onSubmit={submit} noValidate className={`rounded-lg border border-line bg-surface p-4 ${className ?? ""}`}>
      <h2 className="font-sans text-base font-semibold tracking-normal text-ink">Save this search</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Field id="save-search-name" label="Name" error={error?.field === "name" ? error.text : undefined}>
          <Input
            id="save-search-name"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={error?.field === "name"}
            aria-describedby={fieldDescribedBy("save-search-name", { error: error?.field === "name" ? error.text : undefined })}
          />
        </Field>
        <Field id="save-search-frequency" label="Email me new listings">
          <SearchableSelect
            id="save-search-frequency"
            value={frequency}
            onValueChange={(v) => setFrequency(v as AlertFrequency)}
            options={FREQUENCIES.map((f) => ({ value: f.value, label: f.label }))}
          />
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="submit" size="sm" disabled={busy} aria-busy={busy}>
          {busy ? "Saving…" : "Save the search"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <div aria-live="polite" className="mt-3">
        {error && !error.field && <Alert tone="danger" title={error.text} traceId={error.traceId} />}
      </div>
    </form>
  );
}

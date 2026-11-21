"use client";

import { Flag } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Textarea } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { apiFetch } from "@/lib/api/http";

/** Report reasons (API 0.54.0), in the API's codes. */
const REASONS = [
  { value: "FRAUD", label: "It looks like a scam" },
  { value: "MISLEADING", label: "The details or photos are misleading" },
  { value: "ALREADY_SOLD_OR_LET", label: "It is already sold or let" },
  { value: "WRONG_PRICE", label: "The price is wrong" },
  { value: "DUPLICATE", label: "It is listed more than once" },
  { value: "OFFENSIVE", label: "It is offensive" },
  { value: "OTHER", label: "Something else" },
];

/** "Report this listing" on a listing page (API 0.54.0). Works signed out. */
export function ReportListing({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("FRAUD");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [sent, setSent] = useState(false);

  async function send() {
    setBusy(true);
    const answer = await apiFetch<{ received: boolean }>(
      `/v1/listings/${encodeURIComponent(slug)}/reports`,
      {
        method: "POST",
        body: { reason, note: note.trim() || undefined },
      },
    );
    setBusy(false);
    if (answer.ok) {
      setOpen(false);
      setSent(true);
      return;
    }
    if (answer.failure.status === 429)
      setError(
        "Too many reports from here in a short time. Wait a minute and try again.",
      );
    else
      setError(
        answer.failure.fields?.note ??
          answer.failure.fields?.reason ??
          answer.failure.message,
      );
  }

  if (sent) {
    return (
      <div aria-live="polite">
        <Alert
          tone="success"
          title="Thank you. Our moderators will look at this listing."
        />
      </div>
    );
  }
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted"
        onClick={() => {
          setError(undefined);
          setOpen(true);
        }}
      >
        <Flag className="size-4" aria-hidden="true" />
        Report this listing
      </Button>
      <ConfirmDialog
        open={open}
        title="Report this listing"
        confirmLabel="Send the report"
        busyLabel="Sending…"
        tone="primary"
        busy={busy}
        error={error}
        onConfirm={() => void send()}
        onCancel={() => setOpen(false)}
      >
        <p>
          Our moderators check every report. The advertiser is not told who
          reported it.
        </p>
        <div className="mt-4 grid gap-4 text-ink">
          <Field id="report-reason" label="What is wrong?">
            <SearchableSelect
              id="report-reason"
              value={reason}
              onValueChange={setReason}
              options={REASONS}
            />
          </Field>
          <Field
            id="report-note"
            label="Details"
            optional={reason !== "OTHER"}
            hint="Do not include your own contact details."
          >
            <Textarea
              id="report-note"
              rows={3}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        </div>
      </ConfirmDialog>
    </>
  );
}

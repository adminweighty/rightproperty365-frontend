"use client";

import { CircleCheck, CircleX, FileSearch } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { formatWhen } from "@/components/portal/portal-ui";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { verifyFile, verifyReference, type Verification } from "@/lib/api/agreements";
import { cn } from "@/lib/cn";
import { AGREEMENT_REFERENCE, cleanReference, pdfFileProblem, signingMessage } from "@/lib/signing";

type Answer =
  | { kind: "reference"; data: Verification }
  | { kind: "file"; data: Verification; fileName: string; sha256: string | null }
  | { kind: "missing"; reference: string };

async function sha256Of(file: File): Promise<string | null> {
  try {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

function Fingerprints({ data }: { data: Verification }) {
  return (
    <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
      <dt className="text-muted">Reference</dt>
      <dd className="font-mono text-ink">{data.reference}</dd>
      {data.completed_at && (
        <>
          <dt className="text-muted">Completed</dt>
          <dd className="text-ink">{formatWhen(data.completed_at)}</dd>
        </>
      )}
      <dt className="text-muted">Signatures and approvals</dt>
      <dd className="text-ink">{data.signatures}</dd>
      <dt className="text-muted">SHA-256 of the final PDF</dt>
      <dd className="break-all font-mono text-ink">{data.final_sha256}</dd>
      <dt className="text-muted">SHA-256 of the original</dt>
      <dd className="break-all font-mono text-ink">{data.original_sha256}</dd>
    </dl>
  );
}

function Result({ answer }: { answer: Answer }) {
  if (answer.kind === "missing") {
    return (
      <Card className="border-warning">
        <h2 className="flex items-center gap-2 font-sans text-xl font-semibold tracking-normal">
          <CircleX className="size-6 text-warning" aria-hidden="true" />
          No completed document has the reference {answer.reference}
        </h2>
        <p className="mt-2 text-muted">
          Check the reference on the audit report, the last page of the PDF. A document that is still out for signature, or
          was cancelled or declined, cannot be checked here.
        </p>
      </Card>
    );
  }
  const { data } = answer;
  if (answer.kind === "file" && !data.match) {
    return (
      <Card className="border-danger">
        <h2 className="flex items-center gap-2 font-sans text-xl font-semibold tracking-normal">
          <CircleX className="size-6 text-danger" aria-hidden="true" />
          This file does not match any completed document
        </h2>
        <p className="mt-2 text-muted">
          {answer.fileName} is not, byte for byte, a document completed on RightProperty365. It may have been changed,
          printed and scanned, or saved again by another program. Ask the sender for the copy they emailed.
        </p>
        {answer.sha256 && (
          <p className="mt-3 break-all text-sm text-muted">
            SHA-256 of your file: <span className="font-mono text-ink">{answer.sha256}</span>
          </p>
        )}
      </Card>
    );
  }
  return (
    <Card className="border-success">
      <h2 className="flex items-center gap-2 font-sans text-xl font-semibold tracking-normal">
        <CircleCheck className="size-6 text-success" aria-hidden="true" />
        {answer.kind === "file"
          ? data.document === "ORIGINAL"
            ? "This file is the original of a completed document"
            : "This file is a completed document, unchanged"
          : "This reference is a completed document"}
      </h2>
      {answer.kind === "file" ? (
        <p className="mt-2 text-muted">
          {data.document === "ORIGINAL"
            ? "It is the document as it was sent, before anyone signed. The signed copy has a different fingerprint, listed below."
            : "Its SHA-256 fingerprint is the one recorded when everybody had signed, so not a single byte has changed since."}
        </p>
      ) : (
        <p className="mt-2 text-muted">
          Compare the fingerprint below with your copy, or upload the PDF to check it for you. We never show names or the
          document here.
        </p>
      )}
      <Fingerprints data={data} />
      {data.statement && <p className="mt-4 text-xs leading-relaxed text-muted">{data.statement}</p>}
    </Card>
  );
}

/** `/verify`: is this reference, or this PDF, a document completed on RightProperty365? */
export function VerifyForm() {
  const params = useSearchParams();
  const initial = cleanReference(params.get("reference") ?? "");
  const [reference, setReference] = useState(AGREEMENT_REFERENCE.test(initial) ? initial : "");
  const [referenceError, setReferenceError] = useState<string | undefined>();
  const [fileError, setFileError] = useState<string | undefined>();
  const [failure, setFailure] = useState<{ text: string; traceId?: string } | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [busy, setBusy] = useState<"reference" | "file" | null>(null);
  const [over, setOver] = useState(false);
  const result = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const checkedInitial = useRef(false);

  async function checkReference(value: string) {
    const clean = cleanReference(value);
    setFailure(null);
    if (!clean) return setReferenceError("Enter the reference, like RPA-2026-000123.");
    if (!AGREEMENT_REFERENCE.test(clean)) return setReferenceError("A reference looks like RPA-2026-000123.");
    setReferenceError(undefined);
    setBusy("reference");
    const answer = await verifyReference(clean);
    setBusy(null);
    if (answer.ok) setAnswer({ kind: "reference", data: answer.data });
    else if (answer.failure.status === 404) setAnswer({ kind: "missing", reference: clean });
    else setFailure({ text: signingMessage(answer.failure), traceId: answer.failure.traceId });
    requestAnimationFrame(() => result.current?.focus());
  }

  useEffect(() => {
    if (checkedInitial.current || !reference) return;
    checkedInitial.current = true;
    const timer = window.setTimeout(() => void checkReference(reference), 0);
    return () => window.clearTimeout(timer);
    // Only the reference the page was opened with is checked by itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkFile(file: File | undefined) {
    if (!file) return;
    setFailure(null);
    const problem = pdfFileProblem(file);
    if (problem) return setFileError(problem);
    setFileError(undefined);
    setBusy("file");
    const [answer, sha256] = await Promise.all([verifyFile(file), sha256Of(file)]);
    setBusy(null);
    if (answer.ok) setAnswer({ kind: "file", data: answer.data, fileName: file.name, sha256 });
    else if (answer.failure.status === 404) setAnswer({ kind: "file", data: { match: false } as Verification, fileName: file.name, sha256 });
    else setFailure({ text: answer.failure.fields?.file ?? signingMessage(answer.failure), traceId: answer.failure.traceId });
    requestAnimationFrame(() => result.current?.focus());
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="font-sans text-xl font-semibold tracking-normal">Check a reference</h2>
          <p className="mt-1 text-sm text-muted">It is on the audit report, the last page of the signed PDF.</p>
          <form
            className="mt-4 flex flex-wrap items-end gap-3"
            noValidate
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              void checkReference(reference);
            }}
          >
            <Field id="verify-reference" label="Reference" error={referenceError} className="min-w-52 flex-1">
              <Input
                id="verify-reference"
                value={reference}
                placeholder="RPA-2026-000123"
                autoComplete="off"
                spellCheck={false}
                maxLength={40}
                className="font-mono uppercase"
                onChange={(event) => {
                  setReference(event.currentTarget.value);
                  setReferenceError(undefined);
                }}
                aria-invalid={Boolean(referenceError)}
                aria-describedby={fieldDescribedBy("verify-reference", { error: referenceError })}
              />
            </Field>
            <Button type="submit" disabled={busy !== null} aria-busy={busy === "reference" || undefined}>
              {busy === "reference" ? "Checking…" : "Check"}
            </Button>
          </form>
        </Card>
        <Card>
          <h2 className="font-sans text-xl font-semibold tracking-normal">Check a PDF</h2>
          <p className="mt-1 text-sm text-muted">We compare its fingerprint with completed documents. The file is not kept.</p>
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setOver(false);
              void checkFile(event.dataTransfer.files?.[0]);
            }}
            className={cn(
              "mt-4 flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-5 text-center",
              over ? "border-primary bg-primary-soft" : "border-line-strong bg-soft",
            )}
          >
            <FileSearch className="size-7 text-muted" aria-hidden="true" />
            <p className="text-sm text-ink">Drop the PDF here, or</p>
            <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={busy !== null} aria-busy={busy === "file" || undefined}>
              {busy === "file" ? "Checking…" : "Choose a PDF"}
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              tabIndex={-1}
              aria-label="Choose a PDF to check"
              onChange={(event) => {
                void checkFile(event.currentTarget.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
          </div>
          {fileError && <p className="mt-2 text-sm text-danger" role="alert">{fileError}</p>}
        </Card>
      </div>
      <div ref={result} tabIndex={-1} aria-live="polite" className="outline-none">
        {failure && <Alert title={failure.text} traceId={failure.traceId} />}
        {answer && !failure && <Result answer={answer} />}
      </div>
    </div>
  );
}

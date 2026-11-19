"use client";

import { Download, ExternalLink } from "lucide-react";
import { useState, type Ref } from "react";
import { openPdf, pdfName, savePdf } from "@/components/signing/pdf-file";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AgreementRecipient } from "@/lib/api/agreements";
import type { ApiFailure, ApiResult } from "@/lib/api/http";
import { cn } from "@/lib/cn";
import { isScanErrorCode } from "@/lib/file-scan";
import { AGREEMENT_STATUS, isKnownCode, RECIPIENT_STATUS, recipientColour, ROLE_LABELS, signingMessage, statusOf } from "@/lib/signing";

/** The result of an action, shown where it was taken. */
export type Notice = { tone: "success" | "danger" | "warning" | "info"; text: string; traceId?: string };

export const failureNotice = (failure: ApiFailure, tone: Notice["tone"] = "danger"): Notice => ({
  tone,
  text: signingMessage(failure),
  traceId: isKnownCode(failure.code) || isScanErrorCode(failure.code) ? undefined : failure.traceId,
});

/** A focusable live region for the result of an action. */
export function NoticeArea({ notice, ref, className }: { notice: Notice | null; ref?: Ref<HTMLDivElement>; className?: string }) {
  return (
    <div ref={ref} tabIndex={-1} aria-live="polite" className={cn("outline-none", className)}>
      {notice && <Alert tone={notice.tone} title={notice.text} traceId={notice.traceId} className="mt-3" />}
    </div>
  );
}

export function AgreementStatusBadge({ status }: { status: string }) {
  const { label, tone } = statusOf(AGREEMENT_STATUS, status);
  return <Badge tone={tone}>{label}</Badge>;
}

/** Each recipient with a dot in their colour, their role and where they are. */
export function RecipientChips({ recipients, compact }: { recipients: AgreementRecipient[]; compact?: boolean }) {
  const sorted = [...recipients].sort((a, b) => a.order - b.order);
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Recipients">
      {sorted.map((recipient, index) => {
        const { label, tone } = statusOf(RECIPIENT_STATUS, recipient.status);
        return (
          <li key={recipient.id}>
            <Badge tone={tone} className="gap-1.5">
              <span className="size-2 rounded-full" style={{ background: recipientColour(index) }} aria-hidden="true" />
              <span className="max-w-40 truncate">{recipient.name}</span>
              {!compact && <span className="opacity-80">· {ROLE_LABELS[recipient.role] ?? recipient.role}</span>}
              <span className="opacity-80">· {label}</span>
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}

/** "Download PDF" (and optionally "Open"): the PDF is read with the session and saved from memory. */
export function PdfActions({
  read,
  name,
  reference,
  label = "Download PDF",
  open,
  size = "sm",
  variant = "secondary",
}: {
  read: () => Promise<ApiResult<{ bytes: ArrayBuffer; type: string }>>;
  name: string;
  reference?: string;
  label?: string;
  /** Also offer to open it in a new tab. */
  open?: string;
  size?: "sm" | "md";
  variant?: "secondary" | "ghost" | "primary";
}) {
  const [busy, setBusy] = useState<"save" | "open" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const file = pdfName(name, reference);

  async function run(kind: "save" | "open") {
    setBusy(kind);
    setProblem(null);
    const failure = await (kind === "save" ? savePdf(read, file) : openPdf(read, file));
    setBusy(null);
    if (failure) setProblem(signingMessage(failure));
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {open && (
        <Button size={size} variant={variant} onClick={() => void run("open")} disabled={busy !== null} aria-busy={busy === "open" || undefined}>
          <ExternalLink className="size-4" aria-hidden="true" />
          {busy === "open" ? "Opening…" : open}
        </Button>
      )}
      <Button size={size} variant={open ? "ghost" : variant} onClick={() => void run("save")} disabled={busy !== null} aria-busy={busy === "save" || undefined}>
        <Download className="size-4" aria-hidden="true" />
        {busy === "save" ? "Preparing…" : label}
      </Button>
      {problem && (
        <span role="alert" className="text-sm text-danger">
          {problem}
        </span>
      )}
    </span>
  );
}

/** A dot in the recipient's colour. */
export function ColourDot({ index, className }: { index: number; className?: string }) {
  return <span className={cn("inline-block size-3 shrink-0 rounded-full", className)} style={{ background: recipientColour(index) }} aria-hidden="true" />;
}

"use client";

import { CircleCheck, Eye, FileText, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { PrivateImage } from "@/components/ui/private-image";
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_MAX_BYTES,
  DOCUMENT_TYPES,
  documentUrl,
  formatFileSize,
  removeDocument,
  uploadDocument,
  type OnboardingDocument,
} from "@/lib/api/onboarding";
import { LOGO_ACCEPT, LOGO_DOCUMENT, LOGO_FORMATS_NOTE, logoProblem } from "@/lib/logo-rules";

type Props = {
  /** The account role code the application is for. */
  role: string;
  /** The document type, from the API's requirements. */
  type: { code: string; label: string; description: string; required: boolean };
  /** The attached file of this type, if any. */
  document?: OnboardingDocument;
  /** False while the application is under review or decided: the file can only be opened. */
  editable: boolean;
  /** A problem reported when the application was submitted ("is required"). */
  error?: string;
  /** Called after a file was uploaded or removed, so the application can be read again. */
  onChanged: () => Promise<void>;
};

type Notice = { tone: "status" | "alert"; text: string };

/** Checks a file before it is sent. The API checks again, by content. */
function problemWith(file: File, isLogo: boolean): string | null {
  if (isLogo) return logoProblem(file);
  if (file.size > DOCUMENT_MAX_BYTES) {
    return `${file.name} is ${formatFileSize(file.size)}. Choose a file of 10 MB or less.`;
  }
  // Some systems give no type for a file; the API decides by content anyway.
  if (file.type && !DOCUMENT_TYPES.includes(file.type)) {
    return `${file.name} is not a PDF, JPEG or PNG file. Choose a PDF, JPEG or PNG.`;
  }
  return null;
}

/**
 * One document of an onboarding application: what is asked for, the file that
 * is attached, and the controls to upload, replace or remove it. Each row
 * uploads on its own, so one slow file does not hold up the rest.
 *
 * The logo is the one document that becomes public. Its row says so, takes
 * images only and shows the picture that was uploaded, so it is not mistaken
 * for the private documents around it.
 */
export function DocumentUploader({ role, type, document: attached, editable, error, onChanged }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"uploading" | "removing" | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const id = `doc-${type.code}`;
  const isLogo = type.code === LOGO_DOCUMENT;

  async function upload(file: File) {
    const problem = problemWith(file, isLogo);
    if (problem) {
      setNotice({ tone: "alert", text: problem });
      return;
    }
    setBusy("uploading");
    setNotice({ tone: "status", text: `Uploading ${file.name}…` });
    const result = await uploadDocument(role, type.code, file);
    if (result.ok) {
      await onChanged();
      setNotice({ tone: "status", text: `${result.data.document.file_name} was uploaded.` });
    } else {
      const { failure } = result;
      setNotice({ tone: "alert", text: failure.fields?.file ?? failure.fields?.type ?? failure.message });
    }
    setBusy(null);
  }

  async function remove() {
    if (!attached) return;
    setBusy("removing");
    setNotice({ tone: "status", text: `Removing ${attached.file_name}…` });
    const result = await removeDocument(role, attached.id);
    if (result.ok) {
      await onChanged();
      setNotice({ tone: "status", text: `${attached.file_name} was removed.` });
    } else {
      setNotice({ tone: "alert", text: result.failure.message });
    }
    setBusy(null);
  }

  // A "this is missing" problem from submitting no longer applies once a file is attached.
  const problem = notice?.tone === "alert" ? notice.text : attached ? undefined : error;

  return (
    <li
      aria-labelledby={`${id}-label`}
      className={`rounded-lg border bg-surface p-4 ${problem ? "border-danger" : "border-line"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-56">
          <h3 id={`${id}-label`} className="font-sans text-base font-semibold tracking-normal text-ink">
            {type.label}
            {!type.required && <span className="ml-1 font-normal text-subtle">(optional)</span>}
          </h3>
          <p id={`${id}-description`} className="mt-1 text-sm leading-relaxed text-muted">
            {type.description}
          </p>
        </div>
        {attached ? (
          <Badge tone="success">
            <CircleCheck className="size-3.5" aria-hidden="true" />
            Attached
          </Badge>
        ) : (
          <Badge>{type.required ? "Needed" : "Not attached"}</Badge>
        )}
      </div>

      {isLogo && (
        <p className="mt-3 flex items-start gap-2 rounded-md bg-warning-soft p-3 text-sm leading-relaxed text-ink">
          <Eye className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <span>
            <span className="font-semibold">This one is public.</span> Once your application is approved it is shown on
            your profile and beside your name on your listings. Your other documents stay private.
          </span>
        </p>
      )}
      {isLogo && attached && (
        <PrivateImage
          src={documentUrl(role, attached.id)}
          alt={`The logo you uploaded, ${attached.file_name}`}
          className="mt-3 size-24"
        />
      )}

      {attached && (
        <p className="mt-3 flex items-start gap-2 text-sm text-ink">
          <FileText className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
          <span className="min-w-0">
            <span className="break-all font-medium">{attached.file_name}</span>
            <span className="text-muted"> · {formatFileSize(attached.size_bytes)}</span>
          </span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {editable && (
          <>
            {/* The file input is driven by the button, which is the labelled, focusable control. */}
            <input
              ref={input}
              type="file"
              accept={isLogo ? LOGO_ACCEPT : DOCUMENT_ACCEPT}
              tabIndex={-1}
              aria-hidden="true"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                // Clear the input so choosing the same file again still fires.
                event.target.value = "";
                if (file) void upload(file);
              }}
            />
            <Button
              id={`${id}-upload`}
              variant={attached ? "secondary" : "primary"}
              disabled={busy !== null}
              aria-busy={busy === "uploading"}
              aria-describedby={`${id}-label ${id}-description ${id}-notice`}
              onClick={() => input.current?.click()}
            >
              <Upload className="size-4" aria-hidden="true" />
              {busy === "uploading" ? "Uploading…" : attached ? "Replace" : "Choose a file"}
            </Button>
          </>
        )}
        {attached && (
          <a
            href={documentUrl(role, attached.id)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses("secondary")}
          >
            Open
            <span className="sr-only">
              {" "}
              {attached.file_name} (downloads in a new tab)
            </span>
          </a>
        )}
        {editable && attached && (
          <Button variant="ghost" disabled={busy !== null} aria-busy={busy === "removing"} onClick={remove}>
            {busy === "removing" ? "Removing…" : "Remove"}
            <span className="sr-only"> {attached.file_name}</span>
          </Button>
        )}
      </div>

      {/* One live region per row: progress and results are announced, problems interrupt. */}
      <div id={`${id}-notice`} className="mt-2 text-sm">
        <p role="status" className="text-muted">
          {problem ? "" : (notice?.text ?? (editable && !attached ? (isLogo ? LOGO_FORMATS_NOTE : "PDF, JPEG or PNG, up to 10 MB.") : ""))}
        </p>
        <p role="alert" className="text-danger">
          {problem ?? ""}
        </p>
      </div>
    </li>
  );
}

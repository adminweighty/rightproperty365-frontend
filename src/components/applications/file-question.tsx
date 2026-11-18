"use client";

import { FileText, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ownFileUrl, uploadApplicationFile, type ApplicationFile } from "@/lib/api/applications";
import { cn } from "@/lib/cn";
import {
  acceptAttribute,
  acceptedTypesText,
  fileProblem,
  fileSizeText,
  maxFilesFor,
  type FormField,
} from "@/lib/questionnaires";

/*
 * A file question on the apply page: the files attached, and "Choose files"
 * to add more. Files are checked before anything is sent (type and size);
 * the rest upload one by one with a progress bar each, as the listing photos
 * do. The API sniffs the content again and its message is what is shown.
 * An uploaded file is attached to the answer at once and saved.
 */

type Row = { name: string; size: number; status: "waiting" | "uploading" | "failed"; progress: number; problem?: string };

type Props = {
  field: FormField;
  applicationId: string;
  /** The file ids of the answer. */
  value: string[];
  /** What the API says about each file, and what this page uploaded. */
  known: ApplicationFile[];
  disabled?: boolean;
  describedBy?: string;
  onAttached: (file: ApplicationFile) => void;
  /** Resolves to null when removed, or the reason it was not. */
  onRemove: (fileId: string) => Promise<string | null>;
};

export function FileQuestion({ field, applicationId, value, known, disabled, describedBy, onAttached, onRemove }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [announce, setAnnounce] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const most = maxFilesFor(field);
  const left = Math.max(0, most - value.length);
  const busy = rows.some((row) => row.status === "uploading" || row.status === "waiting");
  const id = `file-${field.key}`;

  async function upload(chosen: File[]) {
    const room = Math.max(0, most - value.length);
    const queue: Row[] = chosen.map((file, index) => {
      if (index >= room) return { name: file.name, size: file.size, status: "failed", progress: 0, problem: most === 1 ? "Only one file can be attached. Remove the one attached to add another." : `At most ${most} files can be attached.` };
      const problem = fileProblem(file, field);
      return problem ? { name: file.name, size: file.size, status: "failed", progress: 0, problem } : { name: file.name, size: file.size, status: "waiting", progress: 0 };
    });
    setRows(queue);
    for (let index = 0; index < chosen.length; index += 1) {
      if (queue[index].status !== "waiting") continue;
      const file = chosen[index];
      setRows((current) => current.map((row, i) => (i === index ? { ...row, status: "uploading" } : row)));
      setAnnounce(`Uploading ${file.name}…`);
      const result = await uploadApplicationFile(applicationId, field.key, file, (fraction) =>
        setRows((current) => current.map((row, i) => (i === index ? { ...row, progress: fraction } : row))),
      );
      if (result.ok) {
        onAttached(
          result.data.file ?? { id: result.data.file_id, field: field.key, file_name: file.name, size_bytes: file.size, content_type: file.type || null, uploaded_at: new Date().toISOString() },
        );
        setAnnounce(`${file.name} was added.`);
        setRows((current) => current.map((row, i) => (i === index ? { ...row, status: "waiting", progress: -1 } : row)));
      } else {
        setAnnounce(`${file.name} was not added. ${result.failure.message}`);
        setRows((current) => current.map((row, i) => (i === index ? { ...row, status: "failed", problem: result.failure.message } : row)));
      }
    }
    // Done rows (progress -1) leave the list: the file is now in the attached list.
    setRows((current) => current.filter((row) => !(row.status === "waiting" && row.progress === -1)));
  }

  const attached = value.map((fileId, index) => known.find((file) => file.id === fileId) ?? { id: fileId, field: field.key, file_name: `File ${index + 1}`, size_bytes: null, content_type: null, uploaded_at: null });
  const failed = rows.some((row) => row.status === "failed");

  return (
    <div className={cn("rounded-lg border p-4", failed ? "border-danger" : "border-line")}>
      <p className="text-sm text-muted" id={`${id}-rules`}>
        {acceptedTypesText(field)}, up to 10 MB each. {most === 1 ? "One file." : `Up to ${most} files.`} Only the advertiser&rsquo;s team can open them.
      </p>
      {attached.length > 0 && (
        <ul className="mt-3 grid gap-2" aria-label={`Files attached to ${field.label}`}>
          {attached.map((file) => (
            <li key={file.id} className="flex flex-wrap items-center gap-2 rounded-md bg-soft p-2 text-sm">
              <FileText className="size-4 shrink-0 text-muted" aria-hidden="true" />
              <a href={ownFileUrl(applicationId, file.id)} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 break-all font-medium text-primary-ink hover:underline">
                {file.file_name}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              {file.size_bytes !== null && <span className="text-muted">{fileSizeText(file.size_bytes)}</span>}
              {!disabled && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy || removing !== null}
                  aria-busy={removing === file.id || undefined}
                  onClick={async () => {
                    setRemoving(file.id);
                    const problem = await onRemove(file.id);
                    setRemoving(null);
                    setAnnounce(problem ? `${file.file_name} was not removed. ${problem}` : `${file.file_name} was removed.`);
                  }}
                >
                  {removing === file.id ? "Removing…" : "Remove"}
                  <span className="sr-only"> {file.file_name}</span>
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {rows.length > 0 && (
        <ul className="mt-3 grid gap-2">
          {rows.map((row, index) => (
            <li key={`${row.name}-${index}`} className={cn("rounded-md border p-2 text-sm", row.status === "failed" ? "border-danger" : "border-line")}>
              <p className="flex flex-wrap justify-between gap-2">
                <span className="break-all font-medium text-ink">{row.name}</span>
                <span className={row.status === "failed" ? "text-danger" : "text-muted"}>
                  {row.status === "waiting" ? "Waiting" : row.status === "uploading" ? `Uploading… ${Math.round(row.progress * 100)}%` : "Not added"}
                </span>
              </p>
              {row.status === "uploading" && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
                  <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.round(row.progress * 100)}%` }} />
                </div>
              )}
              {row.problem && <p className="mt-1 text-danger">{row.problem}</p>}
            </li>
          ))}
        </ul>
      )}
      {!disabled && (
        <div className="mt-3">
          <input
            ref={input}
            type="file"
            multiple={most > 1}
            accept={acceptAttribute(field)}
            tabIndex={-1}
            aria-hidden="true"
            className="sr-only"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (files.length > 0) void upload(files);
            }}
          />
          <Button
            id={`${id}-choose`}
            variant={attached.length > 0 ? "secondary" : "primary"}
            disabled={busy || left === 0}
            aria-busy={busy || undefined}
            aria-describedby={[describedBy, `${id}-rules`].filter(Boolean).join(" ")}
            onClick={() => input.current?.click()}
          >
            <Upload className="size-4" aria-hidden="true" />
            {busy ? "Uploading…" : most > 1 ? "Choose files" : "Choose a file"}
            <span className="sr-only"> for {field.label}</span>
          </Button>
          {left === 0 && <p className="mt-2 text-sm text-muted">{most === 1 ? "Remove the file to attach a different one." : "The most files are attached. Remove one to add another."}</p>}
        </div>
      )}
      <p role="status" className="sr-only">
        {announce}
      </p>
    </div>
  );
}

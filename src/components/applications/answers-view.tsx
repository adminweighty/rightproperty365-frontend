"use client";

import { EyeOff, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScanNote } from "@/components/ui/scan-status";
import type { ApplicationFile } from "@/lib/api/applications";
import {
  allFields,
  answerText,
  fileSizeText,
  visibleIfValues,
  visibleKeys,
  type Answers,
  type FormField,
  type FormSection,
} from "@/lib/questionnaires";
import { isFileOpenable } from "@/lib/file-scan";

/*
 * The answers of an application in the layout of the form version it was
 * made on: the same sections, questions and wording, never today's version.
 * Questions that were not shown to the applicant (their condition was not
 * met) have no answer; the organisation's view lists them apart so nobody
 * mistakes a hidden question for a skipped one.
 */

type Props = {
  sections: FormSection[];
  answers: Answers;
  files: ApplicationFile[];
  /** The address a file opens at, or null when files cannot be opened here. */
  fileHref: (fileId: string) => string | null;
  /** The organisation's view: list the questions that were not shown. */
  showHidden?: boolean;
  headingLevel?: 2 | 3;
  idPrefix: string;
};

function conditionText(field: FormField, fields: FormField[]): string {
  const rule = field.visible_if;
  if (!rule) return "";
  const source = fields.find((item) => item.key === rule.field);
  const values = visibleIfValues(rule).map((value) => source?.options?.find((option) => option.value === value)?.label ?? value);
  return `Asked only when “${source?.label || rule.field}” is ${values.join(" or ")}.`;
}

function FileList({ field, value, files, fileHref }: { field: FormField; value: unknown; files: ApplicationFile[]; fileHref: Props["fileHref"] }) {
  const ids = Array.isArray(value) ? value.map(String) : typeof value === "string" ? [value] : [];
  const attached = files.filter((file) => file.field === field.key || ids.includes(file.id));
  const listed = attached.length > 0 ? attached : ids.map((id, index): ApplicationFile => ({ id, field: field.key, file_name: `File ${index + 1}`, size_bytes: null, content_type: null, uploaded_at: null }));
  if (listed.length === 0) return <dd className="mt-1 text-muted">No file attached</dd>;
  return (
    <dd className="mt-1">
      <ul className="grid gap-2">
        {listed.map((file) => {
          // A file being checked for viruses, or removed by the check, cannot be opened.
          const href = !isFileOpenable(file.scan_status) ? null : fileHref(file.id);
          return (
            <li key={file.id} className="flex flex-wrap items-center gap-2 text-sm">
              <FileText className="size-4 shrink-0 text-muted" aria-hidden="true" />
              {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center break-all font-medium text-primary-ink hover:underline">
                  {file.file_name}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : (
                <span className="break-all font-medium text-ink">{file.file_name}</span>
              )}
              {file.size_bytes !== null && <span className="text-muted">{fileSizeText(file.size_bytes)}</span>}
              <ScanNote status={file.scan_status} className="basis-full" />
            </li>
          );
        })}
      </ul>
    </dd>
  );
}

export function AnswersView({ sections, answers, files, fileHref, showHidden = false, headingLevel = 2, idPrefix }: Props) {
  const shown = visibleKeys({ sections }, answers);
  const fields = allFields({ sections });
  const hidden = fields.filter((field) => !shown.has(field.key));
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <div className="grid gap-6">
      {sections.map((section, index) => {
        const asked = section.fields.filter((field) => shown.has(field.key));
        if (asked.length === 0) return null;
        const headingId = `${idPrefix}-answers-${index}`;
        return (
          <section key={`${section.key}-${index}`} aria-labelledby={headingId}>
            <Card>
              <Heading id={headingId} className={headingLevel === 2 ? "text-2xl" : "text-xl"}>
                {section.title || `Section ${index + 1}`}
              </Heading>
              <dl className="mt-4 grid gap-4">
                {asked.map((field) => {
                  const value = answers[field.key];
                  const text = answerText(field, value);
                  return (
                    <div key={field.key} className="border-t border-line pt-3 first:border-t-0 first:pt-0">
                      <dt className="text-sm font-medium text-muted">{field.label || field.key}</dt>
                      {field.type === "file" ? (
                        <FileList field={field} value={value} files={files} fileHref={fileHref} />
                      ) : (
                        <dd className={text ? "mt-1 whitespace-pre-line break-words text-ink" : "mt-1 text-muted"}>{text || "Not answered"}</dd>
                      )}
                    </div>
                  );
                })}
              </dl>
            </Card>
          </section>
        );
      })}
      {showHidden && hidden.length > 0 && (
        <details className="rounded-lg border border-dashed border-line-strong p-4">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-medium text-ink">
            <EyeOff className="size-4 text-muted" aria-hidden="true" />
            {hidden.length === 1 ? "1 question was not asked" : `${hidden.length} questions were not asked`}
          </summary>
          <p className="mt-2 text-sm text-muted">
            Their condition was not met by the applicant&rsquo;s answers, so they were not shown and any answer was dropped
            when the application was sent.
          </p>
          <ul className="mt-3 grid gap-2">
            {hidden.map((field) => (
              <li key={field.key} className="text-sm">
                <span className="font-medium text-ink">{field.label || field.key}</span>
                <span className="block text-muted">{conditionText(field, fields)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

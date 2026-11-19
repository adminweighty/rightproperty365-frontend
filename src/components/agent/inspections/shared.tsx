"use client";

import { Download } from "lucide-react";
import { useCallback, useState } from "react";
import { saveBlob } from "@/components/agent/books/shared";
import { formatWhen } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PrivateImage } from "@/components/ui/private-image";
import type { ApiResult } from "@/lib/api/http";
import { getInspectionOptions, inspectionPhotoSrc } from "@/lib/api/inspections";
import {
  findingTone,
  findingWords,
  FINDING_STATUSES,
  inspectionStatusLabel,
  inspectionStatusTone,
  inspectionTypeLabel,
  normaliseInspectionOptions,
  progressWords,
  reportFileName,
  type Baseline,
  type Checklist,
  type FindingStatus,
  type Inspection,
  type InspectionOptions,
  type ItemPhoto,
} from "@/lib/inspections";
import { fileNameFrom } from "@/lib/ledger";

/*
 * Pieces shared by the team's inspection pages (`/agent/inspections/*`, the
 * tenancy page's Inspections section) and the tenant's
 * (`/account/tenancies/<id>`): the status, type and finding badges, the
 * options, the scheduled time in words, the progress bar, the read-only
 * checklist of a completed inspection and the report download.
 */

export const sectionHeading = "font-sans text-xl font-semibold tracking-normal";

export function InspectionStatusBadge({ status, label }: { status: string; label?: string | null }) {
  return <Badge tone={inspectionStatusTone(status)}>{inspectionStatusLabel(status, label)}</Badge>;
}

export function InspectionTypeBadge({ type, label }: { type: string; label?: string | null }) {
  return (
    <Badge tone="primary">
      <span className="sr-only">Type: </span>
      {inspectionTypeLabel(type, label)}
    </Badge>
  );
}

/** The finding in words (never colour alone): the API's label when it sends one. */
export function FindingBadge({ status, label }: { status: string; label?: string | null }) {
  return <Badge tone={findingTone(status)}>{label || findingWords(status)}</Badge>;
}

/** On a move-out: "At move-in: Needs attention. Cold tap drips slightly." */
export function BaselineLine({ baseline }: { baseline: Baseline | null }) {
  if (!baseline) return null;
  return (
    <p className="mt-1 text-sm break-words text-muted">
      <span className="font-medium">At move-in:</span> {baseline.label || findingWords(baseline.status)}
      {baseline.note && <>. {baseline.note}</>}
    </p>
  );
}

/** "Tue 1 Dec 2026, 09:30" in the viewer's own time zone. */
export function scheduledWords(iso: string | null): string {
  if (!iso) return "No time set";
  const at = new Date(iso);
  return Number.isNaN(at.getTime())
    ? iso
    : new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(at);
}

const FALLBACK = normaliseInspectionOptions(null);

/** Types, statuses, checklist templates and photo rules of the book; the defaults until (or when) the API answers otherwise. */
export function useInspectionOptions(org: string): InspectionOptions & { loaded: boolean } {
  const load = useCallback(async (): Promise<ApiResult<InspectionOptions>> => {
    const answer = await getInspectionOptions(org);
    return answer.ok ? answer : { ok: true, status: 200, data: FALLBACK };
  }, [org]);
  const { state } = useApi(load);
  return state.status === "ready" ? { ...state.data, loaded: true } : { ...FALLBACK, loaded: false };
}

/** "12 of 30 items checked" with a bar; the counts per finding underneath. */
export function ProgressMeter({ done, total, counts, id }: { done: number; total: number; counts?: Partial<Record<FindingStatus, number>> | null; id: string }) {
  const words = progressWords(done, total);
  return (
    <div>
      <p id={id} className="text-sm font-medium text-ink tabular-nums">
        {words}
      </p>
      <progress className="mt-1 h-2 w-full accent-primary" max={Math.max(total, 1)} value={done} aria-labelledby={id} />
      {counts && total > 0 && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Findings so far">
          {FINDING_STATUSES.map((status) => (
            <li key={status} className="tabular-nums">
              {findingWords(status)}: {counts[status] ?? 0}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The photos of one item, read with the session (private storage, re-encoded without metadata). */
export function ItemPhotos({ photos, label }: { photos: ItemPhoto[]; label: string }) {
  if (photos.length === 0) return null;
  return (
    <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={`Photos of ${label}`}>
      {photos.map((photo, index) => {
        const src = inspectionPhotoSrc(photo.url);
        return (
          <li key={photo.id} className="min-w-0">
            {src ? (
              <a href={src} target="_blank" rel="noopener noreferrer" className="block min-h-11 rounded-md" aria-label={`Open photo ${index + 1} of ${label} in a new tab`}>
                <PrivateImage src={src} alt={`Photo ${index + 1} of ${label}`} className="aspect-[4/3] w-full" />
              </a>
            ) : (
              <span className="block p-2 text-xs text-muted">Photo {index + 1}</span>
            )}
            {photo.uploadedAt && <p className="mt-1 text-xs text-muted">{formatWhen(photo.uploadedAt)}</p>}
          </li>
        );
      })}
    </ul>
  );
}

/** A completed (frozen) inspection's checklist: each area, its items with their finding, note and photos. */
export function ReadOnlyChecklist({ checklist }: { checklist: Checklist }) {
  if (checklist.length === 0) return <p className="text-sm text-muted">The checklist has no items.</p>;
  return (
    <div className="grid gap-6">
      {checklist.map((area) => (
        <section key={area.key} aria-labelledby={`area-${area.key}`}>
          <h3 id={`area-${area.key}`} className="font-sans text-lg font-semibold tracking-normal break-words">
            {area.name || "Unnamed area"}
          </h3>
          {area.items.length === 0 ? (
            <p className="mt-1 text-sm text-muted">No items.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line rounded-md border border-line">
              {area.items.map((item) => (
                <li key={item.key} className="p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 font-medium break-words text-ink">{item.label || "Unnamed item"}</p>
                    <FindingBadge status={item.status} />
                  </div>
                  {item.note && <p className="mt-1 text-sm whitespace-pre-line break-words text-ink">{item.note}</p>}
                  <BaselineLine baseline={item.baseline} />
                  <ItemPhotos photos={item.photos} label={`${area.name} – ${item.label}`} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

/** The summary and sign-off of a completed inspection. */
export function CompletionSummary({ inspection }: { inspection: Inspection }) {
  const progress = inspection.progress;
  return (
    <div className="grid gap-3 text-sm">
      <p className="text-ink">
        Completed{inspection.completedAt && <> on <time dateTime={inspection.completedAt}>{formatWhen(inspection.completedAt)}</time></>}
        {inspection.completedBy && ` by ${inspection.completedBy}`}.
      </p>
      {progress && progress.total > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-muted" aria-label="Findings">
          {FINDING_STATUSES.map((status) => (
            <li key={status} className="tabular-nums">
              {findingWords(status)}: {progress.counts[status]}
            </li>
          ))}
        </ul>
      )}
      {inspection.baseline?.reference && <p className="text-muted">Compared with the move-in inspection {inspection.baseline.reference}.</p>}
      {inspection.summary && <p className="whitespace-pre-line break-words text-ink">{inspection.summary}</p>}
      <dl className="grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-x-4">
        <dt className="text-muted">Signed off for the manager by</dt>
        <dd className="break-words text-ink">{inspection.signOff.agent ?? "No name given"}</dd>
        <dt className="text-muted">Signed off by the tenant</dt>
        <dd className="break-words text-ink">{inspection.signOff.tenant ?? "No name given"}</dd>
      </dl>
    </div>
  );
}

/** "Download report (PDF)": the API renders it; the file is saved under the API's name. */
export function ReportDownload({
  inspection,
  download,
  variant = "secondary",
}: {
  inspection: Pick<Inspection, "id" | "reference">;
  download: () => Promise<ApiResult<{ blob: Blob; headers: Headers }>>;
  variant?: "primary" | "secondary";
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string; traceId?: string } | null>(null);

  async function get() {
    setBusy(true);
    setNotice(null);
    const answer = await download();
    setBusy(false);
    if (!answer.ok) {
      setNotice({ tone: "danger", text: answer.failure.message, traceId: answer.failure.traceId });
      return;
    }
    const name = fileNameFrom(answer.data.headers.get("Content-Disposition"), reportFileName(inspection));
    saveBlob(answer.data.blob, name);
    setNotice({ tone: "success", text: `Downloaded ${name}.` });
  }

  return (
    <div>
      <Button variant={variant} onClick={() => void get()} disabled={busy} aria-busy={busy}>
        <Download className="size-4" aria-hidden="true" />
        {busy ? "Preparing the report…" : "Download report (PDF)"}
      </Button>
      <div aria-live="polite" className="mt-2">
        {notice && <Alert tone={notice.tone} title={notice.text} traceId={notice.traceId} />}
      </div>
    </div>
  );
}

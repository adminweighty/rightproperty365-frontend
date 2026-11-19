"use client";

import { CalendarPlus } from "lucide-react";
import { useId, useState } from "react";
import { saveBlob } from "@/components/agent/books/shared";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { apiFetchFile } from "@/lib/api/http";
import { CALENDAR_NOTE, calendarFileName, calendarPath, showCalendarLink, type CalendarSource } from "@/lib/calendar";
import { fileNameFrom } from "@/lib/ledger";

type Props = {
  source: CalendarSource;
  /** Names the fallback file: `appointment-<REF>.ics` or `venue-booking-<REF>.ics`. */
  fileKind: "appointment" | "venue-booking";
  reference: string;
  status: string;
  start: string | null;
  end: string | null;
};

/**
 * "Add to calendar (.ics)" on a confirmed appointment or hourly booking that
 * has not ended. The file is read with the session cookie, like the rent
 * statement and the report PDFs, then saved; nothing is shown otherwise.
 */
export function AddToCalendar({ source, fileKind, reference, status, start, end }: Props) {
  const [now] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string; traceId?: string } | null>(null);
  const noteId = useId();

  if (!showCalendarLink({ status, start, end }, now)) return null;

  async function download() {
    setBusy(true);
    setNotice(null);
    const answer = await apiFetchFile(calendarPath(source));
    setBusy(false);
    if (!answer.ok) {
      setNotice({ tone: "danger", text: answer.failure.message, traceId: answer.failure.traceId });
      return;
    }
    const name = fileNameFrom(answer.data.headers.get("Content-Disposition"), calendarFileName(fileKind, reference));
    saveBlob(answer.data.blob, name);
    setNotice({ tone: "success", text: `Downloaded ${name}. Open it to add the time to your calendar.` });
  }

  return (
    <div className="mt-4">
      <Button variant="secondary" onClick={() => void download()} disabled={busy} aria-busy={busy || undefined} aria-describedby={noteId}>
        <CalendarPlus className="size-4" aria-hidden="true" />
        {busy ? "Preparing the file…" : "Add to calendar (.ics)"}
      </Button>
      <p id={noteId} className="mt-1 text-xs text-muted">
        {CALENDAR_NOTE}
      </p>
      <div aria-live="polite">{notice && <Alert tone={notice.tone} title={notice.text} traceId={notice.traceId} className="mt-2" />}</div>
    </div>
  );
}

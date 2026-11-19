"use client";

import { ShieldAlert, ShieldEllipsis } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  isFileOpenable,
  SCAN_POLL_INTERVAL_MS,
  scanNotice,
  shouldPollScans,
  type ScanStatus,
} from "@/lib/file-scan";

/*
 * A document's malware scan (API 0.41.0) where the document is listed. With
 * scanning off, or a clean or never-scanned file, every piece here renders
 * nothing and the file's own controls show as before.
 */

/** The badge only: "Being checked for viruses" or "Removed: this file looked unsafe". */
export function ScanBadge({ status }: { status: ScanStatus | null | undefined }) {
  const notice = scanNotice(status);
  if (!notice) return null;
  const Icon = notice.kind === "pending" ? ShieldEllipsis : ShieldAlert;
  return (
    <Badge tone={notice.kind === "pending" ? "warning" : "danger"}>
      <Icon className="size-3.5" aria-hidden="true" />
      {notice.label}
    </Badge>
  );
}

/** The badge with one or two sentences on what it means and what to do. */
export function ScanNote({
  status,
  canReplace = false,
  id,
  className,
}: {
  status: ScanStatus | null | undefined;
  /** The viewer can upload a clean copy here. */
  canReplace?: boolean;
  /** For `aria-describedby` on a control the status disables. */
  id?: string;
  className?: string;
}) {
  const notice = scanNotice(status, canReplace);
  if (!notice) return null;
  return (
    <div id={id} className={cn("flex flex-col items-start gap-1 text-sm", className)}>
      <ScanBadge status={status} />
      <p className={notice.kind === "infected" ? "text-danger" : "text-muted"}>{notice.text}</p>
    </div>
  );
}

/**
 * The file's own "Open" or "Download" control when it can be opened; a
 * disabled one, described by the note, while it is checked; nothing once it
 * was removed.
 */
export function ScanGuard({
  status,
  label,
  describedBy,
  size,
  children,
}: {
  status: ScanStatus | null | undefined;
  /** The disabled button's words ("Open", "Download"). */
  label: ReactNode;
  /** The id of the `ScanNote` that explains why. */
  describedBy?: string;
  size?: "sm" | "md";
  children: ReactNode;
}) {
  if (isFileOpenable(status)) return <>{children}</>;
  if (status === "INFECTED") return null;
  return (
    <Button variant="secondary" size={size} disabled aria-describedby={describedBy}>
      {label}
    </Button>
  );
}

/**
 * Calls `refresh` every 12 seconds while any status is PENDING, and stops once
 * none is, after ten minutes (the scanner may be down), or when the page is
 * left. A hidden tab skips its turns. `refresh` should read quietly: keep what
 * is on screen and replace it with the answer.
 */
export function useScanPolling(statuses: readonly (ScanStatus | null | undefined)[], refresh: () => unknown) {
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  });

  const active = shouldPollScans(statuses);
  useEffect(() => {
    if (!active) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      // Still pending (or this effect would have ended): only the time limit stops it here.
      if (!shouldPollScans(["PENDING"], Date.now() - started)) {
        window.clearInterval(timer);
        return;
      }
      if (document.visibilityState === "visible") void latest.current();
    }, SCAN_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [active]);
}

"use client";

import { RefreshCw, ShieldAlert, ShieldCheck, ShieldOff } from "lucide-react";
import type { ReactNode } from "react";
import { RoleGate } from "@/components/admin/admin-gate";
import { BackLink, formatWhen, LoadError, LoadingBlock, StatTile } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getFileScans } from "@/lib/api/admin";
import { FILE_SCAN_ROLES } from "@/lib/api/auth";
import {
  formatCount,
  formatScanBytes,
  pendingAge,
  PENDING_ALERT_MINUTES,
  scanKindLabel,
  scannerIsOff,
  scannerName,
  type FileScanItem,
  type FileScanReport,
} from "@/lib/file-scan";

const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap text-muted";
const td = "px-3 py-2 align-top text-sm text-ink";
const tdNum = "px-3 py-2 align-top text-right text-sm tabular-nums whitespace-nowrap text-ink";

const when = (iso: string | null) => (iso ? <time dateTime={iso}>{formatWhen(iso)}</time> : <span className="text-subtle">–</span>);

/** A table that scrolls sideways inside its own box at 320px; the page never does. */
function TableRegion({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="mt-4 overflow-x-auto rounded-lg border border-line bg-surface">
      {children}
    </div>
  );
}

function Section({ id, title, intro, children }: { id: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-2xl">
        {title}
      </h2>
      {intro && <p className="mt-1 max-w-3xl text-sm text-muted">{intro}</p>}
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="mt-4 rounded-lg border border-dashed border-line-strong p-6 text-center text-muted">{children}</p>;
}

function PendingTable({ items, showUploader }: { items: FileScanItem[]; showUploader: boolean }) {
  return (
    <TableRegion label="Files being checked">
      <table className="w-full min-w-[40rem] border-collapse">
        <thead className="border-b border-line">
          <tr>
            <th scope="col" className={th}>Kind</th>
            <th scope="col" className={`${th} text-right`}>Size</th>
            {showUploader && <th scope="col" className={th}>Uploaded by</th>}
            <th scope="col" className={th}>Uploaded</th>
            <th scope="col" className={`${th} text-right`}>Tries</th>
            <th scope="col" className={th}>Last problem</th>
            <th scope="col" className={th}>Next try</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((item) => (
            <tr key={item.id}>
              <td className={td}>{scanKindLabel(item.kind)}</td>
              <td className={tdNum}>{formatScanBytes(item.sizeBytes)}</td>
              {showUploader && <td className={td}>{item.uploadedBy ?? <span className="text-subtle">–</span>}</td>}
              <td className={`${td} whitespace-nowrap`}>{when(item.uploadedAt)}</td>
              <td className={tdNum}>{formatCount(item.attempts)}</td>
              <td className={`${td} break-words`}>{item.lastError ?? <span className="text-subtle">None</span>}</td>
              <td className={`${td} whitespace-nowrap`}>{when(item.nextAttemptAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableRegion>
  );
}

function InfectedTable({ items, showUploader }: { items: FileScanItem[]; showUploader: boolean }) {
  return (
    <TableRegion label="Files removed as unsafe">
      <table className="w-full min-w-[36rem] border-collapse">
        <thead className="border-b border-line">
          <tr>
            <th scope="col" className={th}>Kind</th>
            <th scope="col" className={`${th} text-right`}>Size</th>
            {showUploader && <th scope="col" className={th}>Uploaded by</th>}
            <th scope="col" className={th}>Uploaded</th>
            <th scope="col" className={th}>Found</th>
            <th scope="col" className={th}>Signature</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((item) => (
            <tr key={item.id}>
              <td className={td}>{scanKindLabel(item.kind)}</td>
              <td className={tdNum}>{formatScanBytes(item.sizeBytes)}</td>
              {showUploader && <td className={td}>{item.uploadedBy ?? <span className="text-subtle">–</span>}</td>}
              <td className={`${td} whitespace-nowrap`}>{when(item.uploadedAt)}</td>
              <td className={`${td} whitespace-nowrap`}>{when(item.scannedAt)}</td>
              <td className={`${td} break-all font-mono text-xs`}>{item.signature ?? <span className="font-sans text-subtle">Not given</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableRegion>
  );
}

function Report({ report }: { report: FileScanReport & { fetchedAt: number } }) {
  const off = scannerIsOff(report);
  const age = pendingAge(report.oldestPendingAt, report.fetchedAt);
  // The 0.41.0 answer names no uploader; the column appears if a later one does.
  const showUploader = [...report.pending, ...report.infected].some((item) => item.uploadedBy !== null);
  const anyCounted = Object.values(report.counts).some((value) => value > 0);

  return (
    <div className="space-y-10">
      {off ? (
        <Card className="flex items-start gap-3">
          <ShieldOff className="mt-1 size-6 shrink-0 text-muted" aria-hidden="true" />
          <div>
            <h2 className="text-2xl">Scanning is off</h2>
            <p className="mt-2 max-w-2xl text-muted">
              This API server does not check uploads for viruses: its scanner is set to &ldquo;none&rdquo;. Photos, logos,
              signatures and documents are stored without a check, and documents show no scan status. Scanning is turned
              on in the server&rsquo;s settings (<code className="font-mono text-sm">MALWARE_SCANNER=clamav</code>).
            </p>
            {anyCounted && <p className="mt-2 text-sm text-muted">The figures below are from when it was on, or from the worker.</p>}
          </div>
        </Card>
      ) : (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <Badge tone="success">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Scanning is on
          </Badge>
          <span>Scanner: {scannerName(report.scanner)}</span>
        </p>
      )}

      <Section id="scan-counts" title="Documents by result" intro="Onboarding documents, application files, books attachments and uploaded agreement PDFs. Images are checked as they are uploaded and are not counted here.">
        <ul className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <li><StatTile label="Being checked" value={report.counts.PENDING} emphasis /></li>
          <li><StatTile label="Clean" value={report.counts.CLEAN} /></li>
          <li><StatTile label="Removed as unsafe" value={report.counts.INFECTED} emphasis /></li>
          <li><StatTile label="Uploaded before scanning" value={report.counts.LEGACY_UNSCANNED} /></li>
        </ul>
      </Section>

      <Section id="scan-oldest" title="Oldest file waiting">
        {age ? (
          age.alert ? (
            <Alert tone="warning" title={`The oldest file has waited ${age.text}.`} className="mt-3">
              Files are usually checked within seconds. After {PENDING_ALERT_MINUTES} minutes the scanner may be down or
              unreachable: check the worker&rsquo;s logs and the ClamAV service. Files stay waiting and are tried again
              until it answers.
            </Alert>
          ) : (
            <p className="mt-3 text-ink">
              <span className="text-3xl font-bold tabular-nums">{age.text}</span>
              <span className="mt-1 block text-sm text-muted">
                Waiting since {report.oldestPendingAt ? formatWhen(report.oldestPendingAt) : "–"}.
              </span>
            </p>
          )
        ) : (
          <p className="mt-3 text-muted">Nothing is waiting to be checked.</p>
        )}
      </Section>

      <Section id="scan-pending" title="Being checked" intro="The latest 50, newest first. No file names or owners are shown.">
        {report.pending.length === 0 ? <Empty>No file is being checked right now.</Empty> : <PendingTable items={report.pending} showUploader={showUploader} />}
      </Section>

      <Section
        id="scan-infected"
        title="Removed as unsafe"
        intro="The latest 50, most recent first. Each file was deleted when it failed the check, and its uploader was told to upload a clean copy."
      >
        {report.infected.length === 0 ? (
          <Empty>No file has failed the check.</Empty>
        ) : (
          <InfectedTable items={report.infected} showUploader={showUploader} />
        )}
      </Section>

      <Section id="scan-process" title="Images checked by this API server" intro="Since it last started. Documents are checked by the worker, whose figures are in its logs.">
        {report.processCounts.length === 0 ? (
          <Empty>No images have been checked since this server started.</Empty>
        ) : (
          <TableRegion label="Images checked by this API server">
            <table className="w-full min-w-[18rem] border-collapse">
              <thead className="border-b border-line">
                <tr>
                  <th scope="col" className={th}>Result</th>
                  <th scope="col" className={`${th} text-right`}>Files</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {report.processCounts.map((row) => (
                  <tr key={row.key}>
                    <td className={td}>
                      {row.key.endsWith(".INFECTED") && row.count > 0 && <ShieldAlert className="mr-1 inline size-4 text-danger" aria-hidden="true" />}
                      {row.label}
                    </td>
                    <td className={tdNum}>{formatCount(row.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableRegion>
        )}
      </Section>
    </div>
  );
}

function FileScansPage() {
  const { state, reload } = useApi(getFileScans);
  const data = state.status === "ready" ? state.data : state.status === "loading" ? state.previous : undefined;

  return (
    <>
      <BackLink href="/admin">Administration</BackLink>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-4xl">Upload scanning</h1>
        <Button variant="secondary" onClick={reload} disabled={state.status === "loading"} aria-busy={state.status === "loading" || undefined}>
          <RefreshCw className="size-4" aria-hidden="true" />
          {state.status === "loading" && data ? "Checking…" : "Check again"}
        </Button>
      </div>
      <p className="mt-2 max-w-3xl text-muted">
        Whether uploads are checked for viruses, and what the checks found. Images are refused on upload when unsafe;
        documents are checked just after upload and cannot be opened until they pass.
      </p>
      <p role="status" className="mt-1 text-sm text-subtle">
        {data ? `Figures as of ${formatWhen(new Date(data.fetchedAt).toISOString())}.` : ""}
      </p>

      <div className="mt-8">
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "loading" && !data && <LoadingBlock label="Loading the scanning figures" rows={3} />}
        {data && state.status !== "error" && <Report report={data} />}
      </div>
    </>
  );
}

/** `/admin/file-scans` (SUPER_ADMIN, PLATFORM_ADMIN). */
export function FileScans() {
  return (
    <RoleGate roles={FILE_SCAN_ROLES} what="upload scanning">
      {() => <FileScansPage />}
    </RoleGate>
  );
}

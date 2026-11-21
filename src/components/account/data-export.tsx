"use client";

import { Download, FileArchive } from "lucide-react";
import { useCallback, useState } from "react";
import { saveBlob } from "@/components/agent/books/shared";
import { RequireAuth } from "@/components/auth/require-auth";
import { BackLink, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch, apiFetchFile } from "@/lib/api/http";
import { fileNameFrom } from "@/lib/ledger";

/** Personal data export (API 0.55.0). */
type Export = {
  id: string;
  status: "REQUESTED" | "READY" | "FAILED" | "EXPIRED";
  requested_at: string;
  ready_at: string | null;
  expires_at: string | null;
  size_bytes: number;
  downloads: number;
};

function sizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function Page() {
  const load = useCallback(() => apiFetch<{ export: Export | null }>("/v1/me/data-export", { cache: "no-store" }), []);
  const { state, reload } = useApi(load);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string; traceId?: string } | null>(null);

  async function request() {
    setBusy(true);
    const answer = await apiFetch<{ export: Export }>("/v1/me/data-export", { method: "POST", body: {} });
    setBusy(false);
    if (answer.ok) {
      setNotice({ tone: "success", text: "We are preparing your data. We will email you when it is ready, usually within a few minutes." });
    } else if (answer.failure.code === "EXPORT_RECENT") {
      setNotice({ tone: "danger", text: "You asked for a copy in the last 24 hours. It is shown below." });
    } else {
      setNotice({ tone: "danger", text: answer.failure.message, traceId: answer.failure.traceId });
    }
    reload();
  }

  async function download() {
    setBusy(true);
    const answer = await apiFetchFile("/v1/me/data-export/download");
    setBusy(false);
    if (!answer.ok) {
      setNotice({ tone: "danger", text: answer.failure.message, traceId: answer.failure.traceId });
      return;
    }
    const name = fileNameFrom(answer.data.headers.get("Content-Disposition"), "rightproperty365-data.zip");
    saveBlob(answer.data.blob, name);
    setNotice({ tone: "success", text: `Downloaded ${name}.` });
    reload();
  }

  const e = state.status === "ready" ? state.data.export : null;
  return (
    <>
      <BackLink href="/account">Your account</BackLink>
      <h1 className="mt-1 text-4xl">Your data</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Get a copy of the data RightProperty365 keeps about you: your account, saved properties and searches, requests, appointments, applications, reviews and the
        emails we sent you. It comes as a ZIP of readable files. Other people&apos;s contact details are never included.
      </p>
      <div aria-live="polite" className="mt-4">
        {notice && <Alert tone={notice.tone} title={notice.text} traceId={notice.traceId} />}
      </div>
      <Card className="mt-6">
        {state.status === "loading" && <LoadingBlock label="Loading" rows={2} />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" && (
          <div className="space-y-4">
            <h2 className="flex items-center gap-2 text-xl">
              <FileArchive className="size-5 text-primary-ink" aria-hidden="true" />
              {!e ? "No copy yet" : e.status === "READY" ? "Your copy is ready" : e.status === "REQUESTED" ? "Being prepared" : e.status === "EXPIRED" ? "Your last copy has expired" : "We could not prepare your copy"}
            </h2>
            {e && (
              <p className="text-sm text-muted">
                Asked for {formatWhen(e.requested_at)}
                {e.status === "READY" && e.expires_at && <> · {sizeText(e.size_bytes)} · available until {formatWhen(e.expires_at)}</>}
                {e.status === "READY" && e.downloads > 0 && <> · downloaded {e.downloads === 1 ? "once" : `${e.downloads} times`}</>}
              </p>
            )}
            {e?.status === "REQUESTED" && <p className="text-ink">This usually takes a few minutes. We will email you when it is ready.</p>}
            {e?.status === "FAILED" && <p className="text-ink">Something went wrong on our side. Ask again; if it keeps failing, contact support.</p>}
            <div className="flex flex-wrap gap-3">
              {e?.status === "READY" && (
                <Button onClick={() => void download()} disabled={busy} aria-busy={busy}>
                  <Download className="size-4" aria-hidden="true" />
                  Download (.zip)
                </Button>
              )}
              {(!e || e.status !== "REQUESTED") && (
                <Button variant={e?.status === "READY" ? "secondary" : "primary"} onClick={() => void request()} disabled={busy} aria-busy={busy}>
                  {e ? "Ask for a new copy" : "Ask for a copy of my data"}
                </Button>
              )}
              {e?.status === "REQUESTED" && (
                <Button variant="secondary" onClick={reload}>
                  Check again
                </Button>
              )}
            </div>
            <p className="text-sm text-muted">One copy a day. A copy is kept for 7 days, then deleted. Only you can download it, signed in.</p>
          </div>
        )}
      </Card>
    </>
  );
}

/** `/account/data-export` (API 0.55.0). */
export function DataExport() {
  return <RequireAuth>{() => <Page />}</RequireAuth>;
}

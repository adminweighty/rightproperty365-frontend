"use client";

import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatRecoveryCode, RECOVERY_FILE_NAME, recoveryCodesText } from "@/lib/admin-mfa";

type Props = {
  codes: string[];
  /** The administrator's email address, written in the downloaded file. */
  account: string;
  /** "Your recovery codes" or "Your new recovery codes". */
  title: string;
  /** Leaves the codes once "I have saved them" is ticked. */
  onDone: () => void;
  doneLabel: string;
};

/**
 * The recovery codes, shown once. Copy and download (.txt), and a
 * confirmation before the codes can be left. Leaving the page before that
 * asks the browser's "leave this page?" question.
 */
export function RecoveryCodesPanel({ codes, account, title, onDone, doneLabel }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [checkError, setCheckError] = useState<string | undefined>();
  // Fixed when the codes are first shown, so the file says when they were made.
  const [createdAt] = useState(() => new Date());

  useEffect(() => {
    heading.current?.focus();
  }, []);

  useEffect(() => {
    if (saved) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saved]);

  const text = recoveryCodesText(codes, account, createdAt);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("The recovery codes are copied. Paste them somewhere safe and private.");
    } catch {
      setNotice("We could not copy the codes. Select them on the page, or download the file.");
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = RECOVERY_FILE_NAME;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(`Downloaded ${RECOVERY_FILE_NAME}. Keep it somewhere safe and private.`);
  }

  function done() {
    if (!saved) {
      setCheckError("Tick the box to confirm you have saved the codes.");
      document.getElementById("recovery-saved")?.focus();
      return;
    }
    onDone();
  }

  return (
    <section aria-labelledby="recovery-heading">
      <Card>
        <h2 id="recovery-heading" ref={heading} tabIndex={-1} className="text-2xl outline-none">
          {title}
        </h2>
        <Alert tone="warning" title="These codes are shown only this once." className="mt-3">
          <p>
            Each code signs you in once if you cannot use your authenticator app. Save them now, somewhere only you can reach,
            such as a password manager.
          </p>
        </Alert>

        <ol aria-label="Recovery codes" className="mt-4 grid grid-cols-1 gap-2 font-mono text-lg min-[360px]:grid-cols-2">
          {codes.map((code, index) => (
            <li key={code} className="rounded-md border border-line bg-soft px-3 py-2 tabular-nums text-ink">
              <span className="sr-only">Code {index + 1}: </span>
              {formatRecoveryCode(code)}
            </li>
          ))}
        </ol>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => void copy()}>
            Copy the codes
          </Button>
          <Button variant="secondary" onClick={download}>
            Download as a text file
          </Button>
        </div>

        <div aria-live="polite" role="status" className="mt-3 text-sm text-muted empty:mt-0">
          {notice}
        </div>

        <div className="mt-6 border-t border-line pt-4">
          <label htmlFor="recovery-saved" className="flex min-h-11 items-start gap-3 text-ink">
            <input
              id="recovery-saved"
              type="checkbox"
              checked={saved}
              onChange={(event) => {
                setSaved(event.target.checked);
                setCheckError(undefined);
              }}
              aria-invalid={Boolean(checkError)}
              aria-describedby={checkError ? "recovery-saved-error" : undefined}
              className="mt-1 size-5 shrink-0 accent-primary"
            />
            <span>I have saved my recovery codes somewhere safe.</span>
          </label>
          {checkError && (
            <p id="recovery-saved-error" className="mt-1 text-sm text-danger">
              {checkError}
            </p>
          )}
          <Button className="mt-4" onClick={done}>
            {doneLabel}
          </Button>
        </div>
      </Card>
    </section>
  );
}

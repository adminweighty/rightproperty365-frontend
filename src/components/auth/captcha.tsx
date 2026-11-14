"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { getCaptcha } from "@/lib/api/auth";
import { captchaLifetimeMs } from "@/lib/auth-validation";

export const CAPTCHA_HINT = "This quick question helps us keep automated sign-ups out.";

type Challenge = {
  id: string;
  question: string;
  /** When it stops being answerable, by this device's clock. */
  validUntil: number;
};

type State = {
  /** "loading" is the wait for the first question only. */
  status: "loading" | "ready" | "failed";
  /** A replacement question (or a retry) is on its way. */
  busy: boolean;
  challenge: Challenge | null;
  /** Why the question changed, for the live region. Null for the first question. */
  notice: { expired: boolean; question: string } | null;
};

/**
 * The state of the sign-up captcha, owned by the form so it can send the
 * answer and ask for a new question after a failed submit.
 *
 * The first question is loaded in the browser when the form mounts, never on
 * the server. A question is replaced when it expires, when the person asks,
 * and when the form calls `reload()`. The answer is cleared whenever the
 * question changes.
 */
export function useCaptcha() {
  const [state, setState] = useState<State>({ status: "loading", busy: false, challenge: null, notice: null });
  const [answer, setAnswer] = useState("");
  const latest = useRef(0);

  /** Asks for a question; resolves to null when a newer request has started, whose answer is the one to show. */
  const ask = useCallback(async () => {
    const request = ++latest.current;
    const result = await getCaptcha();
    return request === latest.current ? result : null;
  }, []);

  const receive = useCallback((result: Awaited<ReturnType<typeof getCaptcha>> | null, reason: "first" | "asked" | "expired") => {
    if (!result) return;
    setAnswer("");
    if (!result.ok || !result.data?.captcha_id || !result.data.question) {
      setState({ status: "failed", busy: false, challenge: null, notice: null });
      return;
    }
    const { captcha_id, question, expires_at } = result.data;
    setState({
      status: "ready",
      busy: false,
      challenge: { id: captcha_id, question, validUntil: Date.now() + captchaLifetimeMs(expires_at, Date.now()) },
      notice: reason === "first" ? null : { expired: reason === "expired", question },
    });
  }, []);

  const reload = useCallback(
    (reason: "asked" | "expired" = "asked") => {
      setState((current) => ({ ...current, busy: true }));
      setAnswer("");
      void ask().then((result) => receive(result, reason));
    },
    [ask, receive],
  );

  useEffect(() => {
    void ask().then((result) => receive(result, "first"));
  }, [ask, receive]);

  const challenge = state.challenge;
  useEffect(() => {
    if (!challenge) return;
    const timer = setTimeout(() => reload("expired"), Math.max(0, challenge.validUntil - Date.now()));
    return () => clearTimeout(timer);
  }, [challenge, reload]);

  /** True when the question shown can no longer be answered (a timer in a background tab can run late). */
  const isExpired = useCallback(() => Boolean(challenge && Date.now() >= challenge.validUntil), [challenge]);

  return { ...state, answer, setAnswer, reload, isExpired };
}

type Props = {
  captcha: ReturnType<typeof useCaptcha>;
  error?: string;
};

const ID = "captcha-answer";

/**
 * The site's own captcha on the create-account form: a sum as the label of a
 * short numeric input, with a "New question" button. If the question cannot
 * be loaded it says so and offers "Try again".
 */
export function Captcha({ captcha, error }: Props) {
  const { status, busy, challenge, notice, answer, setAnswer, reload } = captcha;

  if (status === "failed") {
    return (
      <div>
        <Alert title="We could not load the security question.">
          <p>You need to answer it to create an account. Check your connection and try again.</p>
          {/* Not disabled while it retries, so keyboard focus stays on it. */}
          <Button
            id="captcha-retry"
            variant="secondary"
            className="mt-3"
            aria-busy={busy}
            onClick={() => {
              if (!busy) reload();
            }}
          >
            {busy ? "Trying again…" : "Try again"}
          </Button>
        </Alert>
        {error && (
          <p id={`${ID}-error`} className="mt-1.5 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <Field id={ID} label={challenge ? challenge.question : "Loading a quick question…"} hint={CAPTCHA_HINT} error={error}>
        <div className="flex gap-2">
          <Input
            id={ID}
            name="captcha_answer"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            maxLength={9}
            className="w-28"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            disabled={!challenge}
            aria-invalid={Boolean(error)}
            aria-describedby={fieldDescribedBy(ID, { hint: CAPTCHA_HINT, error })}
          />
          <Button
            variant="secondary"
            disabled={!challenge}
            aria-busy={busy}
            onClick={() => {
              if (!busy) reload();
            }}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            New question
          </Button>
        </div>
      </Field>
      {/* Tells screen reader users the label changed; shown to everyone when the old question ran out of time. */}
      <p aria-live="polite" className={notice?.expired ? "mt-1.5 text-sm text-muted" : "sr-only"}>
        {notice &&
          (notice.expired
            ? `The last question ran out of time, so here is a new one: ${notice.question}`
            : `New question: ${notice.question}`)}
      </p>
    </div>
  );
}

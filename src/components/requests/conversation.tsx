"use client";

import { MessagesSquare } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { formatWhen } from "@/components/portal/portal-ui";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldDescribedBy, Textarea } from "@/components/ui/field";
import { MAX_REQUEST_MESSAGE_LENGTH, type RequestMessage } from "@/lib/api/agent";
import type { ApiResult } from "@/lib/api/http";
import { cn } from "@/lib/cn";
import {
  authorLabel,
  conversationErrorText,
  emptyConversationText,
  lengthHint,
  replyBlockedText,
  type ConversationSide,
} from "@/lib/request-conversation";

type Props<T> = {
  side: ConversationSide;
  messages: RequestMessage[];
  canReply: boolean;
  closed: boolean;
  /** Sends the message; the answer carries the request as it is now. */
  send: (body: string) => Promise<ApiResult<T>>;
  onSent: (data: T) => void;
  /** Text under the heading. */
  intro?: string;
  composerLabel?: string;
};

/**
 * The conversation on a property request (API 0.46.0): the messages, oldest
 * first, and a composer when the reader may write. Shared by the agent's
 * request page and the customer's. Private notes are never shown here.
 */
export function Conversation<T>({ side, messages, canReply, closed, send, onSent, intro, composerLabel }: Props<T>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [failure, setFailure] = useState<{ text: string; traceId?: string } | null>(null);
  const [sent, setSent] = useState(false);
  const [length, setLength] = useState(0);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const max = MAX_REQUEST_MESSAGE_LENGTH;
  const hint = lengthHint(length, max);
  const blocked = replyBlockedText(side, { canReply, closed, messageCount: messages.length });
  const fieldId = `conversation-${side}-body`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") ?? "").trim();
    setFailure(null);
    setSent(false);
    if (!body) {
      setError("Write your message first.");
      textarea.current?.focus();
      return;
    }
    if (body.length > max) {
      setError(`A message can be at most ${max} characters.`);
      textarea.current?.focus();
      return;
    }
    setError(undefined);
    setPending(true);
    const answer = await send(body);
    setPending(false);
    if (answer.ok) {
      form.reset();
      setLength(0);
      setSent(true);
      onSent(answer.data);
      return;
    }
    if (answer.failure.fields?.body) {
      setError(answer.failure.fields.body);
      textarea.current?.focus();
      return;
    }
    setFailure({ text: conversationErrorText(answer.failure.code, side) ?? answer.failure.message, traceId: answer.failure.traceId });
  }

  return (
    <section aria-labelledby={`conversation-${side}`}>
      <h2 id={`conversation-${side}`} className="flex items-center gap-2 text-xl">
        <MessagesSquare className="size-5 text-primary-ink" aria-hidden="true" />
        {side === "customer" ? "Conversation" : "Conversation with the customer"}
      </h2>
      {intro && <p className="mt-2 text-sm text-muted">{intro}</p>}
      {messages.length === 0 ? (
        <p className="mt-3 text-muted">{emptyConversationText(side)}</p>
      ) : (
        <ol className="mt-4 space-y-3" aria-label="Messages, oldest first">
          {messages.map((m) => (
            <li
              key={m.id}
              className={cn(
                "max-w-[90%] rounded-lg border p-3",
                m.mine ? "ml-auto border-primary/20 bg-primary-soft" : "mr-auto border-line bg-surface",
              )}
            >
              <p className="text-sm text-muted">
                <span className="font-medium text-ink">{authorLabel(m, side)}</span>, {formatWhen(m.created_at)}
              </p>
              <p className="mt-1 whitespace-pre-line leading-relaxed text-ink">{m.body}</p>
            </li>
          ))}
        </ol>
      )}
      {blocked ? (
        <p className="mt-4 rounded-md bg-sunken p-3 text-sm text-ink">{blocked}</p>
      ) : canReply ? (
        <form onSubmit={handleSubmit} noValidate className="mt-4">
          <Field id={fieldId} label={composerLabel ?? (side === "customer" ? "Your reply" : "Reply to the customer")} error={error} hint={hint}>
            <Textarea
              ref={textarea}
              id={fieldId}
              name="body"
              rows={4}
              maxLength={max}
              onChange={(event) => {
                setLength(event.currentTarget.value.length);
                if (error) setError(undefined);
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={fieldDescribedBy(fieldId, { error, hint })}
            />
          </Field>
          <Button type="submit" className="mt-3" disabled={pending} aria-busy={pending}>
            {pending ? "Sending…" : "Send"}
          </Button>
          <div aria-live="polite" className="mt-3">
            {sent && <Alert tone="success" title="Message sent." />}
            {failure && <Alert title={failure.text} traceId={failure.traceId} />}
          </div>
        </form>
      ) : null}
    </section>
  );
}

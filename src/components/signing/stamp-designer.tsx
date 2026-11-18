"use client";

import { Plus, Stamp as StampIcon, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { previewStamp, type Stamp, type StampColour, type StampShape } from "@/lib/api/stamps";
import { cn } from "@/lib/cn";
import { cleanStamp, signingMessage, STAMP_COLOURS, STAMP_LINES_MAX, STAMP_SHAPES, stampFieldErrors, stampProblems } from "@/lib/signing";

/*
 * The digital stamp (API 0.26.0): the person types the stamp's text and the
 * API draws it, like a rubber company stamp. The preview is the API's own
 * PNG, asked for a moment after the typing stops.
 */

/** A first stamp for someone: round, blue, their name along the top, dated. */
export const defaultStamp = (name: string): Stamp => ({
  shape: "ROUND",
  colour: "BLUE",
  top_text: Array.from(name.trim().toUpperCase()).slice(0, 60).join(""),
  centre_lines: [],
  bottom_text: "",
  include_date: true,
});

const hasProblems = (problems: Record<string, string | undefined>) => Object.values(problems).some(Boolean);

type Preview = { url: string | null; loading: boolean; fields: Record<string, string>; error?: string };

/**
 * The API's PNG of `stamp`, `delay` ms after it last changed, as an object
 * URL. The previous image stays until the next one arrives; every URL made is
 * revoked. Nothing is asked while the text breaks a rule the form checks.
 */
export function useStampPreview(stamp: Stamp | null, delay = 400): Preview {
  const cleaned = stamp ? cleanStamp(stamp) : null;
  const key = cleaned && !hasProblems(stampProblems(cleaned)) ? JSON.stringify(cleaned) : "";
  const [state, setState] = useState<{ key: string; url: string | null; fields: Record<string, string>; error?: string }>({ key: "", url: null, fields: {} });
  const current = useRef<string | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const wanted = JSON.parse(key) as Stamp;
    const timer = window.setTimeout(async () => {
      const result = await previewStamp(wanted);
      if (cancelled) return;
      if (result.ok) {
        const url = URL.createObjectURL(result.data.blob);
        if (current.current) URL.revokeObjectURL(current.current);
        current.current = url;
        setState({ key, url, fields: {} });
        return;
      }
      const fields = stampFieldErrors(result.failure.fields);
      setState((previous) => ({ key, url: previous.url, fields, error: Object.keys(fields).length > 0 ? undefined : signingMessage(result.failure) }));
    }, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [key, delay]);

  useEffect(
    () => () => {
      if (current.current) URL.revokeObjectURL(current.current);
    },
    [],
  );

  return { url: state.url, loading: Boolean(key) && state.key !== key, fields: state.key === key ? state.fields : {}, error: state.key === key ? state.error : undefined };
}

/** A stamp image (or a placeholder while there is none yet). */
export function StampImage({ url, loading, alt, className }: { url: string | null; loading?: boolean; alt: string; className?: string }) {
  return (
    <div className={cn("relative flex items-center justify-center", className)} aria-busy={loading || undefined}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- an in-memory image: there is nothing for next/image to optimise
        <img src={url} alt={alt} className={cn("max-h-full max-w-full object-contain transition-opacity", loading && "opacity-50")} />
      ) : (
        <StampIcon className={cn("size-8 text-subtle", loading && "animate-pulse")} aria-hidden="true" />
      )}
    </div>
  );
}

/** A saved or adopted stamp, drawn by the API. */
export function StampPreview({ stamp, alt = "Your stamp", className }: { stamp: Stamp; alt?: string; className?: string }) {
  const preview = useStampPreview(stamp, 0);
  return <StampImage url={preview.url} loading={preview.loading} alt={alt} className={className} />;
}

/**
 * Shape and colour, the text along the top, up to three centre lines, the
 * text along the bottom and the date, with the API's preview beside them.
 * `errors` are field errors the API gave when the stamp was saved or sent
 * (keys as `stampProblems`); `showAll` shows every problem, as after a submit.
 */
export function StampDesigner({
  value,
  onChange,
  errors,
  showAll,
}: {
  value: Stamp;
  onChange: (stamp: Stamp) => void;
  errors?: Record<string, string | undefined>;
  showAll?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const [touched, setTouched] = useState(false);
  const preview = useStampPreview(value);
  const problems = stampProblems(value);
  // A missing top text is shown once the field was left (or on submit); a text too long at once.
  const own = touched || showAll ? problems : { ...problems, top_text: value.top_text.trim() ? problems.top_text : undefined };
  const shown: Record<string, string | undefined> = { ...preview.fields, ...(errors ?? {}), ...Object.fromEntries(Object.entries(own).filter(([, text]) => text)) };
  const set = (change: Partial<Stamp>) => onChange({ ...value, ...change });
  const ids = { shape: `${id}-shape`, colour: `${id}-colour`, top: `${id}-top`, bottom: `${id}-bottom`, date: `${id}-date` };
  const rectangle = value.shape === "RECTANGLE";
  // The centre line just added gets the focus once it is on the page.
  const focusLine = useRef<number | null>(null);
  const lineCount = value.centre_lines.length;
  useEffect(() => {
    if (focusLine.current === null) return;
    document.getElementById(`${id}-line-${focusLine.current}`)?.focus();
    focusLine.current = null;
  }, [id, lineCount]);

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_13rem]">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={ids.shape} label="Shape" error={shown.shape}>
            <SearchableSelect
              id={ids.shape}
              options={STAMP_SHAPES.map((item) => ({ value: item.value, label: item.label }))}
              value={value.shape}
              onValueChange={(shape) => set({ shape: shape as StampShape })}
              aria-invalid={Boolean(shown.shape)}
              aria-describedby={fieldDescribedBy(ids.shape, { error: shown.shape })}
            />
          </Field>
          <Field id={ids.colour} label="Ink colour" error={shown.colour}>
            <SearchableSelect
              id={ids.colour}
              options={STAMP_COLOURS.map((item) => ({ value: item.value, label: item.label }))}
              value={value.colour}
              onValueChange={(colour) => set({ colour: colour as StampColour })}
              aria-invalid={Boolean(shown.colour)}
              aria-describedby={fieldDescribedBy(ids.colour, { error: shown.colour })}
            />
          </Field>
        </div>
        <Field id={ids.top} label={rectangle ? "First line (bold)" : "Text along the top"} error={shown.top_text} hint="Usually the company name. Printed in capitals.">
          <Input
            id={ids.top}
            value={value.top_text}
            maxLength={70}
            autoComplete="organization"
            onChange={(event) => set({ top_text: event.currentTarget.value })}
            onBlur={() => setTouched(true)}
            aria-invalid={Boolean(shown.top_text)}
            aria-describedby={fieldDescribedBy(ids.top, { error: shown.top_text, hint: "x" })}
          />
        </Field>
        <fieldset>
          <legend className="text-sm font-medium text-ink">
            Centre lines <span className="font-normal text-subtle">(optional, up to {STAMP_LINES_MAX})</span>
          </legend>
          {shown.centre_lines && <p className="mt-1 text-sm text-danger">{shown.centre_lines}</p>}
          <ol className="mt-2 space-y-2">
            {value.centre_lines.map((line, index) => {
              const lineId = `${id}-line-${index}`;
              const error = shown[`centre_lines[${index}]`];
              return (
                <li key={index} className="flex items-start gap-2">
                  <Field id={lineId} label={`Centre line ${index + 1}`} error={error} className="flex-1">
                    <Input
                      id={lineId}
                      value={line}
                      maxLength={40}
                      onChange={(event) => set({ centre_lines: value.centre_lines.map((item, at) => (at === index ? event.currentTarget.value : item)) })}
                      aria-invalid={Boolean(error)}
                      aria-describedby={fieldDescribedBy(lineId, { error })}
                    />
                  </Field>
                  <Button
                    variant="ghost"
                    className="mt-7 text-danger"
                    aria-label={`Remove centre line ${index + 1}`}
                    onClick={() => set({ centre_lines: value.centre_lines.filter((_, at) => at !== index) })}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </li>
              );
            })}
          </ol>
          <Button
            variant="secondary"
            size="sm"
            className="mt-2"
            disabled={value.centre_lines.length >= STAMP_LINES_MAX}
            onClick={() => {
              focusLine.current = value.centre_lines.length;
              set({ centre_lines: [...value.centre_lines, ""] });
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add a centre line
          </Button>
        </fieldset>
        <Field id={ids.bottom} label={rectangle ? "Last line" : "Text along the bottom"} optional error={shown.bottom_text} hint="A registration number or a town, for example.">
          <Input
            id={ids.bottom}
            value={value.bottom_text}
            maxLength={70}
            onChange={(event) => set({ bottom_text: event.currentTarget.value })}
            aria-invalid={Boolean(shown.bottom_text)}
            aria-describedby={fieldDescribedBy(ids.bottom, { error: shown.bottom_text, hint: "x" })}
          />
        </Field>
        <label className="flex min-h-11 items-center gap-3 text-ink">
          <input
            id={ids.date}
            type="checkbox"
            checked={value.include_date}
            onChange={(event) => set({ include_date: event.currentTarget.checked })}
            className="size-5 accent-primary"
          />
          <span>
            <span className="font-medium">Print the date</span>
            <span className="block text-sm text-muted">The day the stamp is applied, in the centre. The preview shows a sample date.</span>
          </span>
        </label>
        {shown.include_date && <p className="text-sm text-danger">{shown.include_date}</p>}
      </div>
      <div>
        <p className="text-sm font-medium text-ink" id={`${id}-preview-label`}>
          Preview
        </p>
        <StampImage
          url={preview.url}
          loading={preview.loading}
          alt={`Preview of the stamp: ${cleanStamp(value).top_text || "no text yet"}`}
          className="mt-1.5 aspect-square w-full rounded-md border border-dashed border-line-strong bg-white p-3"
        />
        <p className="mt-1 text-xs text-muted" role="status" aria-live="polite">
          {preview.loading ? "Drawing the preview…" : hasProblems(problems) ? "Fix the text to see the preview." : ""}
        </p>
        {preview.error && <Alert title={preview.error} className="mt-2" />}
      </div>
    </div>
  );
}

/** Adobe-style "Adopt your stamp": design it (or keep the saved one), then put it in the stamp fields. */
export function AdoptStampDialog({
  open,
  name,
  current,
  canSave,
  onAdopt,
  onCancel,
  error,
  fieldErrors,
  busy,
}: {
  open: boolean;
  /** The signer's name, for a first stamp. */
  name: string;
  /** The stamp already adopted, or the one saved to the account. */
  current: Stamp | null;
  /** Shows "Save to my account" (signed in). */
  canSave?: boolean;
  onAdopt: (stamp: Stamp, save: boolean) => void | Promise<void>;
  onCancel: () => void;
  error?: string;
  fieldErrors?: Record<string, string>;
  busy?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [stamp, setStamp] = useState<Stamp>(() => current ?? defaultStamp(name));
  const [save, setSave] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  function adopt() {
    setSubmitted(true);
    const cleaned = cleanStamp(stamp);
    if (hasProblems(stampProblems(cleaned))) return;
    void onAdopt(cleaned, save);
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-3xl rounded-lg border border-line bg-surface p-0 text-ink shadow-lg backdrop:bg-overlay"
    >
      <div className="p-6">
        <h2 id={titleId} className="font-sans text-xl font-semibold tracking-normal">
          Adopt your stamp
        </h2>
        <p className="mt-1 text-sm text-muted">Type the stamp&rsquo;s text and we draw it. It is used in every stamp box of this document.</p>
        <div className="mt-4">
          <StampDesigner value={stamp} onChange={setStamp} errors={fieldErrors} showAll={submitted} />
        </div>
        {canSave && (
          <label className="mt-4 flex min-h-11 items-center gap-3 text-sm text-ink">
            <input type="checkbox" checked={save} onChange={(event) => setSave(event.currentTarget.checked)} className="size-4 accent-primary" />
            Save to my account, to use it again
          </label>
        )}
        {error && <Alert title={error} className="mt-4" />}
      </div>
      <div className="flex flex-wrap justify-end gap-3 border-t border-line px-6 py-4">
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={adopt} disabled={busy} aria-busy={busy || undefined}>
          {busy ? "Saving…" : "Adopt and stamp"}
        </Button>
      </div>
    </dialog>
  );
}

"use client";

import { Eraser, ImageUp, PenLine, Type } from "lucide-react";
import { useEffect, useId, useRef, useState, type ChangeEvent, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import type { AdoptedSignature, SignatureFont } from "@/lib/api/agreements";
import { cn } from "@/lib/cn";
import {
  base64Bytes,
  initialsOf,
  SIGNATURE_DRAWN_MAX_BYTES,
  signatureDimensionsProblem,
  signatureImageProblem,
} from "@/lib/signing";

/*
 * Adobe's "Adopt your signature": type it in one of the styles the API
 * draws, draw it, or upload a picture of it. The same dialog adopts initials.
 *
 * The API's three styles are the Go italic faces, which are not web fonts, so
 * each style is previewed as an italic of the site's own typeface at the
 * matching weight; the PDF is drawn with the real face.
 */

const fontStyles: Record<string, CSSProperties> = {
  FLOWING: { fontStyle: "italic", fontWeight: 400 },
  BOLD: { fontStyle: "italic", fontWeight: 700 },
  CLASSIC: { fontStyle: "italic", fontWeight: 500, letterSpacing: "0.02em" },
};

export const DEFAULT_FONTS: SignatureFont[] = [
  { key: "FLOWING", label: "Flowing" },
  { key: "BOLD", label: "Bold" },
  { key: "CLASSIC", label: "Classic" },
];

/** The style of a typed signature, as close as the browser can show it. */
export const fontStyle = (key: string | null | undefined): CSSProperties => fontStyles[key ?? "FLOWING"] ?? fontStyles.FLOWING;

/** A data URL for an image the API sent as bare base64. */
export const imageSource = (base64: string) => (base64.startsWith("data:") ? base64 : `data:image/png;base64,${base64}`);

/** An adopted signature or initials, drawn to fit its box. */
export function SignaturePreview({ value, className }: { value: AdoptedSignature; className?: string }) {
  if (value.kind === "TYPED") {
    return (
      <span className={cn("block truncate leading-none text-ink", className)} style={fontStyle(value.font)}>
        {value.text}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- an in-memory image: there is nothing for next/image to optimise
    <img src={imageSource(value.image_base64)} alt="" className={cn("max-h-full max-w-full object-contain", className)} />
  );
}

type Tab = "type" | "draw" | "upload";

/** A canvas to draw on with a mouse, a pen or a finger. */
function DrawPad({ onChange, clearLabel }: { onChange: (dataUrl: string | null) => void; clearLabel: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    element.width = 600;
    element.height = 200;
    const context = element.getContext("2d");
    if (!context) return;
    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#111827";
  }, []);

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const element = event.currentTarget;
    const box = element.getBoundingClientRect();
    return { x: ((event.clientX - box.left) / box.width) * element.width, y: ((event.clientY - box.top) / box.height) * element.height };
  };

  function down(event: PointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    last.current = point(event);
    const context = event.currentTarget.getContext("2d");
    if (context && last.current) {
      context.beginPath();
      context.arc(last.current.x, last.current.y, 1.5, 0, Math.PI * 2);
      context.fillStyle = "#111827";
      context.fill();
    }
  }

  function moveTo(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !last.current) return;
    const context = event.currentTarget.getContext("2d");
    const next = point(event);
    if (context) {
      context.beginPath();
      context.moveTo(last.current.x, last.current.y);
      context.lineTo(next.x, next.y);
      context.stroke();
    }
    last.current = next;
  }

  function up(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    setEmpty(false);
    onChange(event.currentTarget.toDataURL("image/png"));
  }

  function clear() {
    const element = canvas.current;
    element?.getContext("2d")?.clearRect(0, 0, element.width, element.height);
    setEmpty(true);
    onChange(null);
  }

  return (
    <div>
      <div className="relative rounded-md border border-control bg-white">
        <canvas
          ref={canvas}
          className="block aspect-[3/1] w-full touch-none cursor-crosshair"
          onPointerDown={down}
          onPointerMove={moveTo}
          onPointerUp={up}
          onPointerCancel={up}
          aria-label="Drawing area. Draw with a mouse, a pen or your finger."
          role="img"
        />
        <span className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-dashed border-line-strong" aria-hidden="true" />
        {empty && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-subtle" aria-hidden="true">
            Draw here
          </span>
        )}
      </div>
      <Button variant="ghost" size="sm" className="mt-2" onClick={clear}>
        <Eraser className="size-4" aria-hidden="true" />
        {clearLabel}
      </Button>
    </div>
  );
}

type Props = {
  open: boolean;
  /** Signature or initials. */
  kind: "signature" | "initials";
  /** The signer's name, for the typed signature and initials. */
  name: string;
  fonts: SignatureFont[];
  /** The signature (or initials) already adopted, or the one saved to the account. */
  current?: AdoptedSignature | null;
  /** Shows "Save to my account" (signed in). */
  canSave?: boolean;
  /** The confirm button's words. */
  adoptLabel?: string;
  onAdopt: (value: AdoptedSignature, save: boolean) => void | Promise<void>;
  onCancel: () => void;
  /** A problem saving, shown in the dialog. */
  error?: string;
  busy?: boolean;
};

/** Type, draw or upload a signature (or initials), then adopt it. */
export function AdoptSignatureDialog({
  open,
  kind,
  name,
  fonts,
  current,
  canSave,
  adoptLabel,
  onAdopt,
  onCancel,
  error,
  busy,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const id = useId().replace(/:/g, "");
  const styles = fonts.length > 0 ? fonts : DEFAULT_FONTS;
  const fallbackText = kind === "initials" ? initialsOf(name) : name;
  const [tab, setTab] = useState<Tab>(current?.kind === "DRAWN" ? "draw" : current?.kind === "UPLOADED" ? "upload" : "type");
  const [text, setText] = useState(current?.kind === "TYPED" ? current.text : fallbackText);
  const [font, setFont] = useState<string>(current?.kind === "TYPED" ? current.font : String(styles[0].key));
  const [drawn, setDrawn] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<string | null>(current?.kind === "UPLOADED" ? current.image_base64 : null);
  const [save, setSave] = useState(false);
  const [problem, setProblem] = useState<string | undefined>();
  const [drawKey, setDrawKey] = useState(0);
  const word = kind === "initials" ? "initials" : "signature";
  const max = kind === "initials" ? 20 : 120;

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  const tabs: { key: Tab; label: string; icon: typeof Type }[] = [
    { key: "type", label: "Type", icon: Type },
    { key: "draw", label: "Draw", icon: PenLine },
    { key: "upload", label: "Upload", icon: ImageUp },
  ];

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = (index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
    setTab(tabs[next].key);
    setProblem(undefined);
    document.getElementById(`${id}-tab-${tabs[next].key}`)?.focus();
  }

  async function onUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    setProblem(undefined);
    if (!file) return;
    const wrong = signatureImageProblem(file);
    if (wrong) {
      setProblem(wrong);
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    }).catch(() => null);
    if (!dataUrl) {
      setProblem("That image could not be read. Try another one.");
      return;
    }
    const size = await new Promise<{ width: number; height: number } | null>((resolve) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve(null);
      image.src = dataUrl;
    });
    if (!size) {
      setProblem("That image could not be read. Try another one.");
      return;
    }
    const dimensions = signatureDimensionsProblem(size.width, size.height);
    if (dimensions) {
      setProblem(dimensions);
      return;
    }
    setUploaded(dataUrl);
  }

  function adopt() {
    setProblem(undefined);
    if (tab === "type") {
      const value = text.trim();
      if (!value) return setProblem(`Type your ${word}.`);
      if (Array.from(value).length > max) return setProblem(`Use ${max} characters or fewer.`);
      return void onAdopt({ kind: "TYPED", text: value, font }, save);
    }
    if (tab === "draw") {
      if (!drawn) return setProblem(`Draw your ${word} in the box first.`);
      if (base64Bytes(drawn) > SIGNATURE_DRAWN_MAX_BYTES) return setProblem("That drawing is too detailed. Clear it and draw it again more simply.");
      return void onAdopt({ kind: "DRAWN", image_base64: drawn }, save);
    }
    if (!uploaded) return setProblem(`Choose a picture of your ${word}.`);
    return void onAdopt({ kind: "UPLOADED", image_base64: uploaded }, save);
  }

  const shown = problem ?? error;

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-lg border border-line bg-surface p-0 text-ink shadow-lg backdrop:bg-overlay"
    >
      <div className="p-6">
        <h2 id={titleId} className="font-sans text-xl font-semibold tracking-normal">
          {kind === "initials" ? "Adopt your initials" : "Adopt your signature"}
        </h2>
        <p className="mt-1 text-sm text-muted">
          It is used wherever this document asks for your {word}.
        </p>

        <div role="tablist" aria-label={`How to make your ${word}`} className="mt-4 flex gap-1 border-b border-line">
          {tabs.map((item, index) => {
            const Icon = item.icon;
            const selected = tab === item.key;
            return (
              <button
                key={item.key}
                id={`${id}-tab-${item.key}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${id}-panel`}
                tabIndex={selected ? 0 : -1}
                onKeyDown={(event) => onTabKey(event, index)}
                onClick={() => {
                  setTab(item.key);
                  setProblem(undefined);
                }}
                className={cn(
                  "-mb-px flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-medium",
                  selected ? "border-primary text-primary-ink" : "border-transparent text-muted hover:text-ink",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${tab}`} className="mt-4">
          {tab === "type" && (
            <>
              <Field id={`${id}-text`} label={kind === "initials" ? "Your initials" : "Your full name"}>
                <Input
                  id={`${id}-text`}
                  value={text}
                  maxLength={max + 10}
                  autoComplete={kind === "initials" ? "off" : "name"}
                  onChange={(event) => setText(event.currentTarget.value)}
                  aria-describedby={fieldDescribedBy(`${id}-text`, {})}
                />
              </Field>
              <fieldset className="mt-4">
                <legend className="text-sm font-medium text-ink">Style</legend>
                <div className="mt-2 grid gap-2">
                  {styles.map((style) => (
                    <label
                      key={style.key}
                      className={cn(
                        "flex min-h-16 cursor-pointer items-center gap-3 rounded-md border px-4 py-2",
                        font === style.key ? "border-primary bg-tint" : "border-line hover:bg-sunken",
                      )}
                    >
                      <input
                        type="radio"
                        name={`${id}-font`}
                        value={style.key}
                        checked={font === style.key}
                        onChange={() => setFont(String(style.key))}
                        className="size-4 accent-primary"
                      />
                      <span className="min-w-0 flex-1 truncate text-3xl text-ink" style={fontStyle(String(style.key))}>
                        {text.trim() || fallbackText || "Your name"}
                      </span>
                      <span className="text-xs text-muted">{style.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          )}
          {tab === "draw" && <DrawPad key={drawKey} onChange={setDrawn} clearLabel="Clear" />}
          {tab === "upload" && (
            <div>
              <label
                htmlFor={`${id}-file`}
                className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-line-strong bg-soft p-4 text-center hover:border-primary"
              >
                {uploaded ? (
                  // eslint-disable-next-line @next/next/no-img-element -- an in-memory image: there is nothing for next/image to optimise
                  <img src={imageSource(uploaded)} alt={`Your uploaded ${word}`} className="max-h-24 max-w-full object-contain" />
                ) : (
                  <ImageUp className="size-6 text-muted" aria-hidden="true" />
                )}
                <span className="text-sm font-medium text-primary-ink">{uploaded ? "Choose another image" : "Choose an image"}</span>
                <span className="text-xs text-muted">PNG or JPEG, at most 500 KB. A dark signature on a light background works best.</span>
              </label>
              <input id={`${id}-file`} type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(event) => void onUpload(event)} />
            </div>
          )}
        </div>

        {canSave && (
          <label className="mt-4 flex min-h-11 items-center gap-3 text-sm text-ink">
            <input type="checkbox" checked={save} onChange={(event) => setSave(event.currentTarget.checked)} className="size-4 accent-primary" />
            Save to my account, to use it again
          </label>
        )}

        {shown && <Alert title={shown} className="mt-4" />}
      </div>
      <div className="flex flex-wrap justify-end gap-3 border-t border-line px-6 py-4">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => {
            setDrawKey((value) => value + 1);
            setDrawn(null);
            onCancel();
          }}
        >
          Cancel
        </Button>
        <Button onClick={adopt} disabled={busy} aria-busy={busy || undefined}>
          {busy ? "Saving…" : (adoptLabel ?? (kind === "initials" ? "Adopt and initial" : "Adopt and sign"))}
        </Button>
      </div>
    </dialog>
  );
}

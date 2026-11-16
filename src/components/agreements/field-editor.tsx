"use client";

import { CalendarDays, CheckSquare, FileSignature, Minus, Plus, SquarePen, Stamp, Trash2, Type, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type PointerEvent } from "react";
import { ColourDot } from "@/components/agreements/shared";
import { PdfPages, type RenderedPage } from "@/components/pdf/pdf-pages";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { putAgreementFields, type Agreement, type AgreementRecipient, type FieldInput, type FieldType, type PageSize } from "@/lib/api/agreements";
import { cn } from "@/lib/cn";
import { boxAt, clampBox, FIELD_TYPES, fieldMin, fieldTypeLabel, isSignerOnly, recipientColour, signersWithoutSignature, signingMessage, type Box } from "@/lib/signing";

/*
 * The field editor of the send flow (Adobe's "Prepare"): the PDF's pages
 * with the fields of every recipient on them. Fields are added from the
 * toolbar (click a type then click the page, drag it onto the page, or
 * "Add to page" from the keyboard), moved and resized with the pointer or
 * the arrow keys, and stored in PDF points from each page's top-left corner,
 * the unit the API takes. The layout is saved on this device at once and to
 * the draft once every signer has a signature field (the API stores nothing
 * before that).
 */

export type EditorField = Box & {
  key: string;
  recipient_id: string;
  type: FieldType;
  page: number;
  required: boolean;
  label: string;
};

const icons: Record<string, typeof Type> = {
  SIGNATURE: FileSignature,
  INITIALS: SquarePen,
  STAMP: Stamp,
  DATE_SIGNED: CalendarDays,
  NAME: UserRound,
  TEXT: Type,
  CHECKBOX: CheckSquare,
};

const DRAG_TYPE = "application/x-rp365-field";

const countFields = (count: number) => (count === 1 ? "1 field" : `${count} fields`);
let counter = 0;
const newKey = () => `f${Date.now().toString(36)}${(counter++).toString(36)}`;

export const toEditorFields = (agreement: Agreement): EditorField[] =>
  agreement.fields.map((field) => ({
    key: field.id,
    recipient_id: field.recipient_id,
    type: field.type as FieldType,
    page: field.page,
    x: field.x,
    y: field.y,
    w: field.w,
    h: field.h,
    required: field.required,
    label: field.label ?? "",
  }));

/**
 * The fields that can still be stored: for a recipient who is still on the
 * document, is not a copy recipient, and (for a signature, initials or a stamp) still signs.
 */
export const usableFields = (fields: EditorField[], recipients: { id: string; role: string }[]) =>
  fields.filter((field) => {
    const recipient = recipients.find((item) => item.id === field.recipient_id);
    if (!recipient || recipient.role === "CC") return false;
    return recipient.role === "SIGNER" || !isSignerOnly(field.type);
  });

export const toFieldInputs = (fields: EditorField[]): FieldInput[] =>
  fields.map((field) => ({
    recipient_id: field.recipient_id,
    type: field.type,
    page: field.page,
    x: field.x,
    y: field.y,
    w: field.w,
    h: field.h,
    ...(field.type === "TEXT" || field.type === "CHECKBOX"
      ? { required: field.required, ...(field.label.trim() ? { label: field.label.trim() } : {}) }
      : {}),
  }));

const storageKey = (agreementId: string) => `rp365.agreement-fields.${agreementId}`;

function readLocal(agreementId: string, sha: string): EditorField[] | null {
  try {
    const raw = window.localStorage.getItem(storageKey(agreementId));
    if (!raw) return null;
    const saved = JSON.parse(raw) as { sha?: string; fields?: EditorField[] };
    return saved.sha === sha && Array.isArray(saved.fields) ? saved.fields : null;
  } catch {
    return null;
  }
}

function writeLocal(agreementId: string, sha: string, fields: EditorField[]) {
  try {
    window.localStorage.setItem(storageKey(agreementId), JSON.stringify({ sha, fields }));
  } catch {
    // Storage full or blocked: the draft on the server is what counts.
  }
}

export const forgetLocalFields = (agreementId: string) => {
  try {
    window.localStorage.removeItem(storageKey(agreementId));
  } catch {
    // Nothing to forget.
  }
};

type Save =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved" }
  | { status: "local"; missing: string[] }
  | { status: "error"; message: string };

type Drag = { key: string; mode: "move" | "resize"; startX: number; startY: number; box: Box; scale: number };

function FieldOnPage({
  field,
  page,
  pageSize,
  colour,
  name,
  selected,
  onSelect,
  onChange,
  onRemove,
}: {
  field: EditorField;
  page: RenderedPage;
  pageSize: PageSize;
  colour: string;
  name: string;
  selected: boolean;
  onSelect: () => void;
  onChange: (box: Box) => void;
  onRemove: () => void;
}) {
  const drag = useRef<Drag | null>(null);
  const Icon = icons[field.type] ?? Type;

  function start(event: PointerEvent<HTMLElement>, mode: Drag["mode"]) {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    onSelect();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    drag.current = { key: field.key, mode, startX: event.clientX, startY: event.clientY, box: { x: field.x, y: field.y, w: field.w, h: field.h }, scale: page.scale };
  }

  function moveTo(event: PointerEvent<HTMLElement>) {
    const current = drag.current;
    if (!current) return;
    const dx = (event.clientX - current.startX) / current.scale;
    const dy = (event.clientY - current.startY) / current.scale;
    const box =
      current.mode === "move"
        ? { ...current.box, x: current.box.x + dx, y: current.box.y + dy }
        : { ...current.box, w: current.box.w + dx, h: current.box.h + dy };
    onChange(clampBox(box, pageSize, fieldMin(field.type)));
  }

  function end() {
    drag.current = null;
  }

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 10 : 1;
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (arrows[event.key]) {
      event.preventDefault();
      const [dx, dy] = arrows[event.key];
      const box = { x: field.x, y: field.y, w: field.w, h: field.h };
      onChange(clampBox(event.altKey ? { ...box, w: box.w + dx, h: box.h + dy } : { ...box, x: box.x + dx, y: box.y + dy }, pageSize, fieldMin(field.type)));
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      onRemove();
    }
  }

  const fontSize = Math.max(8, Math.min(field.h * page.scale * 0.45, 14));

  return (
    <div
      role="button"
      tabIndex={0}
      id={`editor-field-${field.key}`}
      aria-pressed={selected}
      aria-label={`${fieldTypeLabel(field.type)} for ${name}, page ${field.page}. Arrow keys move it, Alt and arrow keys resize it, Delete removes it.`}
      onPointerDown={(event) => start(event, "move")}
      onPointerMove={moveTo}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={onKey}
      onFocus={onSelect}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "absolute flex touch-none select-none items-center gap-1 overflow-hidden rounded-sm border-2 px-1 font-medium outline-none",
        selected ? "cursor-move ring-2 ring-focus ring-offset-1" : "cursor-move",
      )}
      style={{
        left: field.x * page.scale,
        top: field.y * page.scale,
        width: field.w * page.scale,
        height: field.h * page.scale,
        borderColor: colour,
        background: `${colour}22`,
        color: colour,
        fontSize,
      }}
    >
      {field.type !== "CHECKBOX" && (
        <>
          <Icon className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{field.type === "TEXT" && field.label ? field.label : fieldTypeLabel(field.type)}</span>
        </>
      )}
      {(field.type === "TEXT" || field.type === "CHECKBOX") && field.required && (
        <span className="absolute right-0.5 top-0 text-xs" aria-hidden="true">
          *
        </span>
      )}
      <span
        onPointerDown={(event) => start(event, "resize")}
        onPointerMove={moveTo}
        onPointerUp={end}
        onPointerCancel={end}
        // A 24px target (WCAG 2.5.8) around the 12px corner that shows.
        className="absolute -bottom-1.5 -right-1.5 flex size-6 cursor-nwse-resize touch-none items-end justify-end p-1.5"
        aria-hidden="true"
      >
        <span className="size-3" style={{ background: colour }} />
      </span>
    </div>
  );
}

export function FieldEditor({
  agreement,
  bytes,
  onSaved,
  onFieldsChange,
}: {
  agreement: Agreement;
  bytes: ArrayBuffer;
  onSaved: (agreement: Agreement) => void;
  /** Every change, for the review step. */
  onFieldsChange: (fields: EditorField[]) => void;
}) {
  const pages = useMemo(() => agreement.document?.pages ?? [], [agreement.document]);
  const sha = agreement.document?.sha256 ?? "";
  const recipients = useMemo(() => [...agreement.recipients].sort((a, b) => a.order - b.order), [agreement.recipients]);
  const actionable = recipients.filter((recipient) => recipient.role !== "CC");
  const colourOf = (id: string) => recipientColour(Math.max(0, recipients.findIndex((recipient) => recipient.id === id)));
  const nameOf = (id: string) => recipients.find((recipient) => recipient.id === id)?.name ?? "someone";

  const [fields, setFieldsState] = useState<EditorField[]>(() => {
    const server = usableFields(toEditorFields(agreement), agreement.recipients);
    if (server.length > 0 || typeof window === "undefined") return server;
    const local = readLocal(agreement.id, sha);
    return local ? usableFields(local, agreement.recipients) : server;
  });
  const [restored] = useState(() => fields.length > 0 && agreement.fields.length === 0);
  const [active, setActive] = useState<string>(actionable[0]?.id ?? "");
  const [tool, setTool] = useState<FieldType | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [addPage, setAddPage] = useState("1");
  const [save, setSave] = useState<Save>({ status: "idle" });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(fields);
  const announce = useRef<HTMLParagraphElement>(null);

  const activeRecipient: AgreementRecipient | undefined = actionable.find((recipient) => recipient.id === active) ?? actionable[0];
  const approver = activeRecipient?.role === "APPROVER";

  const persist = useCallback(async () => {
    const current = latest.current;
    const missing = signersWithoutSignature(recipients, current);
    if (missing.length > 0) {
      setSave({ status: "local", missing });
      return;
    }
    setSave({ status: "saving" });
    const result = await putAgreementFields(agreement.id, toFieldInputs(current));
    if (latest.current !== current) return;
    if (result.ok) {
      setSave({ status: "saved" });
      onSaved(result.data.agreement);
      return;
    }
    const detail = result.failure.fields ? Object.values(result.failure.fields).slice(0, 3).join(" ") : "";
    setSave({ status: "error", message: `${signingMessage(result.failure)}${detail ? ` ${detail}` : ""}` });
  }, [agreement.id, recipients, onSaved]);

  const setFields = useCallback(
    (next: EditorField[]) => {
      latest.current = next;
      setFieldsState(next);
      onFieldsChange(next);
      writeLocal(agreement.id, sha, next);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = undefined;
        void persist();
      }, 1200);
    },
    [agreement.id, sha, onFieldsChange, persist],
  );

  const persistRef = useRef(persist);
  useEffect(() => {
    persistRef.current = persist;
  }, [persist]);

  useEffect(() => {
    onFieldsChange(latest.current);
  }, [onFieldsChange]);

  // Leaving the step: a save still waiting for its timer is made now.
  useEffect(
    () => () => {
      if (timer.current !== undefined) {
        clearTimeout(timer.current);
        void persistRef.current();
      }
    },
    [],
  );

  const sizeOf = (type: FieldType): (typeof FIELD_TYPES)[number] => FIELD_TYPES.find((item) => item.type === type) ?? FIELD_TYPES[0];
  const allowed = (type: FieldType) => !(approver && sizeOf(type).signerOnly);

  function add(type: FieldType, pageNumber: number, point?: { x: number; y: number }) {
    if (!activeRecipient || !allowed(type)) return;
    const size = pages[pageNumber - 1];
    if (!size) return;
    const preset = sizeOf(type);
    // Without a point (the keyboard), fields go near the middle, a little apart from the last one.
    const onPage = latest.current.filter((field) => field.page === pageNumber).length;
    const where = point ?? { x: size.width / 2, y: Math.min(size.height / 2 + onPage * 28, size.height - preset.h) };
    const box = clampBox(boxAt(where, { w: preset.w, h: preset.h }, size), size, preset.min);
    const field: EditorField = { key: newKey(), recipient_id: activeRecipient.id, type, page: pageNumber, ...box, required: true, label: "" };
    setFields([...latest.current, field]);
    setSelected(field.key);
    if (announce.current) announce.current.textContent = `${preset.label} for ${activeRecipient.name} added to page ${pageNumber}.`;
    requestAnimationFrame(() => document.getElementById(`editor-field-${field.key}`)?.focus({ preventScroll: !point ? false : true }));
  }

  function update(key: string, change: Partial<EditorField>) {
    setFields(latest.current.map((field) => (field.key === key ? { ...field, ...change } : field)));
  }

  function remove(key: string) {
    const field = latest.current.find((item) => item.key === key);
    setFields(latest.current.filter((item) => item.key !== key));
    setSelected(null);
    if (announce.current && field) announce.current.textContent = `${fieldTypeLabel(field.type)} removed.`;
  }

  function pointOf(event: { clientX: number; clientY: number; currentTarget: Element }, page: RenderedPage) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / page.scale, y: (event.clientY - rect.top) / page.scale };
  }

  const overlay = (page: RenderedPage) => {
    const size = pages[page.index] ?? { width: page.width, height: page.height };
    return (
      <div
        className={cn("absolute inset-0", tool && "cursor-crosshair")}
        onClick={(event) => {
          if (tool) {
            add(tool, page.number, pointOf(event, page));
            setTool(null);
          } else setSelected(null);
        }}
        onDragOver={(event: DragEvent<HTMLDivElement>) => {
          if (event.dataTransfer.types.includes(DRAG_TYPE)) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }
        }}
        onDrop={(event: DragEvent<HTMLDivElement>) => {
          const type = event.dataTransfer.getData(DRAG_TYPE) as FieldType;
          if (!type) return;
          event.preventDefault();
          add(type, page.number, pointOf(event, page));
        }}
      >
        {fields
          .filter((field) => field.page === page.number)
          .map((field) => (
            <FieldOnPage
              key={field.key}
              field={field}
              page={page}
              pageSize={size}
              colour={colourOf(field.recipient_id)}
              name={nameOf(field.recipient_id)}
              selected={selected === field.key}
              onSelect={() => setSelected(field.key)}
              onChange={(box) => update(field.key, box)}
              onRemove={() => remove(field.key)}
            />
          ))}
      </div>
    );
  };

  const chosen = fields.find((field) => field.key === selected) ?? null;
  const missing = signersWithoutSignature(recipients, fields);
  const pageOptions = pages.map((_, index) => ({ value: String(index + 1), label: `Page ${index + 1}` }));

  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="space-y-5 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
        <Field id="editor-recipient" label="Fields for">
          <SearchableSelect
            id="editor-recipient"
            options={actionable.map((recipient) => ({
              value: recipient.id,
              label: recipient.name,
              secondary: recipient.role === "APPROVER" ? "Approver" : "Signer",
            }))}
            value={activeRecipient?.id ?? ""}
            onValueChange={(value) => {
              setActive(value);
              setTool(null);
            }}
          />
        </Field>
        <ul className="space-y-1 text-sm" aria-label="Colour of each recipient">
          {recipients.map((recipient, index) => (
            <li key={recipient.id} className="flex items-center gap-2">
              <ColourDot index={index} />
              <span className={cn("truncate", recipient.id === activeRecipient?.id ? "font-semibold text-ink" : "text-muted")}>{recipient.name}</span>
              <span className="text-xs text-subtle">
                {recipient.role === "CC" ? "copy" : countFields(fields.filter((field) => field.recipient_id === recipient.id).length)}
              </span>
            </li>
          ))}
        </ul>

        <div>
          <p className="text-sm font-medium text-ink">Add a field</p>
          <p id="editor-tools-hint" className="mt-1 text-xs text-muted">
            Choose a field, then click on the page where it goes, or drag it onto the page.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {FIELD_TYPES.map((item) => {
              const Icon = icons[item.type];
              const disabled = !allowed(item.type);
              return (
                <button
                  key={item.type}
                  type="button"
                  draggable={!disabled}
                  disabled={disabled}
                  aria-pressed={tool === item.type}
                  aria-describedby="editor-tools-hint"
                  title={disabled ? "An approver approves without signing" : undefined}
                  onClick={() => setTool((current) => (current === item.type ? null : item.type))}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(DRAG_TYPE, item.type);
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-md border px-2 text-left text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                    tool === item.type ? "border-primary bg-primary text-on-primary" : "border-line-strong bg-surface text-ink hover:bg-sunken",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </div>
          {tool && <p className="mt-2 text-xs text-primary-ink">Now click on a page to place the {fieldTypeLabel(tool).toLowerCase()} field.</p>}
          <div className="mt-3 flex items-end gap-2">
            <Field id="editor-add-page" label="Or add it to" className="flex-1">
              <SearchableSelect id="editor-add-page" options={pageOptions} value={addPage} onValueChange={setAddPage} />
            </Field>
            <Button
              variant="secondary"
              disabled={!tool}
              onClick={() => {
                if (!tool) return;
                add(tool, Number(addPage) || 1);
                setTool(null);
              }}
            >
              Add
            </Button>
          </div>
        </div>

        {chosen && (
          <div className="rounded-md border border-line p-3" aria-label="The selected field">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <ColourDot index={Math.max(0, recipients.findIndex((recipient) => recipient.id === chosen.recipient_id))} />
              {fieldTypeLabel(chosen.type)} · page {chosen.page}
            </p>
            <Field id="editor-field-recipient" label="For" className="mt-3">
              <SearchableSelect
                id="editor-field-recipient"
                options={actionable
                  .filter((recipient) => recipient.role === "SIGNER" || !sizeOf(chosen.type).signerOnly)
                  .map((recipient) => ({ value: recipient.id, label: recipient.name }))}
                value={chosen.recipient_id}
                onValueChange={(value) => update(chosen.key, { recipient_id: value })}
              />
            </Field>
            {(chosen.type === "TEXT" || chosen.type === "CHECKBOX") && (
              <>
                <Field id="editor-field-label" label="Label" optional className="mt-3">
                  <Input
                    id="editor-field-label"
                    value={chosen.label}
                    maxLength={80}
                    placeholder={chosen.type === "TEXT" ? "For example ID number" : "For example I agree"}
                    onChange={(event) => update(chosen.key, { label: event.currentTarget.value })}
                  />
                </Field>
                <label className="mt-3 flex min-h-11 items-center gap-3 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={chosen.required}
                    onChange={(event) => update(chosen.key, { required: event.currentTarget.checked })}
                    className="size-5 accent-primary"
                  />
                  Required
                </label>
              </>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(["x", "y", "w", "h"] as const).map((axis) => (
                <Field key={axis} id={`editor-field-${axis}`} label={{ x: "From left", y: "From top", w: "Width", h: "Height" }[axis]}>
                  <Input
                    id={`editor-field-${axis}`}
                    type="number"
                    inputMode="decimal"
                    step={1}
                    value={Math.round(chosen[axis])}
                    onChange={(event) => {
                      const value = Number(event.currentTarget.value);
                      if (!Number.isFinite(value)) return;
                      const size = pages[chosen.page - 1];
                      if (size) update(chosen.key, clampBox({ x: chosen.x, y: chosen.y, w: chosen.w, h: chosen.h, [axis]: value }, size, fieldMin(chosen.type)));
                    }}
                  />
                </Field>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted">
              In points (1/72 inch). Arrow keys move it; with Shift by 10; with Alt they resize it.
              {chosen.type === "STAMP" && " A stamp is at least 57 points (20 mm) each way and keeps its shape inside the box."}
            </p>
            <Button variant="ghost" size="sm" className="mt-2 text-danger" onClick={() => remove(chosen.key)}>
              <Trash2 className="size-4" aria-hidden="true" />
              Remove this field
            </Button>
          </div>
        )}
      </aside>

      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div role="status" aria-live="polite" className="text-sm">
            {save.status === "saving" && <span className="text-muted">Saving the fields…</span>}
            {save.status === "saved" && <span className="text-success">Fields saved to the draft</span>}
            {save.status === "local" && (
              <span className="text-warning">
                Saved on this device. Saved to the draft once {save.missing.join(", ")} {save.missing.length === 1 ? "has" : "have"} a signature field.
              </span>
            )}
            {save.status === "error" && <span className="text-danger">{save.message}</span>}
          </div>
          <div className="flex items-center gap-1" role="group" aria-label="Zoom">
            <Button size="sm" variant="secondary" onClick={() => setZoom((value) => Math.max(0.5, Math.round((value - 0.25) * 100) / 100))} aria-label="Zoom out" disabled={zoom <= 0.5}>
              <Minus className="size-4" aria-hidden="true" />
            </Button>
            <span className="w-14 text-center text-sm tabular-nums text-ink">{Math.round(zoom * 100)}%</span>
            <Button size="sm" variant="secondary" onClick={() => setZoom((value) => Math.min(2, Math.round((value + 0.25) * 100) / 100))} aria-label="Zoom in" disabled={zoom >= 2}>
              <Plus className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
        {restored && <Alert tone="info" title="We restored the fields you placed on this device." className="mb-3" />}
        {missing.length > 0 && (
          <Alert tone="warning" title={`Add a signature field for ${missing.join(", ")}.`} className="mb-3">
            Every signer needs at least one signature field before the document can be sent.
          </Alert>
        )}
        <p ref={announce} className="sr-only" aria-live="polite" />
        <PdfPages data={bytes} zoom={zoom} label={agreement.name} renderOverlay={overlay} />
      </div>
    </div>
  );
}

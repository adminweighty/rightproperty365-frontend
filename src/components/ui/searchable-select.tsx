"use client";

import { Check, ChevronDown, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { controlClass } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import {
  closedState,
  comboReducer,
  effectiveValue,
  filterOptions,
  flattenOptions,
  isGroup,
  optionText,
  toSections,
  type ComboAction,
  type ComboState,
  type SelectItem,
  type SelectOption,
} from "@/lib/searchable-select";

export type { SelectGroup, SelectItem, SelectOption } from "@/lib/searchable-select";

type Props = {
  /** The id the field's `<label htmlFor>` points at. Required: ids of the list and its options derive from it. */
  id: string;
  /** The form field name. The value is submitted by a native `<select>` with this name. */
  name?: string;
  /** Options and groups of options, in order. An option with the value "" is the "any" choice and adds a clear button. */
  options: SelectItem[];
  /** Controlled value, with `onValueChange`. */
  value?: string;
  /** Uncontrolled starting value. The field follows it when it changes, as a native select does. */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  /** Layout only (width, grid placement). */
  className?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-required"?: boolean;
  /** Only for a field with no `<label>`. */
  "aria-label"?: string;
};

type Placement = { above: boolean; maxHeight: number };

const noop = () => () => {};
const POPUP_MAX = 320;
const POPUP_MIN = 132;
const GAP = 8;

function NativeOption({ option }: { option: SelectOption }) {
  return (
    <option value={option.value} disabled={option.disabled}>
      {optionText(option)}
    </option>
  );
}

/**
 * A select that can be searched by typing: the WAI-ARIA "editable combobox
 * with list autocomplete" over a native `<select>`.
 *
 * The server renders the native select, so every form works without
 * JavaScript and submits the same field. Once the page is interactive the
 * select stays in the DOM as the form control (same `name`, `required`,
 * `disabled`; hidden from sight, from the tab order and from assistive
 * technology) and a text field with a list takes its place. Choosing an
 * option sets the select and fires its `change` event, so a form's
 * `onChange`, `FormData` and plain submission all behave as before.
 *
 * Specification: design/components/README.md, "SearchableSelect".
 */
export function SearchableSelect({
  id,
  name,
  options,
  value: controlled,
  defaultValue,
  onValueChange,
  required,
  disabled,
  className,
  "aria-invalid": invalid,
  "aria-describedby": describedBy,
  "aria-required": ariaRequired,
  "aria-label": ariaLabel,
}: Props) {
  // False on the server and for the first client render, so the HTML is the plain select.
  const enhanced = useSyncExternalStore(noop, () => true, () => false);

  const flat = useMemo(() => flattenOptions(options), [options]);

  const [inner, setInner] = useState(defaultValue);
  const [seenDefault, setSeenDefault] = useState(defaultValue);
  if (seenDefault !== defaultValue) {
    setSeenDefault(defaultValue);
    setInner(defaultValue);
  }
  const value = effectiveValue(flat, controlled ?? inner);
  const selected = flat.find((option) => option.value === value);

  const [state, setState] = useState<ComboState>(closedState);
  const [placement, setPlacement] = useState<Placement>({ above: false, maxHeight: POPUP_MAX });
  const [labelText, setLabelText] = useState<string>();

  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const select = useRef<HTMLSelectElement>(null);
  const popup = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => filterOptions(flat, state.query), [flat, state.query]);
  const { sections, hidden } = useMemo(() => toSections(matches, state.limit), [matches, state.limit]);
  const active = state.open && state.active >= 0 && state.active < matches.length ? state.active : -1;

  const listId = `${id}-listbox`;
  const optionId = (index: number) => `${id}-option-${index}`;
  const clearable = !disabled && value !== "" && flat.some((option) => option.value === "" && !option.disabled);

  /** Where the list goes: under the field, or over it when there is more room there. */
  const place = useCallback(() => {
    const box = root.current?.getBoundingClientRect();
    if (!box) return;
    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop ?? 0;
    const height = viewport?.height ?? window.innerHeight;
    // The sticky header covers the top of the page.
    const header = document.querySelector("[data-site-header]")?.getBoundingClientRect().bottom ?? 0;
    const top = Math.max(viewportTop, header);
    const below = viewportTop + height - box.bottom - GAP;
    const over = box.top - top - GAP;
    const above = below < Math.min(POPUP_MAX, 220) && over > below;
    setPlacement({ above, maxHeight: Math.max(POPUP_MIN, Math.min(POPUP_MAX, above ? over : below)) });
  }, []);

  function send(action: ComboAction) {
    const next = comboReducer(state, action, flat, value);
    if (next.open && !state.open) {
      place();
      setLabelText(ariaLabel ?? input.current?.labels?.[0]?.textContent ?? undefined);
    }
    setState(next);
  }

  /** Choose a value through the native select, so `change` reaches the form like any other field. */
  function pick(next: string) {
    setState(closedState);
    const node = select.current;
    if (!node || next === value) return;
    node.value = next;
    node.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // The on-screen keyboard and scrolling change the room around the field.
  useEffect(() => {
    if (!state.open) return;
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", place);
    viewport?.addEventListener("scroll", place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, { passive: true });
    return () => {
      viewport?.removeEventListener("resize", place);
      viewport?.removeEventListener("scroll", place);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place);
    };
  }, [state.open, place]);

  // Keep the active option in view inside the list, without scrolling the page.
  useEffect(() => {
    const list = popup.current;
    if (!list || active < 0) return;
    const node = list.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (!node) return;
    const top = node.offsetTop;
    const bottom = top + node.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = active === 0 ? 0 : top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }, [active, state.open, state.limit]);

  // While the field shows the selected option its text stays selected, so typing replaces it.
  const showingSelection = state.query === null;
  useEffect(() => {
    const node = input.current;
    if (showingSelection && node && document.activeElement === node) node.select();
  }, [showingSelection, value]);

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
        event.preventDefault();
        if (event.altKey && !state.open) send({ type: "open" });
        else send({ type: "move", delta: event.key === "ArrowDown" ? 1 : -1 });
        break;
      case "Home":
      case "End":
        if (!state.open) break;
        event.preventDefault();
        send({ type: event.key === "Home" ? "first" : "last" });
        break;
      case "Enter":
        // Closed: Enter submits the form, as in any text field.
        if (!state.open) break;
        event.preventDefault();
        if (active >= 0) pick(matches[active].value);
        else send({ type: "close" });
        break;
      case "Escape":
        if (state.open) {
          event.preventDefault();
          event.stopPropagation();
          send({ type: "close" });
        } else if (state.query !== null) {
          event.preventDefault();
          send({ type: "reset" });
        }
        break;
      case "Tab":
        if (state.open && state.navigated && active >= 0) pick(matches[active].value);
        break;
    }
  }

  const status = !state.open || state.query === null
    ? ""
    : matches.length === 0
      ? "No matches"
      : matches.length === 1
        ? "1 option"
        : `${matches.length} options`;

  return (
    <div ref={root} className={cn("relative", className)}>
      {enhanced && (
        <>
          <input
            ref={input}
            id={id}
            type="text"
            role="combobox"
            aria-expanded={state.open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? optionId(active) : undefined}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            aria-required={ariaRequired ?? required}
            aria-label={ariaLabel}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            disabled={disabled}
            value={state.query ?? selected?.text ?? ""}
            className={cn(controlClass, "h-11 truncate pr-11")}
            onChange={(event) => send({ type: "type", text: event.target.value })}
            onKeyDown={onKeyDown}
            onFocus={(event) => event.target.select()}
            onClick={() => send({ type: "open" })}
            onBlur={() => setState(closedState)}
          />
          {clearable ? (
            <button
              type="button"
              aria-label={`Clear ${labelText ?? ariaLabel ?? "selection"}`.trim()}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-md text-muted hover:text-ink focus-visible:-outline-offset-2"
              onMouseDown={(event) => event.preventDefault()}
              onFocus={() => setLabelText(ariaLabel ?? input.current?.labels?.[0]?.textContent ?? undefined)}
              onClick={() => {
                pick("");
                input.current?.focus();
              }}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : (
            <span
              aria-hidden="true"
              className={cn(
                "absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted",
                disabled ? "opacity-60" : "cursor-pointer",
              )}
              onMouseDown={(event) => {
                event.preventDefault();
                if (disabled) return;
                input.current?.focus();
                send({ type: state.open ? "close" : "open" });
              }}
            >
              <ChevronDown className={cn("size-4 transition-transform duration-150", state.open && "rotate-180")} />
            </span>
          )}
        </>
      )}

      {/*
       * The form control. Before the page is interactive it is the visible
       * field; afterwards it lies under the text field, unseen and out of the
       * tab order, and still submits the value and enforces `required` (the
       * browser's message appears on the field).
       */}
      <select
        ref={select}
        id={enhanced ? `${id}-native` : id}
        name={name}
        value={value}
        required={required}
        disabled={disabled}
        tabIndex={enhanced ? -1 : undefined}
        aria-hidden={enhanced ? true : undefined}
        aria-invalid={enhanced ? undefined : invalid}
        aria-describedby={enhanced ? undefined : describedBy}
        aria-required={enhanced ? undefined : ariaRequired}
        aria-label={enhanced ? undefined : ariaLabel}
        className={
          enhanced
            ? "pointer-events-none absolute inset-0 h-full w-full opacity-0"
            : cn(controlClass, "h-11 pr-8")
        }
        onFocus={enhanced ? () => input.current?.focus() : undefined}
        onChange={(event) => {
          const next = event.target.value;
          if (controlled === undefined) setInner(next);
          onValueChange?.(next);
        }}
      >
        {options.map((item, index) =>
          isGroup(item) ? (
            <optgroup key={`group-${index}`} label={item.label}>
              {item.options.map((option) => (
                <NativeOption key={option.value} option={option} />
              ))}
            </optgroup>
          ) : (
            <NativeOption key={`option-${item.value}`} option={item} />
          ),
        )}
      </select>

      {enhanced && (
        <>
          <div
            ref={popup}
            hidden={!state.open}
            className={cn(
              "absolute inset-x-0 z-30 overflow-y-auto overscroll-contain rounded-md border border-line-strong bg-surface py-1 shadow-lg",
              placement.above ? "bottom-full mb-1" : "top-full mt-1",
            )}
            style={{ maxHeight: placement.maxHeight }}
            // Keep focus in the text field while the list is clicked or scrolled.
            onMouseDown={(event) => event.preventDefault()}
            onScroll={(event) => {
              const list = event.currentTarget;
              if (hidden > 0 && list.scrollTop + list.clientHeight >= list.scrollHeight - 88) send({ type: "more" });
            }}
          >
            <div id={listId} role="listbox" aria-label={labelText ?? ariaLabel ?? "Options"}>
              {state.open &&
                sections.map((section) => {
                  const rows = section.options.map(({ option, index }) => {
                    const isSelected = option.value === value;
                    return (
                      <div
                        key={`${option.value}-${index}`}
                        id={optionId(index)}
                        role="option"
                        data-index={index}
                        aria-selected={isSelected}
                        aria-disabled={option.disabled || undefined}
                        className={cn(
                          "flex min-h-11 items-center gap-2 py-2 pr-3 text-base leading-snug",
                          section.label === undefined ? "pl-3" : "pl-5",
                          option.disabled ? "cursor-not-allowed text-subtle" : "cursor-pointer text-ink hover:bg-soft",
                          index === active && "bg-primary-soft shadow-[inset_3px_0_0_var(--rp-color-primary-base)] hover:bg-primary-soft",
                          isSelected && "font-semibold",
                        )}
                        onClick={() => {
                          if (option.disabled) return;
                          pick(option.value);
                          input.current?.focus();
                        }}
                      >
                        <span className="min-w-0 flex-1 wrap-break-word">
                          {option.label}
                          {option.secondary && <span className="font-normal text-muted"> {option.secondary}</span>}
                        </span>
                        {isSelected && <Check className="size-4 shrink-0 text-primary-ink" aria-hidden="true" />}
                      </div>
                    );
                  });
                  if (section.label === undefined) return rows;
                  const headingId = `${id}-group-${section.key}-${section.options[0].index}`;
                  return (
                    <div key={`${section.key}-${section.options[0].index}`} role="group" aria-labelledby={headingId}>
                      <div id={headingId} role="presentation" className="px-3 pb-1 pt-3 text-sm font-semibold text-muted">
                        {section.label}
                      </div>
                      {rows}
                    </div>
                  );
                })}
            </div>
            {state.open && matches.length === 0 && <p className="flex min-h-11 items-center px-3 text-base text-muted">No matches</p>}
            {state.open && hidden > 0 && (
              <p className="flex min-h-11 items-center border-t border-line px-3 text-sm text-muted">
                Keep typing to narrow the list
              </p>
            )}
          </div>
          <span role="status" className="sr-only">
            {status}
          </span>
        </>
      )}
    </div>
  );
}

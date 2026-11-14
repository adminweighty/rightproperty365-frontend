/**
 * The logic of `SearchableSelect` (src/components/ui/searchable-select.tsx)
 * as pure functions: flattening options, matching what was typed, splitting
 * the matches into groups, and the keyboard state machine. Nothing here
 * touches the DOM, so it is checked by `npm test`
 * (scripts/searchable-select.test.mjs).
 *
 * This file must stay free of imports and of TypeScript-only syntax that is
 * not erasable: Node runs it directly for the tests.
 */

export type SelectOption = {
  value: string;
  label: string;
  /** Shown after the label in a quieter colour, and searched: a count "(6)", a country code. */
  secondary?: string;
  /** Other words that find this option: a former name, an abbreviation. Never shown. */
  keywords?: string[];
  disabled?: boolean;
};

/** Options under a heading; rendered as an `<optgroup>` and as a `role="group"`. */
export type SelectGroup = { label: string; options: SelectOption[] };

export type SelectItem = SelectOption | SelectGroup;

export const isGroup = (item: SelectItem): item is SelectGroup => "options" in item;

/** An option with what is needed to show and to find it. */
export type FlatOption = SelectOption & {
  /** The label of the group it is in, when it is in one. */
  group?: string;
  /** Which group of the list it is in (-1 for none), so two groups with one label stay apart. */
  groupIndex: number;
  /** Label and secondary text as one string: what the native option and the field show. */
  text: string;
  /** Everything that is searched, normalised. */
  haystack: string;
};

/** How many matches are rendered at first, and how many more each time the end is reached. */
export const PAGE_SIZE = 100;

/** Lower case, without diacritics, single spaces: "São  Tomé" becomes "sao tome". */
export function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** "Harare (6)": the label with its secondary text. */
export const optionText = ({ label, secondary }: SelectOption) => (secondary ? `${label} ${secondary}` : label);

/** Every option in order, each knowing its group. */
export function flattenOptions(items: SelectItem[]): FlatOption[] {
  const flat: FlatOption[] = [];
  const add = (option: SelectOption, group: string | undefined, groupIndex: number) =>
    flat.push({
      ...option,
      group,
      groupIndex,
      text: optionText(option),
      haystack: normalise([option.label, option.secondary, ...(option.keywords ?? []), group].filter(Boolean).join(" ")),
    });
  items.forEach((item, index) => {
    if (isGroup(item)) item.options.forEach((option) => add(option, item.label, index));
    else add(item, undefined, -1);
  });
  return flat;
}

/**
 * The options that match what was typed, in their original order. Every word
 * typed must appear somewhere in the option's label, secondary text, keywords
 * or group heading. Nothing typed matches everything.
 */
export function filterOptions(options: FlatOption[], query: string | null): FlatOption[] {
  const words = normalise(query ?? "").split(" ").filter(Boolean);
  if (words.length === 0) return options;
  return options.filter((option) => words.every((word) => option.haystack.includes(word)));
}

export type Section = {
  /** The group's heading; undefined for options outside a group. */
  label?: string;
  key: string;
  /** Each option with its index among the matches. */
  options: { option: FlatOption; index: number }[];
};

/**
 * The first `limit` matches split into runs that share a group, so each run
 * is rendered under its heading. `hidden` is how many matches are beyond the
 * limit.
 */
export function toSections(matches: FlatOption[], limit: number): { sections: Section[]; hidden: number } {
  const sections: Section[] = [];
  const shown = Math.min(matches.length, Math.max(0, limit));
  for (let index = 0; index < shown; index += 1) {
    const option = matches[index];
    const last = sections[sections.length - 1];
    const key = `${option.groupIndex}`;
    if (last && last.key === key) last.options.push({ option, index });
    else sections.push({ label: option.group, key, options: [{ option, index }] });
  }
  return { sections, hidden: matches.length - shown };
}

/** The value a native select shows for `value`: itself when it is an option, else the first enabled option. */
export function effectiveValue(options: FlatOption[], value: string | undefined): string {
  if (value !== undefined && options.some((option) => option.value === value)) return value;
  return options.find((option) => !option.disabled)?.value ?? "";
}

export type ComboState = {
  open: boolean;
  /** What was typed; null while the field shows the selected option. */
  query: string | null;
  /** Index of the active option among the matches; -1 for none. */
  active: number;
  /** True once the arrow keys (or Home/End) moved the active option. Tab commits only then. */
  navigated: boolean;
  /** How many matches are rendered. */
  limit: number;
};

export type ComboAction =
  | { type: "open" }
  | { type: "close" }
  /** Close and forget what was typed, so the field shows the selected option again. */
  | { type: "reset" }
  | { type: "type"; text: string }
  | { type: "move"; delta: 1 | -1 }
  | { type: "first" }
  | { type: "last" }
  /** Render another page of matches. */
  | { type: "more" };

export const closedState: ComboState = { open: false, query: null, active: -1, navigated: false, limit: PAGE_SIZE };

/** Enough pages to render the option at `index`. */
const limitFor = (index: number, current = PAGE_SIZE) =>
  Math.max(current, (Math.floor(Math.max(index, 0) / PAGE_SIZE) + 1) * PAGE_SIZE);

/** The nearest enabled option from `from` in direction `step`, or -1. */
function seek(matches: FlatOption[], from: number, step: 1 | -1): number {
  for (let index = from; index >= 0 && index < matches.length; index += step) {
    if (!matches[index].disabled) return index;
  }
  return -1;
}

/**
 * The keyboard and pointer state machine of the combobox.
 *
 * - Opening puts the active option on the selected one.
 * - Typing opens the list and makes the first match active, so Enter takes it.
 * - Arrow keys move through enabled options without wrapping, and render
 *   further pages as they go, so every option can be reached.
 * - Closing keeps what was typed (Escape pressed again resets it).
 */
export function comboReducer(
  state: ComboState,
  action: ComboAction,
  options: FlatOption[],
  value: string,
): ComboState {
  const matches = filterOptions(options, state.query);
  const selected = () => matches.findIndex((option) => option.value === value && !option.disabled);
  const at = (active: number, navigated: boolean): ComboState => ({
    ...state,
    open: true,
    active,
    navigated,
    limit: limitFor(active, state.open ? state.limit : PAGE_SIZE),
  });

  switch (action.type) {
    case "open":
      return state.open ? state : at(selected(), false);
    case "close":
      return { ...closedState, query: state.query };
    case "reset":
      return closedState;
    case "type": {
      const next = filterOptions(options, action.text);
      const active = normalise(action.text) === "" ? -1 : seek(next, 0, 1);
      return { open: true, query: action.text, active, navigated: false, limit: PAGE_SIZE };
    }
    case "move": {
      if (!state.open) {
        const start = selected();
        return at(start >= 0 ? start : seek(matches, action.delta > 0 ? 0 : matches.length - 1, action.delta), true);
      }
      if (state.active < 0) return at(seek(matches, action.delta > 0 ? 0 : matches.length - 1, action.delta), true);
      const next = seek(matches, state.active + action.delta, action.delta);
      return at(next >= 0 ? next : state.active, true);
    }
    case "first":
      return at(seek(matches, 0, 1), true);
    case "last":
      return at(seek(matches, matches.length - 1, -1), true);
    case "more":
      return state.limit >= matches.length ? state : { ...state, limit: state.limit + PAGE_SIZE };
  }
}

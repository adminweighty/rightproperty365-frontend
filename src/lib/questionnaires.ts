/**
 * Questionnaires and applications (API 0.32.0, FR-015, FR-017 to FR-019,
 * BR-010): the rules the web repeats so people find problems before they send
 * anything. The API stays the authority on every one of them.
 *
 * - Form definitions: field types, keys, the `visible_if` rule, options, file
 *   types and the checks the API runs on a definition (keys unique,
 *   `visible_if` only on an earlier question, choices need two options, file
 *   types from the platform allowlist, retention 30 to 3650 days).
 * - Answers: which questions are shown (`visible_if`, honoured in a chain),
 *   one answer checked against its question, and the check before a submit
 *   (a hidden question is never required, and its answer is dropped).
 * - Application statuses: words, tones and the allowed transitions.
 *
 * Pure functions with no imports, so `npm test`
 * (scripts/questionnaires.test.mjs) runs them directly. This file must stay
 * free of imports and of TypeScript-only syntax that is not erasable.
 */

// ---- Form definitions ---------------------------------------------------------------

export const FIELD_TYPES = [
  "short_text",
  "long_text",
  "number",
  "date",
  "single_choice",
  "multiple_choice",
  "file",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  short_text: "Short answer",
  long_text: "Long answer",
  number: "Number",
  date: "Date",
  single_choice: "One choice",
  multiple_choice: "Several choices",
  file: "File upload",
};

export const isFieldType = (value: unknown): value is FieldType =>
  typeof value === "string" && (FIELD_TYPES as readonly string[]).includes(value);

export const isChoiceType = (type: string) => type === "single_choice" || type === "multiple_choice";
export const isTextType = (type: string) => type === "short_text" || type === "long_text";

export type FieldOption = { value: string; label: string };

/** Shown when `field`'s answer equals `equals`, or is one of `in`. */
export type VisibleIf = { field: string; equals?: string | number | boolean; in?: (string | number | boolean)[] };

export type FormField = {
  key: string;
  type: FieldType;
  label: string;
  help?: string | null;
  required: boolean;
  options?: FieldOption[] | null;
  /** number: the smallest value; multiple_choice: the fewest choices. */
  min?: number | null;
  /** number: the largest value; multiple_choice: the most choices. */
  max?: number | null;
  /** date only: the earliest and latest day, YYYY-MM-DD. */
  min_date?: string | null;
  max_date?: string | null;
  min_length?: number | null;
  max_length?: number | null;
  /** file only: extensions from the platform allowlist. */
  accept?: string[] | null;
  max_files?: number | null;
  visible_if?: VisibleIf | null;
};

export type FormSection = { key: string; title: string; description?: string | null; fields: FormField[] };

export type FormStatus = "DRAFT" | "PUBLISHED" | "RETIRED";

/** The parts of a form the builder edits and the renderer shows. */
export type FormDefinition = {
  name: string;
  market_code: string;
  purpose: string;
  privacy_notice: string;
  retention_days: number | null;
  expires_at?: string | null;
  sections: FormSection[];
};

/** The platform's allowlist of file types (FR-018), as extensions. */
export const FILE_TYPES = ["pdf", "jpg", "png", "webp", "heic", "docx"] as const;
export type FileTypeCode = (typeof FILE_TYPES)[number];

export const FILE_TYPE_LABELS: Record<FileTypeCode, string> = {
  pdf: "PDF",
  jpg: "JPEG",
  png: "PNG",
  webp: "WebP",
  heic: "HEIC",
  docx: "Word (.docx)",
};

const FILE_MIME: Record<FileTypeCode, string[]> = {
  pdf: ["application/pdf"],
  jpg: ["image/jpeg"],
  png: ["image/png"],
  webp: ["image/webp"],
  heic: ["image/heic", "image/heif"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
};

const FILE_EXTENSIONS: Record<FileTypeCode, string[]> = {
  pdf: ["pdf"],
  jpg: ["jpg", "jpeg"],
  png: ["png"],
  webp: ["webp"],
  heic: ["heic", "heif"],
  docx: ["docx"],
};

/** The platform caps: 10 MB a file, 5 files a question. */
export const FILE_MAX_BYTES = 10 * 1024 * 1024;
export const FILES_MAX = 5;

export const RETENTION_MIN = 30;
export const RETENTION_MAX = 3650;

export const NAME_MAX = 120;
export const LABEL_MAX = 200;
/** The API's defaults and caps of an answer's length: short 200 (at most 500), long 5000 (at most 10000). */
export const SHORT_TEXT_DEFAULT = 200;
export const SHORT_TEXT_CAP = 500;
export const LONG_TEXT_DEFAULT = 5000;
export const LONG_TEXT_CAP = 10000;

/** The longest answer a text question takes. */
export function maxLengthFor(field: Pick<FormField, "type" | "max_length">): number {
  const short = field.type === "short_text";
  const value = Number(field.max_length);
  const cap = short ? SHORT_TEXT_CAP : LONG_TEXT_CAP;
  return Number.isInteger(value) && value > 0 ? Math.min(value, cap) : short ? SHORT_TEXT_DEFAULT : LONG_TEXT_DEFAULT;
}

/** A date question's earliest and latest day. */
export function dateLimits(field: Pick<FormField, "min_date" | "max_date">): { min: string | null; max: string | null } {
  const min = typeof field.min_date === "string" && isDay(field.min_date) ? field.min_date : null;
  const max = typeof field.max_date === "string" && isDay(field.max_date) ? field.max_date : null;
  return { min, max };
}

/** The `accept` of a file question, or every allowed type when it names none. */
export function acceptedTypes(field: Pick<FormField, "accept">): FileTypeCode[] {
  const wanted = (field.accept ?? []).map((item) => String(item).toLowerCase().replace(/^\./, ""));
  const known = FILE_TYPES.filter((code) => wanted.includes(code) || (code === "jpg" && wanted.includes("jpeg")));
  return known.length > 0 ? known : [...FILE_TYPES];
}

/** For `<input type="file" accept>`. */
export function acceptAttribute(field: Pick<FormField, "accept">): string {
  return acceptedTypes(field)
    .flatMap((code) => [...FILE_EXTENSIONS[code].map((ext) => `.${ext}`), ...FILE_MIME[code]])
    .join(",");
}

/** "PDF, JPEG or PNG". */
export function acceptedTypesText(field: Pick<FormField, "accept">): string {
  const labels = acceptedTypes(field).map((code) => FILE_TYPE_LABELS[code]);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`;
}

/** The most files a question takes: its own `max_files`, never above the platform cap. */
export function maxFilesFor(field: Pick<FormField, "max_files">): number {
  const value = Number(field.max_files);
  return Number.isInteger(value) && value >= 1 ? Math.min(value, FILES_MAX) : 1;
}

export type FileLike = { name: string; type: string; size: number };

/** "3.2 MB", "820 KB". */
export function fileSizeText(bytes: number): string {
  if (!(bytes > 0)) return "0 KB";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Why a file cannot be uploaded to a question, in words, or null. Some
 * systems give no type for a file: its name decides then. The API checks the
 * content again and its message is what is shown.
 */
export function fileProblem(file: FileLike, field: Pick<FormField, "accept">): string | null {
  const types = acceptedTypes(field);
  const extension = (/\.([a-z0-9]+)$/i.exec(file.name)?.[1] ?? "").toLowerCase();
  const byType = file.type ? types.some((code) => FILE_MIME[code].includes(file.type)) : false;
  const byName = types.some((code) => FILE_EXTENSIONS[code].includes(extension));
  if (!byType && !byName) {
    return `${file.name} is not a ${acceptedTypesText(field)} file. Choose a file in one of those formats.`;
  }
  if (file.size === 0) return `${file.name} is empty. Choose another file.`;
  if (file.size > FILE_MAX_BYTES) {
    return `${file.name} is ${fileSizeText(file.size)}. Choose a file of 10 MB or less.`;
  }
  return null;
}

/** "Do you have pets?" -> "do_you_have_pets". Lower case letters, digits and underscores, at most 40. */
export function keyFromLabel(label: string): string {
  const key = label
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
    .replace(/_+$/g, "");
  if (!key) return "question";
  return /^[a-z]/.test(key) ? key : `q_${key}`.slice(0, 40);
}

export const KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;

/** `base`, or `base_2`, `base_3`… the first one not taken. */
export function uniqueKey(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base.slice(0, 36)}_${n}`;
    if (!used.has(candidate)) return candidate;
  }
}

/** Every key of the form's questions, in order. */
export function allFields(form: Pick<FormDefinition, "sections">): FormField[] {
  return form.sections.flatMap((section) => section.fields);
}

/** Every key used by a section or a question. */
export function usedKeys(form: Pick<FormDefinition, "sections">): string[] {
  return form.sections.flatMap((section) => [section.key, ...section.fields.map((field) => field.key)]);
}

/** A new question of a type, with a key no other question or section uses. */
export function newField(type: FieldType, taken: Iterable<string>, label = ""): FormField {
  const key = uniqueKey(keyFromLabel(label || FIELD_TYPE_LABELS[type]), taken);
  const field: FormField = { key, type, label, required: false };
  if (isChoiceType(type)) {
    field.options = [
      { value: "option_1", label: "Option 1" },
      { value: "option_2", label: "Option 2" },
    ];
  }
  if (type === "file") {
    field.accept = ["pdf", "jpg", "png"];
    field.max_files = 1;
  }
  return field;
}

export function newSection(taken: Iterable<string>, title = ""): FormSection {
  return { key: uniqueKey(keyFromLabel(title || "section"), taken), title, description: "", fields: [] };
}

/** A copy of the list with the item at `from` moved to `to` (clamped). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from < 0 || from >= next.length) return next;
  const target = Math.max(0, Math.min(next.length - 1, to));
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
}

/**
 * A question changed to another type keeps its key, label, help, required
 * and `visible_if`, and gets the settings of the new type.
 */
export function changeFieldType(field: FormField, type: FieldType): FormField {
  const next: FormField = {
    key: field.key,
    type,
    label: field.label,
    help: field.help,
    required: field.required,
    visible_if: field.visible_if,
  };
  if (isChoiceType(type)) {
    next.options =
      field.options && field.options.length > 0
        ? field.options
        : [
            { value: "option_1", label: "Option 1" },
            { value: "option_2", label: "Option 2" },
          ];
  }
  if (type === "file") {
    next.accept = field.accept ?? ["pdf", "jpg", "png"];
    next.max_files = field.max_files ?? 1;
  }
  if (isTextType(type)) {
    next.min_length = field.min_length ?? null;
    next.max_length = field.max_length ?? null;
  }
  if (type === "number" || type === "multiple_choice") {
    next.min = field.type === "number" || field.type === "multiple_choice" ? (field.min ?? null) : null;
    next.max = field.type === "number" || field.type === "multiple_choice" ? (field.max ?? null) : null;
  }
  if (type === "date") {
    next.min_date = field.min_date ?? null;
    next.max_date = field.max_date ?? null;
  }
  return next;
}

/**
 * The questions a `visible_if` of the question at `key` may name: choice
 * questions before it in the form. (The API takes any earlier question; the
 * builder offers the ones whose answers can be picked from a list.)
 */
export function visibleIfCandidates(form: Pick<FormDefinition, "sections">, key: string): FormField[] {
  const fields = allFields(form);
  const index = fields.findIndex((field) => field.key === key);
  const earlier = index < 0 ? fields : fields.slice(0, index);
  return earlier.filter((field) => isChoiceType(field.type));
}

/** The values a `visible_if` accepts, as a list. */
export function visibleIfValues(rule: VisibleIf | null | undefined): string[] {
  if (!rule) return [];
  if (Array.isArray(rule.in)) return rule.in.map(String);
  if (rule.equals !== undefined && rule.equals !== null) return [String(rule.equals)];
  return [];
}

/** One value is `equals`, several are `in`, none removes the rule. */
export function makeVisibleIf(field: string, values: string[]): VisibleIf | null {
  if (!field || values.length === 0) return null;
  return values.length === 1 ? { field, equals: values[0] } : { field, in: values };
}

export type DefinitionProblem = {
  /** Where it is: "form.name", "section.<i>", "field.<key>" or "field.<key>.options". */
  path: string;
  message: string;
};

const blank = (value: unknown) => typeof value !== "string" || value.trim() === "";

/**
 * The problems the API would refuse a definition for, in the builder's words,
 * in form order. Empty when it can be published.
 */
export function definitionProblems(form: FormDefinition): DefinitionProblem[] {
  const problems: DefinitionProblem[] = [];
  if (blank(form.name)) problems.push({ path: "form.name", message: "Give the form a name." });
  if (blank(form.market_code)) problems.push({ path: "form.market_code", message: "Choose the country the form is for." });
  if (blank(form.purpose)) problems.push({ path: "form.purpose", message: "Say what the answers are used for." });
  if (blank(form.privacy_notice)) problems.push({ path: "form.privacy_notice", message: "Write the privacy notice applicants read first." });
  const retention = Number(form.retention_days);
  if (form.retention_days === null || !Number.isInteger(retention) || retention < RETENTION_MIN || retention > RETENTION_MAX) {
    problems.push({ path: "form.retention_days", message: `Keep answers for ${RETENTION_MIN} to ${RETENTION_MAX} days.` });
  }
  if (form.sections.length === 0 || allFields(form).length === 0) {
    problems.push({ path: "form.sections", message: "Add at least one question." });
  }

  const seen = new Set<string>();
  const earlier = new Map<string, FormField>();
  form.sections.forEach((section, index) => {
    if (blank(section.title)) problems.push({ path: `section.${index}`, message: `Give section ${index + 1} a title.` });
    if (seen.has(section.key)) problems.push({ path: `section.${index}`, message: `Section ${index + 1} uses a key that is already taken.` });
    seen.add(section.key);
    for (const field of section.fields) {
      const name = field.label.trim() ? `“${field.label.trim()}”` : "A question";
      const at = `field.${field.key}`;
      if (blank(field.label)) problems.push({ path: at, message: `Give every question a label (one in “${section.title || `section ${index + 1}`}” has none).` });
      if (!KEY_PATTERN.test(field.key)) {
        problems.push({ path: `${at}.key`, message: `${name}: the key must start with a letter and use only a to z, 0 to 9 and _ (at most 40).` });
      } else if (seen.has(field.key)) {
        problems.push({ path: `${at}.key`, message: `${name}: another question or section already uses the key ${field.key}.` });
      }
      seen.add(field.key);
      if (isChoiceType(field.type)) {
        const options = field.options ?? [];
        if (options.length < 2) problems.push({ path: `${at}.options`, message: `${name} needs at least 2 choices.` });
        const values = new Set<string>();
        for (const option of options) {
          if (blank(option.label)) problems.push({ path: `${at}.options`, message: `${name}: every choice needs words.` });
          if (blank(option.value) || values.has(option.value)) {
            problems.push({ path: `${at}.options`, message: `${name}: two choices have the same value.` });
          }
          values.add(option.value);
        }
      }
      if (field.type === "file") {
        const wanted = (field.accept ?? []).map((item) => String(item).toLowerCase().replace(/^\./, ""));
        const outside = wanted.filter((item) => !(FILE_TYPES as readonly string[]).includes(item));
        if (outside.length > 0) problems.push({ path: `${at}.accept`, message: `${name}: ${outside.join(", ")} cannot be accepted. Choose from ${FILE_TYPES.join(", ")}.` });
        if (wanted.length === 0) problems.push({ path: `${at}.accept`, message: `${name}: choose at least one file type.` });
        const most = Number(field.max_files ?? 1);
        if (!Number.isInteger(most) || most < 1 || most > FILES_MAX) problems.push({ path: `${at}.max_files`, message: `${name}: take 1 to ${FILES_MAX} files.` });
      }
      const min = numberOrNull(field.min);
      const max = numberOrNull(field.max);
      if ((field.type === "number" || field.type === "multiple_choice") && min !== null && max !== null && min > max) {
        problems.push({ path: `${at}.min`, message: `${name}: the smallest value is above the largest.` });
      }
      if (field.type === "multiple_choice" && max !== null && max > (field.options ?? []).length) {
        problems.push({ path: `${at}.max`, message: `${name}: it cannot ask for more choices than it offers.` });
      }
      if (field.type === "date") {
        const days = dateLimits(field);
        if (days.min && days.max && days.min > days.max) problems.push({ path: `${at}.min`, message: `${name}: the earliest day is after the latest.` });
      }
      if (isTextType(field.type)) {
        const cap = field.type === "short_text" ? SHORT_TEXT_CAP : LONG_TEXT_CAP;
        const longest = numberOrNull(field.max_length);
        if (longest !== null && (longest < 1 || longest > cap)) problems.push({ path: `${at}.max_length`, message: `${name}: the longest answer can be 1 to ${cap} characters.` });
      }
      const minLength = numberOrNull(field.min_length);
      const maxLength = numberOrNull(field.max_length);
      if (minLength !== null && maxLength !== null && minLength > maxLength) {
        problems.push({ path: `${at}.min_length`, message: `${name}: the shortest answer is longer than the longest.` });
      }
      if (field.visible_if) {
        const target = earlier.get(field.visible_if.field);
        const values = visibleIfValues(field.visible_if);
        if (!target) {
          problems.push({ path: `${at}.visible_if`, message: `${name} is shown depending on a question that does not come before it.` });
        } else if (!isChoiceType(target.type)) {
          problems.push({ path: `${at}.visible_if`, message: `${name} can depend only on a question with choices.` });
        } else if (values.length === 0) {
          problems.push({ path: `${at}.visible_if`, message: `${name}: choose the answer that shows it.` });
        } else if (values.some((value) => !(target.options ?? []).some((option) => option.value === value))) {
          problems.push({ path: `${at}.visible_if`, message: `${name} depends on an answer that “${target.label || target.key}” no longer offers.` });
        }
      }
      earlier.set(field.key, field);
    }
  });
  return problems;
}

const numberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

// ---- Answers ------------------------------------------------------------------------

export type AnswerValue = string | number | boolean | string[] | null;
export type Answers = Record<string, AnswerValue | undefined>;

const isEmpty = (value: AnswerValue | undefined) =>
  value === undefined ||
  value === null ||
  (typeof value === "string" && value.trim() === "") ||
  (Array.isArray(value) && value.length === 0);

function matches(value: AnswerValue | undefined, wanted: string[]): boolean {
  if (isEmpty(value)) return false;
  if (Array.isArray(value)) return value.some((item) => wanted.includes(String(item)));
  return wanted.includes(String(value));
}

/**
 * The keys of the questions that are shown with these answers. A question
 * whose `visible_if` names a hidden question is hidden too, so a chain of
 * conditions is honoured. A rule naming a question that is not earlier in
 * the form hides the question (the API refuses such a form).
 */
export function visibleKeys(form: Pick<FormDefinition, "sections">, answers: Answers): Set<string> {
  const shown = new Set<string>();
  const before = new Set<string>();
  for (const field of allFields(form)) {
    const rule = field.visible_if;
    const visible = !rule || (before.has(rule.field) && shown.has(rule.field) && matches(answers[rule.field], visibleIfValues(rule)));
    if (visible) shown.add(field.key);
    before.add(field.key);
  }
  return shown;
}

export const isFieldVisible = (form: Pick<FormDefinition, "sections">, answers: Answers, key: string) =>
  visibleKeys(form, answers).has(key);

/** The answers without those of hidden questions: what a submit keeps. */
export function keptAnswers(form: Pick<FormDefinition, "sections">, answers: Answers): Answers {
  const shown = visibleKeys(form, answers);
  const kept: Answers = {};
  for (const field of allFields(form)) {
    if (shown.has(field.key) && answers[field.key] !== undefined) kept[field.key] = answers[field.key];
  }
  return kept;
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDay(value: string): boolean {
  const match = DAY.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** "2026-11-30" -> "30 November 2026". */
export function dayText(value: string): string {
  if (!isDay(value)) return value;
  const [year, month, day] = value.split("-").map(Number);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${day} ${months[month - 1]} ${year}`;
}

/**
 * What is wrong with one answer, in words, or null. A missing answer is not
 * a problem here (drafts may be incomplete); `submitProblems` adds "required".
 * Mirrors the API's per-field rules.
 */
export function answerProblem(field: FormField, value: AnswerValue | undefined): string | null {
  if (isEmpty(value)) return null;
  const label = field.label.trim() || "This question";
  switch (field.type) {
    case "short_text":
    case "long_text": {
      if (typeof value !== "string") return `Enter ${label.toLowerCase()} as text.`;
      const length = value.trim().length;
      const min = numberOrNull(field.min_length);
      const max = maxLengthFor(field);
      if (min !== null && length < min) return `Write at least ${min} characters.`;
      if (length > max) return `Write at most ${max} characters.`;
      return null;
    }
    case "number": {
      const number = typeof value === "number" ? value : Number(String(value).trim().replace(/,/g, ""));
      if (typeof value === "boolean" || Array.isArray(value) || !Number.isFinite(number)) return "Enter a number, using digits.";
      const min = numberOrNull(field.min);
      const max = numberOrNull(field.max);
      if (min !== null && number < min) return `Enter ${min} or more.`;
      if (max !== null && number > max) return `Enter ${max} or less.`;
      return null;
    }
    case "date": {
      if (typeof value !== "string" || !isDay(value)) return "Enter a real date.";
      const days = dateLimits(field);
      if (days.min && value < days.min) return `Choose ${dayText(days.min)} or later.`;
      if (days.max && value > days.max) return `Choose ${dayText(days.max)} or earlier.`;
      return null;
    }
    case "single_choice": {
      const values = (field.options ?? []).map((option) => option.value);
      if (Array.isArray(value) || !values.includes(String(value))) return "Choose one of the answers.";
      return null;
    }
    case "multiple_choice": {
      const values = (field.options ?? []).map((option) => option.value);
      const chosen = Array.isArray(value) ? value : [String(value)];
      if (chosen.some((item) => !values.includes(String(item)))) return "Choose from the answers given.";
      const min = numberOrNull(field.min);
      const max = numberOrNull(field.max);
      if (min !== null && chosen.length < min) return `Choose at least ${min}.`;
      if (max !== null && chosen.length > max) return `Choose at most ${max}.`;
      return null;
    }
    case "file": {
      const files = Array.isArray(value) ? value : [String(value)];
      const most = maxFilesFor(field);
      if (files.length > most) return most === 1 ? "Attach one file only." : `Attach at most ${most} files.`;
      return null;
    }
    default:
      return null;
  }
}

/** "Answer “Do you have pets?”" or "Attach …" for a required question that has no answer. */
export function requiredMessage(field: FormField): string {
  const label = field.label.trim() || "this question";
  if (field.type === "file") return `Attach ${field.max_files && field.max_files > 1 ? "a file" : "the file"} for “${label}”.`;
  if (isChoiceType(field.type)) return `Choose an answer to “${label}”.`;
  return `Answer “${label}”.`;
}

/**
 * The problems that stop a submit, by question key, in form order: required
 * questions that are shown and have no answer, and answers that break their
 * question's rules. Hidden questions are never checked.
 */
export function submitProblems(form: Pick<FormDefinition, "sections">, answers: Answers): Record<string, string> {
  const shown = visibleKeys(form, answers);
  const problems: Record<string, string> = {};
  for (const field of allFields(form)) {
    if (!shown.has(field.key)) continue;
    const value = answers[field.key];
    if (isEmpty(value)) {
      if (field.required) problems[field.key] = requiredMessage(field);
      continue;
    }
    const problem = answerProblem(field, value);
    if (problem) problems[field.key] = problem;
  }
  return problems;
}

/** An answer as words, for the review step and the read-only views. */
export function answerText(field: FormField, value: AnswerValue | undefined): string {
  if (isEmpty(value)) return "";
  const label = (code: string) => (field.options ?? []).find((option) => option.value === code)?.label ?? code;
  if (field.type === "single_choice") return label(String(value));
  if (field.type === "multiple_choice") return (Array.isArray(value) ? value : [String(value)]).map(label).join(", ");
  if (field.type === "date" && typeof value === "string") return dayText(value);
  if (field.type === "file") {
    const count = Array.isArray(value) ? value.length : 1;
    return count === 1 ? "1 file" : `${count} files`;
  }
  return String(value);
}

/** A number box's text as the API takes it: a number, or null when empty, or the text itself to be refused. */
export function numberAnswer(text: string): number | string | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const number = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(number) ? number : trimmed;
}

// ---- Application statuses -----------------------------------------------------------

export const APPLICATION_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "MORE_INFO",
  "SHORTLISTED",
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const isApplicationStatus = (value: unknown): value is ApplicationStatus =>
  typeof value === "string" && (APPLICATION_STATUSES as readonly string[]).includes(value);

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "In review",
  MORE_INFO: "More information needed",
  SHORTLISTED: "Shortlisted",
  ACCEPTED: "Accepted",
  REJECTED: "Not successful",
  WITHDRAWN: "Withdrawn",
};

type Tone = "neutral" | "primary" | "accent" | "success" | "warning" | "danger" | "info";

const STATUS_TONES: Record<ApplicationStatus, Tone> = {
  DRAFT: "neutral",
  SUBMITTED: "info",
  UNDER_REVIEW: "primary",
  MORE_INFO: "warning",
  SHORTLISTED: "accent",
  ACCEPTED: "success",
  REJECTED: "danger",
  WITHDRAWN: "neutral",
};

/** The API's words when it sends them, else ours, else the code made readable. */
export function applicationStatusLabel(status: string, apiLabel?: string | null): string {
  if (apiLabel) return apiLabel;
  if (isApplicationStatus(status)) return APPLICATION_STATUS_LABELS[status];
  const words = status.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const applicationStatusTone = (status: string): Tone => (isApplicationStatus(status) ? STATUS_TONES[status] : "neutral");

/** The applicant's view of each status, in one line. */
export const APPLICANT_STATUS_EXPLAINED: Record<ApplicationStatus, string> = {
  DRAFT: "Not sent yet. Your answers are saved as you go.",
  SUBMITTED: "Sent. The advertiser has not started reviewing it yet.",
  UNDER_REVIEW: "The advertiser is reviewing your application.",
  MORE_INFO: "The advertiser has asked for more information. Answer and send it again.",
  SHORTLISTED: "You are on the advertiser's shortlist.",
  ACCEPTED: "The advertiser accepted your application. They will contact you about next steps.",
  REJECTED: "The advertiser did not take your application further.",
  WITHDRAWN: "You withdrew this application.",
};

export const FINAL_STATUSES: readonly ApplicationStatus[] = ["ACCEPTED", "REJECTED", "WITHDRAWN"];

export const isFinalStatus = (status: string) => (FINAL_STATUSES as readonly string[]).includes(status);

const TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  DRAFT: ["SUBMITTED", "WITHDRAWN"],
  SUBMITTED: ["UNDER_REVIEW", "MORE_INFO", "SHORTLISTED", "ACCEPTED", "REJECTED", "WITHDRAWN"],
  UNDER_REVIEW: ["MORE_INFO", "SHORTLISTED", "ACCEPTED", "REJECTED", "WITHDRAWN"],
  MORE_INFO: ["SUBMITTED", "WITHDRAWN"],
  SHORTLISTED: ["ACCEPTED", "REJECTED", "WITHDRAWN"],
  ACCEPTED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

/** Every status an application may move to from `status`, by anyone. */
export function allowedTransitions(status: string): ApplicationStatus[] {
  return isApplicationStatus(status) ? [...TRANSITIONS[status]] : [];
}

export const canTransition = (from: string, to: string) => (allowedTransitions(from) as string[]).includes(to);

/** The statuses `POST …/status` takes. MORE_INFO goes through request-info; WITHDRAWN is the applicant's. */
export const AGENT_STATUS_TARGETS: readonly ApplicationStatus[] = ["UNDER_REVIEW", "SHORTLISTED", "ACCEPTED", "REJECTED"];

/**
 * The status moves the receiving organisation may make from `status`, in
 * order. `apiAllowed`, when the API sends a list, wins (filtered to what the
 * status endpoint takes).
 */
export function agentStatusActions(status: string, apiAllowed?: readonly string[] | null): ApplicationStatus[] {
  const allowed = apiAllowed && apiAllowed.length > 0 ? apiAllowed : allowedTransitions(status);
  return AGENT_STATUS_TARGETS.filter((target) => allowed.includes(target));
}

/** Whether the organisation may ask for more information now. */
export const canRequestInfo = (status: string, apiAllowed?: readonly string[] | null) =>
  (apiAllowed && apiAllowed.length > 0 ? apiAllowed : allowedTransitions(status)).includes("MORE_INFO");

/** The applicant edits answers in DRAFT and MORE_INFO only. */
export const applicantCanEdit = (status: string) => status === "DRAFT" || status === "MORE_INFO";

/** Any status that is not final can be withdrawn by the applicant. */
export const applicantCanWithdraw = (status: string) => isApplicationStatus(status) && !isFinalStatus(status);

/** The agent's buttons. */
export const AGENT_ACTION_LABELS: Record<string, string> = {
  UNDER_REVIEW: "Start the review",
  SHORTLISTED: "Shortlist",
  ACCEPTED: "Accept",
  REJECTED: "Decline",
};

// ---- Intake ---------------------------------------------------------------------------

export type IntakeStatus = "OPEN" | "PAUSED" | "CLOSED" | "NONE";

export const INTAKE_LABELS: Record<IntakeStatus, string> = {
  OPEN: "Open: taking applications",
  PAUSED: "Paused: not taking applications for now",
  CLOSED: "Closed: no more applications",
  NONE: "No application form",
};

/** Why an `APPLICATIONS_CLOSED` happened, from its message, for the right heading. */
export function closedKind(message: string | null | undefined, reason?: string | null): "paused" | "expired" | "closed" {
  if (reason === "PAUSED") return "paused";
  if (reason === "FORM_EXPIRED") return "expired";
  if (reason) return "closed";
  const text = (message ?? "").toLowerCase();
  if (text.includes("pause")) return "paused";
  if (text.includes("expire")) return "expired";
  return "closed";
}

/** Short stays never take applications (the API answers 400). */
export const listingTakesApplications = (category: string | null | undefined) => category !== "short-stay";

/** "2026-12-01T09:00" in the viewer's time zone -> an ISO instant, or null. */
export function localDateTimeToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

/** An ISO instant -> "2026-12-01T09:00" in the viewer's time zone, for `datetime-local`. */
export function isoToLocalDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

// ---- Reading the API's answers --------------------------------------------------------

/**
 * The object an answer wraps (`{ form: … }`, `{ application: … }`), or the
 * answer itself when it is not wrapped. The contract named the endpoints but
 * not every answer's shape, so both are read.
 */
export function unwrap<T>(payload: unknown, key: string): T | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const inner = record[key];
  if (inner && typeof inner === "object" && !Array.isArray(inner)) return inner as T;
  return payload as T;
}

/** The items of a list answer: `{ items }`, `{ <key> }` or a bare array. */
export function listOf<T>(payload: unknown, key?: string): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.items)) return record.items as T[];
  if (key && Array.isArray(record[key])) return record[key] as T[];
  return [];
}

/** A form definition read defensively: every list present, every field typed. */
export function normaliseSections(value: unknown): FormSection[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw, index) => {
    const section = (raw ?? {}) as Record<string, unknown>;
    const fields = Array.isArray(section.fields) ? section.fields : [];
    return {
      key: typeof section.key === "string" && section.key ? section.key : `section_${index + 1}`,
      title: typeof section.title === "string" ? section.title : "",
      description: typeof section.description === "string" ? section.description : "",
      fields: fields.map((item, fieldIndex) => {
        const field = (item ?? {}) as Record<string, unknown>;
        const type = isFieldType(field.type) ? field.type : "short_text";
        const visible = field.visible_if as VisibleIf | null | undefined;
        return {
          ...(field as Partial<FormField>),
          key: typeof field.key === "string" && field.key ? field.key : `field_${index + 1}_${fieldIndex + 1}`,
          type,
          label: typeof field.label === "string" ? field.label : "",
          required: field.required === true,
          options: Array.isArray(field.options)
            ? (field.options as Record<string, unknown>[]).map((option) => ({ value: String(option?.value ?? ""), label: String(option?.label ?? option?.value ?? "") }))
            : isChoiceType(type)
              ? []
              : null,
          visible_if: visible && typeof visible === "object" && typeof visible.field === "string" ? visible : null,
          min: typeof field.min === "number" ? field.min : null,
          max: typeof field.max === "number" ? field.max : null,
        } as FormField;
      }),
    };
  });
}

/**
 * The rules of inspections (`/agent/inspections`, the tenancy page's
 * Inspections section and the tenant's completed inspections on
 * `/account/tenancies/<id>`, API 0.36.3, BR-019, FR-047) that are not the
 * API's, as pure functions: the words and tones of types, statuses and
 * findings, the scheduled time in the inspector's own clock sent as UTC, the
 * checklist editor (areas and items added, renamed, removed), how many items
 * are done and what is missing before completion, the checks on photos and
 * forms, the request bodies, the list filters in the page address and the
 * API query, page addresses, and tolerant readers for the API's answers.
 *
 * This file must stay free of imports and of TypeScript-only syntax that is
 * not erasable: Node runs it directly for the tests (scripts/inspections.test.mjs).
 */

// ---- Words ----------------------------------------------------------------------------------------

/** "MOVE_IN" -> "Move in"; "standard-residential" -> "Standard residential". */
export function wordsFromCode(code: string): string {
  const words = code.toLowerCase().replace(/[_-]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "";
}

export type Tone = "neutral" | "primary" | "accent" | "success" | "warning" | "danger" | "info";

export type Choice = { code: string; label: string };

// ---- Types ------------------------------------------------------------------------------------------

export const INSPECTION_TYPES = ["MOVE_IN", "ROUTINE", "MOVE_OUT"] as const;
export type InspectionType = (typeof INSPECTION_TYPES)[number];

export const isInspectionType = (value: unknown): value is InspectionType =>
  typeof value === "string" && (INSPECTION_TYPES as readonly string[]).includes(value);

const TYPE_LABELS: Record<InspectionType, string> = { MOVE_IN: "Move-in", ROUTINE: "Routine", MOVE_OUT: "Move-out" };

export const inspectionTypeLabel = (type: string, apiLabel?: string | null) =>
  apiLabel || (isInspectionType(type) ? TYPE_LABELS[type] : wordsFromCode(type));

/** One sentence per type. */
export const TYPE_EXPLAINED: Record<InspectionType, string> = {
  MOVE_IN: "The state of the property when the tenant moves in.",
  ROUTINE: "A check during the tenancy.",
  MOVE_OUT: "The state of the property when the tenant leaves, to compare with the move-in report.",
};

// ---- Statuses ---------------------------------------------------------------------------------------

export const INSPECTION_STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];

export const isInspectionStatus = (value: unknown): value is InspectionStatus =>
  typeof value === "string" && (INSPECTION_STATUSES as readonly string[]).includes(value);

const STATUS_LABELS: Record<InspectionStatus, string> = {
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const STATUS_TONES: Record<InspectionStatus, Tone> = {
  SCHEDULED: "info",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  CANCELLED: "neutral",
};

export const inspectionStatusLabel = (status: string, apiLabel?: string | null) =>
  apiLabel || (isInspectionStatus(status) ? STATUS_LABELS[status] : wordsFromCode(status));

export const inspectionStatusTone = (status: string): Tone => (isInspectionStatus(status) ? STATUS_TONES[status] : "neutral");

/** Completed inspections are frozen: nothing on them can change. */
export const isCompleted = (status: string) => status === "COMPLETED";

/** Findings can be recorded and the checklist changed until the inspection is completed (or cancelled). */
export const isEditableStatus = (status: string) => status !== "COMPLETED" && status !== "CANCELLED";

export const STATUS_EXPLAINED: Record<InspectionStatus, string> = {
  SCHEDULED: "Booked. Record the findings during the visit.",
  IN_PROGRESS: "Findings are being recorded. Complete it when every item is checked.",
  COMPLETED: "Completed and frozen: the findings can no longer change.",
  CANCELLED: "Will not take place.",
};

// ---- Findings ---------------------------------------------------------------------------------------

export const FINDING_STATUSES = ["OK", "ATTENTION", "DAMAGED", "NA"] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

export const isFindingStatus = (value: unknown): value is FindingStatus =>
  typeof value === "string" && (FINDING_STATUSES as readonly string[]).includes(value);

const FINDING_LABELS: Record<FindingStatus, string> = { OK: "OK", ATTENTION: "Attention", DAMAGED: "Damaged", NA: "N/A" };

/** The words a screen reader hears and the report's legend uses. */
const FINDING_WORDS: Record<FindingStatus, string> = {
  OK: "OK",
  ATTENTION: "Needs attention",
  DAMAGED: "Damaged",
  NA: "Not applicable",
};

const FINDING_TONES: Record<FindingStatus, Tone> = { OK: "success", ATTENTION: "warning", DAMAGED: "danger", NA: "neutral" };

/** "OK", "Attention", "Damaged", "N/A"; "Not checked" when none is chosen. */
export const findingLabel = (status: string | null | undefined, apiLabel?: string | null) =>
  apiLabel || (isFindingStatus(status) ? FINDING_LABELS[status] : status ? wordsFromCode(status) : "Not checked");

export const findingWords = (status: string | null | undefined) =>
  isFindingStatus(status) ? FINDING_WORDS[status] : status ? wordsFromCode(status) : "Not checked yet";

export const findingTone = (status: string | null | undefined): Tone => (isFindingStatus(status) ? FINDING_TONES[status] : "neutral");

// ---- The scheduled time: the inspector's clock, sent as UTC ------------------------------------------

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** A real calendar date "YYYY-MM-DD" (not 2026-02-30). */
export function isRealDay(value: string): boolean {
  const match = DAY.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1) return false;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= last;
}

export const isTime = (value: string) => TIME.test(value);

const pad = (n: number) => String(n).padStart(2, "0");

function rfc3339(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`;
}

/**
 * A date and time on the inspector's clock as an RFC 3339 UTC timestamp
 * ("2026-12-01", "09:30" in Harare -> "2026-12-01T07:30:00Z"). `offsetMinutes`
 * is as `Date#getTimezoneOffset` (UTC minus local: -120 in Harare, 300 in New
 * York in winter); without it the browser's own zone decides, daylight saving
 * included. Null when the date or the time is not valid.
 */
export function localToUtc(date: string, time: string, offsetMinutes?: number): string | null {
  if (!isRealDay(date) || !isTime(time)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  if (typeof offsetMinutes === "number" && Number.isFinite(offsetMinutes)) {
    return rfc3339(Date.UTC(year, month - 1, day, hours, minutes) + offsetMinutes * 60_000);
  }
  const local = new Date(year, month - 1, day, hours, minutes);
  return Number.isNaN(local.getTime()) ? null : rfc3339(local.getTime());
}

/** The other way: a UTC timestamp as the date and time on the inspector's clock (for the form). */
export function utcToLocal(iso: string | null | undefined, offsetMinutes?: number): { date: string; time: string } | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  if (typeof offsetMinutes === "number" && Number.isFinite(offsetMinutes)) {
    const d = new Date(ms - offsetMinutes * 60_000);
    return { date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` };
  }
  const d = new Date(ms);
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

/** Upcoming: scheduled at or after `now` and not completed or cancelled. */
export function isUpcoming(inspection: { status: string; scheduledFor: string | null }, now: number = Date.now()): boolean {
  if (!isEditableStatus(inspection.status) || !inspection.scheduledFor) return false;
  const at = Date.parse(inspection.scheduledFor);
  return !Number.isNaN(at) && at >= now;
}

/** Overdue: still open and its time has passed. */
export function isOverdue(inspection: { status: string; scheduledFor: string | null }, now: number = Date.now()): boolean {
  if (!isEditableStatus(inspection.status) || !inspection.scheduledFor) return false;
  const at = Date.parse(inspection.scheduledFor);
  return !Number.isNaN(at) && at < now;
}

// ---- The checklist -----------------------------------------------------------------------------------

export type ItemPhoto = { id: string; url: string | null; width: number | null; height: number | null; uploadedAt: string | null; canDelete: boolean };

/** On a move-out: the same item's finding at the move-in it is compared with. */
export type Baseline = { status: FindingStatus | ""; label: string | null; note: string };

export type ChecklistItem = {
  /** Stable in the browser; the API's id once it has one. */
  key: string;
  id: string | null;
  label: string;
  status: FindingStatus | "";
  note: string;
  photos: ItemPhoto[];
  baseline: Baseline | null;
};

export type ChecklistArea = { key: string; id: string | null; name: string; items: ChecklistItem[] };

export type Checklist = ChecklistArea[];

/** The API's limits (API 0.36.3, `options.limits`). */
export const AREA_NAME_MAX = 120;
export const ITEM_LABEL_MAX = 120;
export const FINDING_NOTE_MAX = 1000;
export const AREAS_MAX = 40;
export const ITEMS_PER_AREA_MAX = 60;
export const ITEMS_MAX = 400;
export const SIGNER_NAME_MAX = 200;
export const SUMMARY_MAX = 5000;
export const CANCEL_REASON_MAX = 500;

let counter = 0;
/** A key for something added in the browser. `seed` makes it predictable in the tests. */
export function newKey(prefix: string, seed?: number): string {
  counter += 1;
  return `${prefix}-new-${seed ?? counter}`;
}

export const emptyItem = (label: string, key = newKey("item")): ChecklistItem => ({ key, id: null, label, status: "", note: "", photos: [], baseline: null });

export const emptyArea = (name: string, key = newKey("area")): ChecklistArea => ({ key, id: null, name, items: [] });

export function addArea(list: Checklist, name: string, key?: string): Checklist {
  return [...list, emptyArea(name.trim(), key)];
}

export function removeArea(list: Checklist, areaKey: string): Checklist {
  return list.filter((area) => area.key !== areaKey);
}

export function renameArea(list: Checklist, areaKey: string, name: string): Checklist {
  return list.map((area) => (area.key === areaKey ? { ...area, name } : area));
}

export function moveArea(list: Checklist, areaKey: string, by: -1 | 1): Checklist {
  const index = list.findIndex((area) => area.key === areaKey);
  const target = index + by;
  if (index < 0 || target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function addItem(list: Checklist, areaKey: string, label: string, key?: string): Checklist {
  return list.map((area) => (area.key === areaKey ? { ...area, items: [...area.items, emptyItem(label.trim(), key)] } : area));
}

export function removeItem(list: Checklist, areaKey: string, itemKey: string): Checklist {
  return list.map((area) => (area.key === areaKey ? { ...area, items: area.items.filter((item) => item.key !== itemKey) } : area));
}

export function updateItem(list: Checklist, areaKey: string, itemKey: string, change: Partial<Omit<ChecklistItem, "key">>): Checklist {
  return list.map((area) =>
    area.key === areaKey ? { ...area, items: area.items.map((item) => (item.key === itemKey ? { ...item, ...change } : item)) } : area,
  );
}

/** Why a new area name cannot be used, or null. Names are unique in the checklist, ignoring case. */
export function areaNameProblem(name: string, others: readonly string[] = []): string | null {
  const value = name.trim();
  if (!value) return "Name the area, for example “Kitchen”.";
  if (value.length > AREA_NAME_MAX) return `Use at most ${AREA_NAME_MAX} characters.`;
  if (others.some((other) => other.trim().toLowerCase() === value.toLowerCase())) return "There is already an area with that name.";
  return null;
}

/** Why a new item label cannot be used, or null. Labels are unique in their area, ignoring case. */
export function itemLabelProblem(label: string, others: readonly string[] = []): string | null {
  const value = label.trim();
  if (!value) return "Name the item, for example “Walls”.";
  if (value.length > ITEM_LABEL_MAX) return `Use at most ${ITEM_LABEL_MAX} characters.`;
  if (others.some((other) => other.trim().toLowerCase() === value.toLowerCase())) return "This area already has an item with that name.";
  return null;
}

export type Missing = { areaKey: string; area: string; itemKey: string; item: string };

export type Readiness = {
  total: number;
  done: number;
  /** Items with no finding chosen, in checklist order. */
  missing: Missing[];
  /** Counts per finding. */
  counts: Record<FindingStatus, number>;
  /** Areas without items: they say nothing in the report. */
  emptyAreas: string[];
  /** Notes longer than allowed. */
  longNotes: Missing[];
  /** Every item has a finding, there is at least one, and nothing is too long. */
  ready: boolean;
};

/**
 * How far the inspection has got: how many items have a finding, which are
 * still missing, the counts per finding, and whether it can be completed.
 * It can be completed only when it has at least one item and every item has
 * a finding (N/A counts: it is a decision).
 */
export function completionReadiness(list: Checklist): Readiness {
  const counts: Record<FindingStatus, number> = { OK: 0, ATTENTION: 0, DAMAGED: 0, NA: 0 };
  const missing: Missing[] = [];
  const longNotes: Missing[] = [];
  const emptyAreas: string[] = [];
  let total = 0;
  for (const area of list) {
    if (area.items.length === 0) emptyAreas.push(area.name || "An area with no name");
    for (const item of area.items) {
      total += 1;
      const where = { areaKey: area.key, area: area.name, itemKey: item.key, item: item.label };
      if (isFindingStatus(item.status)) counts[item.status] += 1;
      else missing.push(where);
      if (item.note.trim().length > FINDING_NOTE_MAX) longNotes.push(where);
    }
  }
  const done = total - missing.length;
  return { total, done, missing, counts, emptyAreas, longNotes, ready: total > 0 && missing.length === 0 && longNotes.length === 0 };
}

/** "12 of 30 items checked". */
export const progressWords = (done: number, total: number) => `${done} of ${total} ${total === 1 ? "item" : "items"} checked`;

/** "Kitchen: Walls, Oven; Bathroom: Taps". At most `limit` items named, then "and 4 more". */
export function missingWords(missing: readonly Missing[], limit = 8): string {
  if (missing.length === 0) return "";
  const shown = missing.slice(0, limit);
  const byArea = new Map<string, string[]>();
  for (const item of shown) {
    const area = item.area || "Unnamed area";
    byArea.set(area, [...(byArea.get(area) ?? []), item.item || "Unnamed item"]);
  }
  const text = [...byArea.entries()].map(([area, items]) => `${area}: ${items.join(", ")}`).join("; ");
  const rest = missing.length - shown.length;
  return rest > 0 ? `${text}; and ${rest} more` : text;
}

/** A fingerprint of everything the inspector can change, to tell whether there are unsaved changes. */
export function checklistSignature(list: Checklist): string {
  return JSON.stringify(
    list.map((area) => [area.id ?? area.key, area.name.trim(), area.items.map((item) => [item.id ?? item.key, item.label.trim(), item.status, item.note.trim()])]),
  );
}

/** A fingerprint of the structure only (areas and items, their names and order): `PUT .../checklist` is needed when it changed. */
export function structureSignature(list: Checklist): string {
  return JSON.stringify(list.map((area) => [area.id ?? area.key, area.name.trim(), area.items.map((item) => [item.id ?? item.key, item.label.trim()])]));
}

export type FindingLine = { item_id: string; status: FindingStatus | null; note: string };

/**
 * The lines of `PUT .../findings` (partial): every saved item whose finding
 * or note differs from what the API has. `"status": null` clears a finding.
 * Items without an id are saved by `PUT .../checklist` first.
 */
export function changedFindings(draft: Checklist, saved: Checklist): FindingLine[] {
  const before = new Map<string, ChecklistItem>();
  for (const area of saved) for (const item of area.items) if (item.id) before.set(item.id, item);
  const lines: FindingLine[] = [];
  for (const area of draft) {
    for (const item of area.items) {
      if (!item.id) continue;
      const was = before.get(item.id);
      const note = item.note.trim();
      if (was && was.status === item.status && was.note.trim() === note) continue;
      if (!was && !item.status && !note) continue;
      lines.push({ item_id: item.id, status: item.status || null, note });
    }
  }
  return lines;
}

/**
 * After a save: gives the areas and items added in the browser the ids the
 * API gave them (matched by name within the checklist, and by label within
 * the area, ignoring case), and every saved item its photos as the API has
 * them. Everything the inspector changed meanwhile is kept.
 */
export function adoptIds(draft: Checklist, saved: Checklist): Checklist {
  const norm = (text: string) => text.trim().toLowerCase();
  const usedAreas = new Set(draft.map((area) => area.id).filter((id): id is string => Boolean(id)));
  return draft.map((area) => {
    const match =
      saved.find((other) => other.id !== null && other.id === area.id) ??
      (area.id ? undefined : saved.find((other) => other.id !== null && !usedAreas.has(other.id) && norm(other.name) === norm(area.name)));
    if (!match) return area;
    if (match.id) usedAreas.add(match.id);
    const usedItems = new Set(area.items.map((item) => item.id).filter((id): id is string => Boolean(id)));
    return {
      ...area,
      id: match.id,
      items: area.items.map((item) => {
        const twin =
          match.items.find((other) => other.id !== null && other.id === item.id) ??
          (item.id ? undefined : match.items.find((other) => other.id !== null && !usedItems.has(other.id) && norm(other.label) === norm(item.label)));
        if (!twin) return item;
        if (twin.id) usedItems.add(twin.id);
        return { ...item, id: twin.id, photos: twin.photos, baseline: twin.baseline };
      }),
    };
  });
}

/** Problems that stop the checklist from being saved: names and labels, lengths, limits. */
export function checklistProblems(list: Checklist): string[] {
  const problems: string[] = [];
  const items = list.reduce((sum, area) => sum + area.items.length, 0);
  if (list.length === 0) problems.push("Keep at least one area in the checklist.");
  else if (items === 0) problems.push("Keep at least one item in the checklist.");
  if (list.length > AREAS_MAX) problems.push(`A checklist can have up to ${AREAS_MAX} areas.`);
  if (items > ITEMS_MAX) problems.push(`A checklist can have up to ${ITEMS_MAX} items.`);
  const names: string[] = [];
  list.forEach((area, index) => {
    const name = area.name.trim();
    const where = name || `Area ${index + 1}`;
    const problem = areaNameProblem(name, names);
    if (problem) problems.push(`${where}: ${problem}`);
    names.push(name);
    if (area.items.length > ITEMS_PER_AREA_MAX) problems.push(`${where}: an area can have up to ${ITEMS_PER_AREA_MAX} items.`);
    const labels: string[] = [];
    area.items.forEach((item, itemIndex) => {
      const label = item.label.trim();
      const itemProblem = itemLabelProblem(label, labels);
      if (itemProblem) problems.push(`${where}, ${label || `item ${itemIndex + 1}`}: ${itemProblem}`);
      labels.push(label);
      if (item.note.trim().length > FINDING_NOTE_MAX) problems.push(`${where}, ${label}: use at most ${FINDING_NOTE_MAX} characters in the note.`);
    });
  });
  return problems;
}

// ---- Photos ------------------------------------------------------------------------------------------

export type PhotoRules = { maxPhotos: number; maxBytes: number; types: string[] };

/** Per checklist item. Images only (the API decides by the bytes), kept private and re-encoded without metadata. */
export const DEFAULT_PHOTO_RULES: PhotoRules = { maxPhotos: 6, maxBytes: 10 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp"] };

const EXTENSIONS: Record<string, string[]> = { "image/jpeg": ["jpg", "jpeg"], "image/png": ["png"], "image/webp": ["webp"] };

export function photoAccept(rules: PhotoRules = DEFAULT_PHOTO_RULES): string {
  const extensions = rules.types.flatMap((type) => (EXTENSIONS[type] ?? []).map((ext) => `.${ext}`));
  return [...extensions, ...rules.types].join(",");
}

/** "JPEG, PNG or WebP". */
export function photoTypeWords(rules: PhotoRules = DEFAULT_PHOTO_RULES): string {
  const names = rules.types.map((type) => (type === "image/jpeg" ? "JPEG" : type === "image/png" ? "PNG" : type === "image/webp" ? "WebP" : type.replace(/^image\//, "").toUpperCase()));
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}

export const megabytes = (bytes: number) => `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;

export type FileLike = { name: string; type: string; size: number };

/** Why a file cannot be added as a photo of an item, in words, or null. A file with no type is judged by its name. */
export function inspectionPhotoProblem(file: FileLike, rules: PhotoRules = DEFAULT_PHOTO_RULES): string | null {
  const extension = (file.name.split(".").pop() ?? "").toLowerCase();
  const known = file.type ? rules.types.includes(file.type.toLowerCase()) : rules.types.some((type) => (EXTENSIONS[type] ?? []).includes(extension));
  if (!known) return `${file.name} is not a photo we accept. Choose a ${photoTypeWords(rules)} image.`;
  if (file.size === 0) return `${file.name} is empty. Choose another photo.`;
  if (file.size > rules.maxBytes) return `${file.name} is larger than ${megabytes(rules.maxBytes)}. Choose a smaller photo.`;
  return null;
}

/** Splits the files chosen into those that may be added (up to the item's limit, counting those it has) and the problems with the rest. */
export function sortInspectionPhotos<T extends FileLike>(files: readonly T[], already: number, rules: PhotoRules = DEFAULT_PHOTO_RULES) {
  const accepted: T[] = [];
  const problems: string[] = [];
  let room = Math.max(0, rules.maxPhotos - already);
  for (const file of files) {
    const problem = inspectionPhotoProblem(file, rules);
    if (problem) {
      problems.push(problem);
      continue;
    }
    if (room === 0) {
      problems.push(`${file.name} was not added: an item can have up to ${rules.maxPhotos} photos.`);
      continue;
    }
    accepted.push(file);
    room -= 1;
  }
  return { accepted, problems };
}

// ---- Forms -------------------------------------------------------------------------------------------

export type InspectionForm = {
  propertyId: string;
  unitId: string;
  tenancyId: string;
  type: string;
  date: string;
  time: string;
  template: string;
  /** "" is the signed-in person (the API's default). */
  inspectorId: string;
};

export const emptyInspectionForm = (): InspectionForm => ({ propertyId: "", unitId: "", tenancyId: "", type: "ROUTINE", date: "", time: "10:00", template: "", inspectorId: "" });

export type InspectionField = keyof InspectionForm;
export type InspectionProblems = Partial<Record<InspectionField, string>>;

/**
 * The checks the browser can make. A time in the past is allowed: an
 * inspection that already happened may be recorded afterwards.
 */
export function inspectionFormProblems(form: InspectionForm, options: { templateRequired?: boolean } = {}): InspectionProblems {
  const problems: InspectionProblems = {};
  if (!form.propertyId) problems.propertyId = "Choose the property.";
  if (!isInspectionType(form.type)) problems.type = "Choose the kind of inspection.";
  if (!form.date) problems.date = "Choose the day.";
  else if (!isRealDay(form.date)) problems.date = "Enter a real date as YYYY-MM-DD.";
  if (!form.time) problems.time = "Choose the time.";
  else if (!isTime(form.time)) problems.time = "Enter the time as HH:MM, for example 09:30.";
  if (options.templateRequired && !form.template) problems.template = "Choose a checklist.";
  return problems;
}

export const hasProblems = (problems: Record<string, unknown>) => Object.values(problems).some(Boolean);

/** The body of `POST /inspections`. The time is the inspector's clock, sent as UTC. */
export function inspectionBody(form: InspectionForm, offsetMinutes?: number): Record<string, unknown> {
  return {
    property_id: form.propertyId,
    unit_id: form.unitId || null,
    tenancy_id: form.tenancyId || null,
    type: form.type,
    scheduled_for: localToUtc(form.date, form.time, offsetMinutes),
    ...(form.template ? { checklist_template: form.template } : {}),
    ...(form.inspectorId ? { inspector_user_id: form.inspectorId } : {}),
  };
}

const API_FIELDS: Record<string, InspectionField> = {
  property_id: "propertyId",
  unit_id: "unitId",
  tenancy_id: "tenancyId",
  type: "type",
  scheduled_for: "date",
  checklist_template: "template",
  inspector_user_id: "inspectorId",
};

/** The API's field errors on the form's fields; anything else in `other`. */
export function inspectionApiProblems(fields: Record<string, string> | undefined): InspectionProblems & { other?: string[] } {
  const problems: InspectionProblems & { other?: string[] } = {};
  for (const [key, message] of Object.entries(fields ?? {})) {
    const field = API_FIELDS[key];
    if (field) problems[field] = message;
    else (problems.other ??= []).push(message);
  }
  return problems;
}

/** `agent`: the name typed by whoever inspected for the manager; `tenant`: the tenant's, when they were there. */
export type CompleteForm = { summary: string; agent: string; tenant: string };
export type CompleteProblems = Partial<Record<keyof CompleteForm, string>>;

/** The sign-off names are plain typed names, both optional (the tenant may not be there). */
export function completeProblems(form: CompleteForm): CompleteProblems {
  const problems: CompleteProblems = {};
  if (form.agent.trim().length > SIGNER_NAME_MAX) problems.agent = `Use at most ${SIGNER_NAME_MAX} characters.`;
  if (form.tenant.trim().length > SIGNER_NAME_MAX) problems.tenant = `Use at most ${SIGNER_NAME_MAX} characters.`;
  if (form.summary.trim().length > SUMMARY_MAX) problems.summary = `Use at most ${SUMMARY_MAX} characters.`;
  return problems;
}

export function cancelReasonProblem(reason: string): string | null {
  const value = reason.trim();
  if (!value) return "Say why it is cancelled.";
  if (value.length > CANCEL_REASON_MAX) return `Use at most ${CANCEL_REASON_MAX} characters.`;
  return null;
}

// ---- Filters in the address and the API query ---------------------------------------------------------

type Params = { get(name: string): string | null };

const ID = /^[A-Za-z0-9_-]{1,64}$/;

export function pageNumber(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

export type InspectionWhen = "upcoming" | "past";

export type InspectionFilters = {
  status?: InspectionStatus;
  type?: InspectionType;
  property?: string;
  tenancy?: string;
  when?: InspectionWhen;
  page: number;
};

export function parseInspectionFilters(params: Params): InspectionFilters {
  const filters: InspectionFilters = { page: pageNumber(params.get("page")) };
  const status = (params.get("status") ?? "").toUpperCase();
  if (isInspectionStatus(status)) filters.status = status;
  const type = (params.get("type") ?? "").toUpperCase();
  if (isInspectionType(type)) filters.type = type;
  const property = params.get("property") ?? "";
  if (ID.test(property)) filters.property = property;
  const tenancy = params.get("tenancy") ?? "";
  if (ID.test(tenancy)) filters.tenancy = tenancy;
  const when = params.get("when");
  if (when === "upcoming" || when === "past") filters.when = when;
  return filters;
}

export const hasInspectionFilters = (filters: InspectionFilters) => Boolean(filters.status || filters.type || filters.property || filters.tenancy || filters.when);

/** The page address of the list, keeping the organisation. */
export function inspectionListHref(filters: Partial<InspectionFilters>, org?: string): string {
  const search = new URLSearchParams();
  if (org) search.set("org", org);
  if (filters.when) search.set("when", filters.when);
  if (filters.status) search.set("status", filters.status);
  if (filters.type) search.set("type", filters.type);
  if (filters.property) search.set("property", filters.property);
  if (filters.tenancy) search.set("tenancy", filters.tenancy);
  if (filters.page && filters.page > 1) search.set("page", String(filters.page));
  const text = search.toString();
  return `/agent/inspections${text ? `?${text}` : ""}`;
}

/** "2026-11-19" -> "2026-11-18". */
export function dayBefore(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, date - 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Today's UTC date: the API filters on the UTC date of `scheduled_for`. */
export const utcToday = (now: number = Date.now()) => new Date(now).toISOString().slice(0, 10);

/**
 * The API query. `when` becomes dates on the UTC day of `scheduled_for`
 * (inclusive): upcoming is `from=today`, past is `to=yesterday`.
 */
export function inspectionApiQuery(filters: InspectionFilters, pageSize = 25, today: string = utcToday()): string {
  const search = new URLSearchParams();
  if (filters.status) search.set("status", filters.status);
  if (filters.type) search.set("type", filters.type);
  if (filters.property) search.set("property_id", filters.property);
  if (filters.tenancy) search.set("tenancy_id", filters.tenancy);
  if (filters.when === "upcoming") search.set("from", today);
  if (filters.when === "past") search.set("to", dayBefore(today));
  search.set("page", String(filters.page));
  search.set("page_size", String(pageSize));
  return `?${search}`;
}

// ---- Page addresses ---------------------------------------------------------------------------------

function withOrg(base: string, path: string, org?: string, extra: Record<string, string | undefined> = {}) {
  const search = new URLSearchParams();
  if (org) search.set("org", org);
  for (const [key, value] of Object.entries(extra)) if (value) search.set(key, value);
  const text = search.toString();
  return `${base}${path}${text ? `?${text}` : ""}`;
}

export const inspectionsPath = (path: string, org?: string, extra?: Record<string, string | undefined>) => withOrg("/agent/inspections", path, org, extra);
export const inspectionHref = (id: string, org?: string) => inspectionsPath(`/${encodeURIComponent(id)}`, org);
/** "Schedule inspection" from a tenancy: the form with the property, unit and tenancy filled in, and the type that fits. */
export const newInspectionHref = (org: string, from: { property?: string | null; unit?: string | null; tenancy?: string | null; type?: string | null } = {}) =>
  inspectionsPath("/new", org, { property: from.property ?? undefined, unit: from.unit ?? undefined, tenancy: from.tenancy ?? undefined, type: from.type ?? undefined });

/** The type a tenancy most likely needs next: move-in before it starts, move-out once it has ended, else routine. */
export function suggestedType(tenancy: { status: string }, hasMoveIn: boolean): InspectionType {
  if (tenancy.status === "ENDED" || tenancy.status === "TERMINATED") return "MOVE_OUT";
  if (!hasMoveIn) return "MOVE_IN";
  return "ROUTINE";
}

/** "Avondale Court, Flat 1". */
export function inspectionPlace(inspection: { property: { name: string } | null; unit: { label: string } | null }): string {
  return [inspection.property?.name, inspection.unit?.label].filter(Boolean).join(", ") || "No property";
}

/** "inspection-RPI-2026-000001.pdf" when the API sends no file name. */
export const reportFileName = (inspection: { reference: string | null; id: string }) => `inspection-${inspection.reference ?? inspection.id.slice(0, 8)}.pdf`;

// ---- Reading the API's answers ------------------------------------------------------------------------

type Raw = Record<string, unknown>;

function obj(value: unknown): Raw | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : null;
}
const str = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const int = (value: unknown): number | null => {
  const n = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) ? n : null;
};
const bool = (value: unknown): boolean | null => (typeof value === "boolean" ? value : null);
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const first = (raw: Raw | null, ...keys: string[]): unknown => {
  if (!raw) return undefined;
  for (const key of keys) if (raw[key] !== undefined && raw[key] !== null) return raw[key];
  return undefined;
};
const personName = (value: unknown) => (typeof value === "string" ? str(value) : str(obj(value)?.name));

/** A CodeLabel `{code, label}`, or a bare code (its label then from `label`). */
function coded(value: unknown, label: (code: string) => string): Choice | null {
  const inner = obj(value);
  const code = str(inner?.code) ?? str(value);
  if (!code) return null;
  return { code, label: str(inner?.label) ?? label(code) };
}

/** An InspectionPhoto (the team's) or the tenant's photo. */
export function normaliseItemPhoto(value: unknown): ItemPhoto | null {
  const raw = obj(obj(value)?.photo) ?? obj(value);
  const id = str(raw?.id);
  if (!raw || !id) return null;
  return {
    id,
    url: str(raw.url),
    width: int(raw.width),
    height: int(raw.height),
    uploadedAt: str(raw.uploaded_at),
    canDelete: bool(obj(raw.can)?.delete) ?? false,
  };
}

function findingOf(value: unknown): FindingStatus | "" {
  const code = (str(value) ?? str(obj(value)?.code) ?? "").toUpperCase();
  if (code === "N/A") return "NA";
  return isFindingStatus(code) ? code : "";
}

function baselineOf(value: unknown): Baseline | null {
  const raw = obj(value);
  if (!raw) return null;
  return { status: findingOf(raw.status), label: str(raw.status_label), note: str(raw.note) ?? "" };
}

function normaliseItem(value: unknown, index: number, areaKey: string): ChecklistItem | null {
  const raw = obj(value);
  if (!raw) return null;
  const id = str(raw.id);
  return {
    key: id ?? `${areaKey}-item-${index}`,
    id,
    label: str(first(raw, "label", "name")) ?? "",
    status: findingOf(raw.status),
    note: str(raw.note) ?? "",
    photos: arr(raw.photos)
      .map(normaliseItemPhoto)
      .filter((item): item is ItemPhoto => item !== null),
    baseline: baselineOf(raw.baseline),
  };
}

function normaliseArea(value: unknown, index: number): ChecklistArea | null {
  const raw = obj(value);
  if (!raw) return null;
  const id = str(raw.id);
  const key = id ?? `area-${index}`;
  return {
    key,
    id,
    name: str(first(raw, "label", "name")) ?? "",
    items: arr(raw.items)
      .map((item, itemIndex) => normaliseItem(item, itemIndex, key))
      .filter((item): item is ChecklistItem => item !== null),
  };
}

/** The inspection's `areas` (in the API's order). */
export function normaliseChecklist(value: unknown): Checklist {
  const raw = obj(value);
  const list = Array.isArray(value) ? value : arr(raw?.areas);
  return list.map(normaliseArea).filter((item): item is ChecklistArea => item !== null);
}

export type InspectionCan = {
  edit: boolean;
  editChecklist: boolean;
  recordFindings: boolean;
  addPhoto: boolean;
  start: boolean;
  complete: boolean;
  cancel: boolean;
};

export type Progress = { done: number; total: number; counts: Record<FindingStatus, number> };

export type Inspection = {
  id: string;
  reference: string | null;
  type: string;
  typeLabel: string | null;
  status: string;
  statusLabel: string | null;
  /** `id` is null in the tenant's view, which carries no ids. */
  property: { id: string | null; name: string; address: string | null; archived: boolean } | null;
  unit: { id: string | null; label: string; archived: boolean } | null;
  tenancy: { id: string; status: string | null; tenants: string[] } | null;
  scheduledFor: string | null;
  /** The property market's IANA zone (API 0.62.0): scheduled times are shown in it first. Null from an older API. */
  timeZone: string | null;
  inspector: string | null;
  template: { code: string | null; label: string } | null;
  checklist: Checklist;
  progress: Progress | null;
  photoCount: number | null;
  summary: string;
  signOff: { tenant: string | null; agent: string | null };
  cancelReason: string | null;
  /** A move-out: the completed move-in it is compared with. */
  baseline: { id: string | null; reference: string | null; completedAt: string | null } | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  completedBy: string | null;
  cancelledBy: string | null;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  can: InspectionCan | null;
};

function canOf(value: unknown): InspectionCan | null {
  const can = obj(value);
  if (!can) return null;
  return {
    edit: bool(can.edit) ?? false,
    editChecklist: bool(can.edit_checklist) ?? false,
    recordFindings: bool(can.record_findings) ?? false,
    addPhoto: bool(can.add_photo) ?? false,
    start: bool(can.start) ?? false,
    complete: bool(can.complete) ?? false,
    cancel: bool(can.cancel) ?? false,
  };
}

/** `Progress: {items, done, ok, attention, damaged, na}`. */
function progressOf(value: unknown): Progress | null {
  const raw = obj(value);
  const total = int(raw?.items);
  if (!raw || total === null) return null;
  const counts: Record<FindingStatus, number> = {
    OK: int(raw.ok) ?? 0,
    ATTENTION: int(raw.attention) ?? 0,
    DAMAGED: int(raw.damaged) ?? 0,
    NA: int(raw.na) ?? 0,
  };
  const done = int(raw.done) ?? counts.OK + counts.ATTENTION + counts.DAMAGED + counts.NA;
  return { done, total, counts };
}

/** `{inspection: Inspection}`, an InspectionSummary, or the tenant's MyInspection. */
export function normaliseInspection(value: unknown): Inspection | null {
  const wrapper = obj(value);
  const raw = obj(wrapper?.inspection) ?? wrapper;
  const id = str(raw?.id);
  if (!raw || !id) return null;
  const propertyRaw = obj(raw.property);
  const unitRaw = obj(raw.unit);
  const tenancyRaw = obj(raw.tenancy);
  const tenancyId = str(tenancyRaw?.id) ?? str(raw.tenancy_id);
  const type = coded(raw.type, inspectionTypeLabel);
  const templateRaw = obj(raw.template);
  const templateLabel = str(templateRaw?.label) ?? (str(raw.template) ? wordsFromCode(str(raw.template) as string) : null);
  const checklist = normaliseChecklist(raw.areas);
  const signOff = obj(raw.sign_off);
  const baselineRaw = obj(raw.baseline);
  const counted = checklist.length ? completionReadiness(checklist) : null;
  return {
    id,
    reference: str(raw.reference),
    type: type?.code ?? "ROUTINE",
    typeLabel: str(raw.type_label) ?? (obj(raw.type) ? (type?.label ?? null) : null),
    status: str(raw.status) ?? "SCHEDULED",
    statusLabel: str(raw.status_label),
    property: propertyRaw
      ? { id: str(propertyRaw.id), name: str(propertyRaw.name) ?? "The property", address: str(propertyRaw.address), archived: bool(propertyRaw.archived) ?? false }
      : null,
    unit: unitRaw ? { id: str(unitRaw.id), label: str(unitRaw.label) ?? "A unit", archived: bool(unitRaw.archived) ?? false } : null,
    tenancy: tenancyId
      ? {
          id: tenancyId,
          status: str(tenancyRaw?.status),
          tenants: arr(tenancyRaw?.tenants)
            .map(personName)
            .filter((item): item is string => item !== null),
        }
      : null,
    scheduledFor: str(raw.scheduled_for),
    timeZone: str(raw.time_zone),
    inspector: personName(raw.inspector),
    template: templateLabel ? { code: str(templateRaw?.code) ?? str(raw.template), label: templateLabel } : null,
    checklist,
    progress: progressOf(raw.progress) ?? (counted ? { done: counted.done, total: counted.total, counts: counted.counts } : null),
    photoCount: int(raw.photo_count),
    summary: str(raw.summary) ?? "",
    signOff: { tenant: str(signOff?.tenant_name), agent: str(signOff?.agent_name) },
    cancelReason: str(raw.cancel_reason),
    baseline: baselineRaw ? { id: str(baselineRaw.id), reference: str(baselineRaw.reference), completedAt: str(baselineRaw.completed_at) } : null,
    startedAt: str(raw.started_at),
    completedAt: str(raw.completed_at),
    cancelledAt: str(raw.cancelled_at),
    completedBy: personName(raw.completed_by),
    cancelledBy: personName(raw.cancelled_by),
    createdBy: personName(raw.created_by),
    createdAt: str(raw.created_at),
    updatedAt: str(raw.updated_at),
    can: canOf(raw.can),
  };
}

export type StatusCount = { status: string; count: number };

export type InspectionPage = { items: Inspection[]; page: number; pageSize: number; total: number; totalPages: number; statusCounts: StatusCount[] };

function statusCounts(value: unknown): StatusCount[] {
  const map = obj(value);
  if (!map) return [];
  return Object.entries(map)
    .map(([status, count]) => ({ status, count: int(count) ?? -1 }))
    .filter((item) => item.count >= 0);
}

/** The team's paged list, or the tenant's `{items}` (never paged). */
export function normaliseInspectionPage(value: unknown, fallbackPage = 1): InspectionPage {
  const raw = obj(value);
  const list = Array.isArray(value) ? value : arr(raw?.items);
  const items = list.map(normaliseInspection).filter((item): item is Inspection => item !== null);
  const pageSize = int(raw?.page_size) ?? (items.length || 25);
  const total = int(raw?.total) ?? items.length;
  return {
    items,
    page: int(raw?.page) ?? fallbackPage,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / Math.max(pageSize, 1))),
    statusCounts: statusCounts(raw?.status_counts),
  };
}

export type Template = Choice & { areas: number; items: number };

export type Limits = {
  maxAreas: number;
  maxItemsPerArea: number;
  maxItems: number;
  maxLabel: number;
  maxNote: number;
  maxSummary: number;
  maxSignOff: number;
};

export const DEFAULT_LIMITS: Limits = {
  maxAreas: AREAS_MAX,
  maxItemsPerArea: ITEMS_PER_AREA_MAX,
  maxItems: ITEMS_MAX,
  maxLabel: ITEM_LABEL_MAX,
  maxNote: FINDING_NOTE_MAX,
  maxSummary: SUMMARY_MAX,
  maxSignOff: SIGNER_NAME_MAX,
};

export type InspectionOptions = {
  types: Choice[];
  statuses: Choice[];
  findingStatuses: Choice[];
  templates: Template[];
  inspectors: { userId: string; name: string }[];
  photoRules: PhotoRules & { maxPerInspection: number };
  limits: Limits;
  write: boolean | null;
};

function choices(value: unknown, label: (code: string) => string = wordsFromCode): Choice[] {
  return arr(value)
    .map((item) => coded(item, label))
    .filter((item): item is Choice => item !== null);
}

function photoRules(value: unknown): PhotoRules & { maxPerInspection: number } {
  const raw = obj(value);
  const types = arr(raw?.types).filter((item): item is string => typeof item === "string" && item.startsWith("image/"));
  return {
    maxPhotos: int(raw?.max_photos_per_item) ?? DEFAULT_PHOTO_RULES.maxPhotos,
    maxPerInspection: int(raw?.max_photos) ?? 200,
    maxBytes: int(raw?.max_bytes) ?? DEFAULT_PHOTO_RULES.maxBytes,
    types: types.length ? types : DEFAULT_PHOTO_RULES.types,
  };
}

function limitsOf(value: unknown): Limits {
  const raw = obj(value);
  return {
    maxAreas: int(raw?.max_areas) ?? DEFAULT_LIMITS.maxAreas,
    maxItemsPerArea: int(raw?.max_items_per_area) ?? DEFAULT_LIMITS.maxItemsPerArea,
    maxItems: int(raw?.max_items) ?? DEFAULT_LIMITS.maxItems,
    maxLabel: int(raw?.max_label) ?? DEFAULT_LIMITS.maxLabel,
    maxNote: int(raw?.max_note) ?? DEFAULT_LIMITS.maxNote,
    maxSummary: int(raw?.max_summary) ?? DEFAULT_LIMITS.maxSummary,
    maxSignOff: int(raw?.max_sign_off) ?? DEFAULT_LIMITS.maxSignOff,
  };
}

/** `GET /inspections/options`: types, statuses, the checklist templates (an admin-editable reference set), inspectors, photo rules, limits. */
export function normaliseInspectionOptions(value: unknown): InspectionOptions {
  const raw = obj(value) ?? {};
  const types = choices(raw.types, inspectionTypeLabel);
  const statuses = choices(raw.statuses, inspectionStatusLabel);
  const findingStatuses = choices(raw.finding_statuses, findingWords);
  return {
    types: types.length ? types : INSPECTION_TYPES.map((code) => ({ code, label: inspectionTypeLabel(code) })),
    statuses: statuses.length ? statuses : INSPECTION_STATUSES.map((code) => ({ code, label: inspectionStatusLabel(code) })),
    findingStatuses: findingStatuses.length ? findingStatuses : FINDING_STATUSES.map((code) => ({ code, label: findingWords(code) })),
    templates: arr(raw.templates)
      .map((item) => {
        const choice = coded(item, wordsFromCode);
        if (!choice) return null;
        const areas = arr(obj(item)?.areas);
        return { ...choice, areas: areas.length, items: areas.reduce((sum: number, area) => sum + arr(obj(area)?.items).length, 0) };
      })
      .filter((item): item is Template => item !== null),
    inspectors: arr(raw.inspectors)
      .map((item) => {
        const inner = obj(item);
        const userId = str(inner?.user_id);
        const name = str(inner?.name);
        return userId && name ? { userId, name } : null;
      })
      .filter((item): item is { userId: string; name: string } => item !== null),
    photoRules: photoRules(raw.photo_rules),
    limits: limitsOf(raw.limits),
    write: bool(obj(raw.permissions)?.write),
  };
}

/** The id of a created inspection from `{inspection: {id}}`. */
export const createdInspectionId = (value: unknown): string | null => normaliseInspection(value)?.id ?? null;

/** The `details` of a `409 INSPECTION_INCOMPLETE`: how many items have no finding and (up to 50 of) their ids. */
export function incompleteFromConflict(body: unknown): { missing: number; itemIds: string[] } | null {
  const details = obj(obj(obj(body)?.error)?.details) ?? obj(obj(body)?.details);
  if (!details) return null;
  const itemIds = arr(details.item_ids).filter((item): item is string => typeof item === "string");
  return { missing: int(details.missing) ?? itemIds.length, itemIds };
}

// ---- Request bodies and who may do what ---------------------------------------------------------------

/**
 * `PUT /inspections/{id}/checklist`: the whole structure in order. An area or
 * item with an id is kept (an item keeps its finding and photos); one with
 * `id: null` is added; one left out is removed with its finding and photos.
 */
export function checklistBody(list: Checklist): Record<string, unknown> {
  return {
    areas: list.map((area) => ({
      id: area.id,
      label: area.name.trim(),
      items: area.items.map((item) => ({ id: item.id, label: item.label.trim() })),
    })),
  };
}

/** `PUT /inspections/{id}/findings` (partial): only the lines given change. */
export const findingsBody = (lines: readonly FindingLine[]): Record<string, unknown> => ({ items: lines });

/** `POST /inspections/{id}/complete`: the summary and the typed sign-off names (each may be null). */
export function completeBody(form: CompleteForm): Record<string, unknown> {
  return { summary: form.summary.trim() || null, tenant_sign_off_name: form.tenant.trim() || null, agent_sign_off_name: form.agent.trim() || null };
}

export const canWriteInspections = (role: string | null | undefined) => ["OWNER", "MANAGER", "AGENT"].includes(role ?? "");

/** What the page offers: the API's `can` when it sends one, else the role and the status (STAFF read). */
export function inspectionActions(inspection: { status: string; can: InspectionCan | null }, role: string | null | undefined): InspectionCan {
  if (inspection.can) return inspection.can;
  const editable = canWriteInspections(role) && isEditableStatus(inspection.status);
  return {
    edit: editable,
    editChecklist: editable,
    recordFindings: editable,
    addPhoto: editable,
    start: editable && inspection.status === "SCHEDULED",
    complete: editable && inspection.status === "IN_PROGRESS",
    cancel: editable,
  };
}

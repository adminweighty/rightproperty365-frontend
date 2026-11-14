import type { OnboardingDetails } from "@/lib/api/onboarding";
import type { Option } from "@/lib/api/types";

/**
 * How each onboarding detail is asked for and shown. WHICH details a role has,
 * and which are required, comes from the API (GET /v1/onboarding/requirements);
 * this only says what a detail is called on screen and which control it uses.
 * A detail the app does not know yet falls back to a plain text field.
 */
export type FieldKind = "text" | "textarea" | "phone" | "list" | "country" | "city" | "trade" | "agency";

export type FieldSpec = {
  label: string;
  kind: FieldKind;
  hint?: string;
  maxLength?: number;
  /** Seen only by the verification team; never shown on a public profile. */
  private?: boolean;
  autoComplete?: string;
};

const PHONE_HINT =
  "Only our verification team uses this number, to reach you about this application. It is never shown publicly. Include the country code, for example +263 77 123 4567.";

const specs: Record<string, FieldSpec> = {
  business_name: {
    label: "Business name",
    kind: "text",
    maxLength: 120,
    hint: "As it should appear on your public profile.",
    autoComplete: "organization",
  },
  tagline: { label: "Tagline", kind: "text", maxLength: 140, hint: "One line about what you do. Shown on your profile." },
  description: {
    label: "About the business",
    kind: "textarea",
    maxLength: 2000,
    hint: "Shown on your public profile. Plain text.",
  },
  country: { label: "Country", kind: "country", hint: "Where the business is based. Type a name or a country code." },
  // One of the two is asked for, depending on the country: a list where we have one, a text box where we do not.
  city: { label: "City or town", kind: "city", hint: "Where the business is based." },
  city_name: {
    label: "City or town",
    kind: "text",
    maxLength: 80,
    hint: "Where the business is based. We have no list of cities for this country yet, so type the name.",
    autoComplete: "address-level2",
  },
  areas: { label: "Areas covered", kind: "list", hint: "Separate areas with commas. Up to 12." },
  services: { label: "Services", kind: "list", hint: "Separate services with commas. Up to 12." },
  trade: { label: "Trade", kind: "trade", hint: "The trade your profile is listed under." },
  registration_number: {
    label: "Business registration number",
    kind: "text",
    maxLength: 60,
    private: true,
    hint: "Only our verification team sees this. It is never shown publicly.",
  },
  contact_phone: { label: "Contact phone number", kind: "phone", private: true, hint: PHONE_HINT, autoComplete: "tel" },
  agency_slug: {
    label: "Agency you work for",
    kind: "agency",
    hint: "Only verified agencies are listed. If yours is missing, its owner needs to register it first.",
  },
  job_title: { label: "Job title", kind: "text", maxLength: 80, autoComplete: "organization-title" },
  bio: { label: "About you", kind: "textarea", maxLength: 1000, hint: "Shown on your public agent profile. Plain text." },
};

const humanise = (name: string) => {
  const words = name.replaceAll("_", " ");
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
};

export const fieldSpec = (name: string): FieldSpec => specs[name] ?? { label: humanise(name), kind: "text" };

/** A choice with, for a country, its code as a search word and, for a city, the code of its country. */
export type ChoiceOption = Option & { keywords?: string[]; country?: string };

/** The lists the choice fields pick from, loaded from the API by the page. */
export type FieldLists = {
  /** Every country, by name. */
  countries: ChoiceOption[];
  /** The cities of every country that has reference cities, each with its country. */
  cities: ChoiceOption[];
  trades: Option[];
  agencies: Option[];
};

export function fieldOptions(kind: FieldKind, lists: FieldLists): ChoiceOption[] {
  if (kind === "country") return lists.countries;
  if (kind === "city") return lists.cities;
  if (kind === "trade") return lists.trades;
  if (kind === "agency") return lists.agencies;
  return [];
}

/**
 * Which of `city` (a choice) and `city_name` (free text) a form asks for.
 * The API needs exactly one: the choice where the chosen country has cities
 * in the reference data, the text where it has none. Neither is asked for
 * until a country is chosen. A role without a `country` field (an older API)
 * keeps its plain city choice.
 */
export function cityFieldFor(fieldNames: string[], country: string, lists: FieldLists): "city" | "city_name" | null {
  if (!fieldNames.includes("country")) return fieldNames.includes("city") ? "city" : null;
  if (!country) return null;
  const hasCities = lists.cities.some((city) => city.country === country);
  if (hasCities) return fieldNames.includes("city") ? "city" : null;
  return fieldNames.includes("city_name") ? "city_name" : null;
}

/**
 * The details to show read-only: of `city` and `city_name` only the one that
 * was given (or `city` when neither was), so the place is one line.
 */
export function shownDetailNames(fieldNames: string[], details: OnboardingDetails): string[] {
  const typed = Boolean(fieldText(details, "city_name"));
  return fieldNames.filter((name) => (name === "city_name" ? typed : name === "city" ? !typed : true));
}

/** A stored value as text for a form control. */
export function fieldText(details: OnboardingDetails, name: string): string {
  const value = (details as Record<string, unknown>)[name];
  if (Array.isArray(value)) return value.join(", ");
  return typeof value === "string" ? value : "";
}

/** A stored value as it is shown read-only: codes become labels. Empty when not set. */
export function fieldDisplay(details: OnboardingDetails, name: string, lists: FieldLists): string {
  const text = fieldText(details, name);
  const options = fieldOptions(fieldSpec(name).kind, lists);
  return options.find((option) => option.value === text)?.label ?? text;
}

/** What a form control holds, as the API expects it: lists split, phone without spaces, "" as null. */
export function fieldValue(name: string, text: string): string | string[] | null {
  const { kind } = fieldSpec(name);
  const trimmed = text.trim();
  if (kind === "list") {
    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (kind === "phone") return trimmed.replace(/[\s()-]/g, "") || null;
  return trimmed || null;
}

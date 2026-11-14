import type { OnboardingDetails } from "@/lib/api/onboarding";
import type { Option } from "@/lib/api/types";

/**
 * How each onboarding detail is asked for and shown. WHICH details a role has,
 * and which are required, comes from the API (GET /v1/onboarding/requirements);
 * this only says what a detail is called on screen and which control it uses.
 * A detail the app does not know yet falls back to a plain text field.
 */
export type FieldKind = "text" | "textarea" | "phone" | "list" | "city" | "trade" | "agency";

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
  city: { label: "City or town", kind: "city", hint: "Where the business is based." },
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

/** The lists the choice fields pick from, loaded from the API by the page. */
export type FieldLists = { cities: Option[]; trades: Option[]; agencies: Option[] };

export function fieldOptions(kind: FieldKind, lists: FieldLists): Option[] {
  if (kind === "city") return lists.cities;
  if (kind === "trade") return lists.trades;
  if (kind === "agency") return lists.agencies;
  return [];
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

import type { ReferenceItem } from "@/lib/api/types";
import { getAllCountries, getCatalogue } from "./reference";

/**
 * The lists the listing editor and the review page choose from and label
 * with, read on the server from the API's reference data. The listing itself
 * is private and is read in the browser.
 */

export type EditorOption = {
  value: string;
  label: string;
  /** Search words: a country's ISO code. */
  keywords?: string[];
  /** The code of what it sits in: a type's category, a city's region, a suburb's city. */
  parent?: string;
  /** The country of a place. */
  country?: string;
  /** A feature's group heading. */
  group?: string;
};

export type ListingEditorLists = {
  /** Every country: a listing may be anywhere. */
  countries: (EditorOption & { currency: string })[];
  deals: EditorOption[];
  categories: EditorOption[];
  propertyTypes: EditorOption[];
  periods: EditorOption[];
  features: EditorOption[];
  /** The reference places of every country that has them. Elsewhere places are free text. */
  regions: EditorOption[];
  cities: EditorOption[];
  suburbs: EditorOption[];
};

const plain = (items: ReferenceItem[]): EditorOption[] => items.map(({ code, label }) => ({ value: code, label }));

const place = (items: ReferenceItem[]): EditorOption[] =>
  items.map(({ code, label, parent_code, market_code }) => ({
    value: code,
    label,
    parent: parent_code ?? undefined,
    country: market_code ?? undefined,
  }));

export async function getListingEditorLists(): Promise<ListingEditorLists> {
  const [catalogue, countries] = await Promise.all([getCatalogue(), getAllCountries()]);
  const { sets } = catalogue;
  return {
    countries: countries
      .map(({ code, name, currency_code }) => ({ value: code, label: name, keywords: [code], currency: currency_code }))
      .sort((a, b) => a.label.localeCompare(b.label, "en-GB")),
    deals: plain(sets.deal_types),
    categories: plain(sets.property_categories),
    propertyTypes: sets.property_types.map(({ code, label, parent_code }) => ({
      value: code,
      label,
      parent: parent_code ?? undefined,
    })),
    periods: plain(sets.price_periods),
    features: sets.listing_features.map(({ code, label, group }) => ({ value: code, label, group: group?.label })),
    regions: place(sets.regions),
    cities: place(sets.cities),
    suburbs: place(sets.suburbs),
  };
}

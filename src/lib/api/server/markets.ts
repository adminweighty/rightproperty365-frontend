import { getAllCountries } from "./reference";

export type MarketOption = { value: string; label: string; secondary?: string; keywords?: string[] };

/** Every country a property can be in (the API's reference data), by name, for the property form. */
export async function getMarketOptions(): Promise<MarketOption[]> {
  const countries = await getAllCountries();
  return countries
    .filter((country) => /^[A-Z]{2}$/.test(country.code))
    .map((country) => ({ value: country.code, label: country.name, secondary: country.code, keywords: [country.currency_code] }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

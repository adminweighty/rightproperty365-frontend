import { getAllCountries } from "./reference";

export type CurrencyOption = { value: string; label: string; secondary?: string; keywords?: string[] };

/** Currencies a rent can be in: every country's currency (from the API's reference data), the common ones first. */
export async function getCurrencyOptions(): Promise<CurrencyOption[]> {
  const countries = await getAllCountries();
  const byCode = new Map<string, string[]>();
  for (const country of countries) {
    if (!/^[A-Z]{3}$/.test(country.currency_code ?? "")) continue;
    byCode.set(country.currency_code, [...(byCode.get(country.currency_code) ?? []), country.name]);
  }
  const first = ["USD", "ZAR", "GBP", "EUR", "ZWG"];
  const codes = [...byCode.keys()].sort((a, b) => {
    const rank = (code: string) => (first.includes(code) ? first.indexOf(code) : first.length);
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  if (!byCode.has("USD")) codes.unshift("USD");
  return codes.map((code) => {
    const names = byCode.get(code) ?? [];
    return { value: code, label: code, keywords: names, ...(names.length ? { secondary: names.length > 2 ? `${names.slice(0, 2).join(", ")}…` : names.join(", ") } : {}) };
  });
}

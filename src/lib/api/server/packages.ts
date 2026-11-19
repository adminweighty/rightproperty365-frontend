import { cacheLife, cacheTag } from "next/cache";
import type { PublicPricing } from "@/lib/api/packages";
import { apiGet } from "./client";
import { getAllCountries, getListingCountries } from "./reference";

const CODE = /^[A-Za-z]{2}$/;

/**
 * The active listing packages of one country with their prices (API 0.37.0,
 * `GET /v1/markets/{code}/packages`). Null for a country the API does not
 * know. The API caches the answer for five minutes; so does this.
 */
export async function getMarketPricing(code: string): Promise<PublicPricing | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("packages");
  if (!CODE.test(code)) return null;
  const { status, data } = await apiGet<PublicPricing>(`/v1/markets/${code.toUpperCase()}/packages`, [400, 404]);
  return status === 200 ? data : null;
}

/**
 * The countries that have published listings and at least one active
 * package, by name: the countries the pricing pages are offered for.
 */
export async function getPricingMarkets(): Promise<PublicPricing[]> {
  const countries = await getListingCountries();
  const answers = await Promise.all(countries.map((country) => getMarketPricing(country.code)));
  return answers
    .filter((answer): answer is PublicPricing => Boolean(answer && answer.items.length > 0))
    .sort((a, b) => a.market.name.localeCompare(b.market.name));
}

/** Every country with its currency, by name, for the package form. */
export async function getPackageMarketOptions(): Promise<{ value: string; label: string; secondary: string; currency: string }[]> {
  const countries = await getAllCountries();
  return countries
    .filter((country) => /^[A-Z]{2}$/.test(country.code))
    .map((country) => ({ value: country.code, label: country.name, secondary: country.code, currency: country.currency_code }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

import type { Money } from "@/lib/api/types";

/**
 * Formats a decimal-string amount with its explicit ISO 4217 currency.
 * Amounts stay strings end to end; Number() is used for display only.
 *
 * The locale decides only the grouping of digits ("USD 385,000"). It is
 * British English, the language of the site, not the locale of any one
 * country: the currency is always shown by its code ("GBP 185", "MUR 8,500"),
 * whatever the currency, because a listing can be priced in any of them.
 */
export function formatMoney({ amount, currency }: Money, locale = "en-GB"): string {
  const value = Number(amount);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "code",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    // Not a well-formed ISO 4217 code: Intl refuses it. Show what the API sent.
    return `${currency} ${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)}`.trim();
  }
}

export function formatArea(squareMetres: number, locale = "en-GB"): string {
  return `${new Intl.NumberFormat(locale).format(squareMetres)} m²`;
}

/**
 * "per month", "per night": the label of a `price_periods` code. Pass the
 * reference labels where the page has them; a code without one reads "per <code>".
 */
export function pricePeriodLabel(period: string, labels: Record<string, string> = {}): string {
  return labels[period] ?? `per ${period}`;
}

/**
 * The English name of a country from its ISO code ("ZW" → "Zimbabwe"), for
 * wording where the page has no country list; the code itself when unknown.
 */
export function countryName(code: string, locale = "en-GB"): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

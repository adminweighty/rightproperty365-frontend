import type { Money } from "@/lib/api/types";

/**
 * Formats a decimal-string amount with its explicit ISO 4217 currency.
 * Amounts stay strings end to end; Number() is used for display only.
 *
 * The locale decides only the grouping of digits ("USD 385,000"). It is
 * British English, the language of the site, not the locale of any one
 * market: the currency is always shown by its code.
 */
export function formatMoney({ amount, currency }: Money, locale = "en-GB"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "code",
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export function formatArea(squareMetres: number, locale = "en-GB"): string {
  return `${new Intl.NumberFormat(locale).format(squareMetres)} m²`;
}

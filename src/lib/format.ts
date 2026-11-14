import type { Money } from "@/lib/api/types";

/**
 * Formats a decimal-string amount with its explicit ISO 4217 currency.
 * Amounts stay strings end to end; Number() is used for display only.
 */
export function formatMoney({ amount, currency }: Money, locale = "en-ZW"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "code",
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export function formatArea(squareMetres: number, locale = "en-ZW"): string {
  return `${new Intl.NumberFormat(locale).format(squareMetres)} m²`;
}

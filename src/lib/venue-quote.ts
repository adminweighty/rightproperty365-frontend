/**
 * Quotes for a venue let by the hour (API 0.33.0), as pure functions: read
 * the API's quote tolerantly and turn it into the rows a visitor reads.
 *
 * Amounts are exact decimal strings from the API, in one currency. They are
 * never turned into floating-point numbers: the digits are only grouped for
 * reading ("1234.50" is "1,234.50"), so what is shown is what was quoted.
 *
 * This file must stay free of imports and of TypeScript-only syntax that is
 * not erasable: Node runs it directly for the tests (scripts/venue-quote.test.mjs).
 */

/** The contract's wording (decision D-04); the API's `notice` is shown when it sends one. */
export const NO_PAYMENT_NOTICE =
  "This is an estimate. No payment is taken on RightProperty365; the host confirms and arranges payment with you.";

export type QuoteLine = { code: string; label: string; amount: string };

export type VenueQuote = {
  id: string;
  expiresAt: string | null;
  currency: string;
  lines: QuoteLine[];
  subtotal: string | null;
  deposit: string | null;
  totalExcludingDeposit: string | null;
  start: string;
  end: string;
  timeZone: string | null;
  localStart: string | null;
  localEnd: string | null;
  mode: string;
  notice: string;
  /** A line or total in another currency: the quote cannot be shown (FR-023 never mixes them). */
  mixedCurrency: boolean;
};

type Raw = Record<string, unknown>;
const obj = (value: unknown): Raw => (value && typeof value === "object" ? (value as Raw) : {});
const DECIMAL = /^-?\d+(\.\d+)?$/;

/** An amount as the API may send it: "50.00", 50, or `{amount, currency}`. Null when there is none. */
function amountOf(value: unknown): { amount: string; currency: string | null } | null {
  if (typeof value === "string" && DECIMAL.test(value.trim())) return { amount: value.trim(), currency: null };
  if (typeof value === "number" && Number.isFinite(value)) return { amount: String(value), currency: null };
  const raw = obj(value);
  if ("amount" in raw) {
    const inner = amountOf(raw.amount);
    if (!inner) return null;
    return { amount: inner.amount, currency: typeof raw.currency === "string" ? raw.currency : null };
  }
  return null;
}

/** "1234.5" -> "1,234.5"; the digits after the point are kept as sent. */
export function groupDigits(amount: string): string {
  const text = amount.trim();
  if (!DECIMAL.test(text)) return text;
  const negative = text.startsWith("-");
  const [whole, fraction] = (negative ? text.slice(1) : text).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}${fraction !== undefined ? `.${fraction}` : ""}`;
}

/** "USD 1,234.50": the currency code always shown. A negative amount (a discount) is "-USD 10.00". */
export function formatAmount(amount: string, currency: string): string {
  const grouped = groupDigits(amount);
  return grouped.startsWith("-") ? `-${currency} ${grouped.slice(1)}` : `${currency} ${grouped}`;
}

/** True for a decimal string that is zero ("0", "0.00"). */
export const isZero = (amount: string | null) => amount !== null && /^-?0+(\.0+)?$/.test(amount.trim());

/**
 * `POST /v1/venues/{id}/quotes`, read tolerantly: the quote itself or
 * `{quote: …}`; amounts as strings, numbers or `{amount, currency}`. Null
 * when it has no id or no currency.
 */
export function normaliseQuote(value: unknown): VenueQuote | null {
  const outer = obj(value);
  const raw = outer.quote && typeof outer.quote === "object" ? obj(outer.quote) : outer;
  const id = String(raw.quote_id ?? raw.id ?? "");
  const currency = String(raw.currency ?? obj(raw.total).currency ?? "");
  if (!id || !/^[A-Z]{3}$/.test(currency)) return null;
  let mixed = false;
  const read = (input: unknown): string | null => {
    const found = amountOf(input);
    if (!found) return null;
    if (found.currency && found.currency !== currency) mixed = true;
    return found.amount;
  };
  const lines = (Array.isArray(raw.lines) ? raw.lines : [])
    .map((item): QuoteLine | null => {
      const line = obj(item);
      if (typeof line.currency === "string" && line.currency !== currency) mixed = true;
      const amount = read(line.amount);
      if (amount === null) return null;
      return { code: String(line.code ?? ""), label: String(line.label ?? line.code ?? ""), amount };
    })
    .filter((item): item is QuoteLine => item !== null);
  const text = (key: string) => (typeof raw[key] === "string" && raw[key] !== "" ? (raw[key] as string) : null);
  return {
    id,
    expiresAt: text("expires_at"),
    currency,
    lines,
    subtotal: read(raw.subtotal),
    deposit: read(raw.deposit),
    totalExcludingDeposit: read(raw.total_excluding_deposit ?? raw.total),
    start: String(raw.start ?? raw.start_utc ?? ""),
    end: String(raw.end ?? raw.end_utc ?? ""),
    timeZone: text("time_zone") ?? text("timezone"),
    localStart: text("local_start"),
    localEnd: text("local_end"),
    mode: String(raw.mode ?? "ENQUIRY"),
    notice: text("notice") ?? NO_PAYMENT_NOTICE,
    mixedCurrency: mixed,
  };
}

export type QuoteRow = {
  key: string;
  label: string;
  value: string;
  /** A total: drawn with weight and a rule above it. */
  total?: boolean;
  /** Said apart from the total: the deposit is not part of it. */
  aside?: boolean;
};

/**
 * The rows of the itemised quote, in order: each line in the API's words,
 * the subtotal when it differs from the total, the total without the
 * deposit, and the deposit "payable to the host if confirmed".
 */
export function quoteRows(quote: Pick<VenueQuote, "currency" | "lines" | "subtotal" | "deposit" | "totalExcludingDeposit">): QuoteRow[] {
  const rows: QuoteRow[] = quote.lines.map((line, index) => ({
    key: `line-${index}-${line.code}`,
    label: line.label || line.code,
    value: formatAmount(line.amount, quote.currency),
  }));
  const total = quote.totalExcludingDeposit ?? quote.subtotal;
  if (quote.subtotal !== null && quote.subtotal !== total && quote.lines.length > 1) {
    rows.push({ key: "subtotal", label: "Subtotal", value: formatAmount(quote.subtotal, quote.currency) });
  }
  if (total !== null) {
    rows.push({ key: "total", label: "Estimated total", value: formatAmount(total, quote.currency), total: true });
  }
  if (quote.deposit !== null && !isZero(quote.deposit)) {
    rows.push({
      key: "deposit",
      label: "Deposit, payable to the host if confirmed",
      value: formatAmount(quote.deposit, quote.currency),
      aside: true,
    });
  }
  return rows;
}

/** "Valid until 14:30" for a quote that expires (on the visitor's clock, which is when they act). */
export function expiryText(expiresAt: string | null, now: number = Date.now()): string | null {
  if (!expiresAt) return null;
  const at = Date.parse(expiresAt);
  if (Number.isNaN(at)) return null;
  if (at <= now) return "This estimate has expired. Choose the time again for a new one.";
  const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(at));
  return `This estimate is held for your request until ${clock} your time.`;
}

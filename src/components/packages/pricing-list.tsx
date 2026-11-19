import { Badge } from "@/components/ui/badge";
import type { PublicPricing } from "@/lib/api/packages";
import { billingTermLabel, billingTermPer, formatPrice } from "@/lib/packages";

/**
 * The active packages of one country, each with its listing limit and its
 * price per billing term exactly as the API gives it. A price written by the
 * development seed is labelled "Sample price"; nothing is invented for a
 * term without a price.
 */
export function PricingList({ pricing }: { pricing: PublicPricing }) {
  const months = new Map(pricing.billing_terms.map((term) => [term.code, term.months]));
  return (
    <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {pricing.items.map((item) => (
        <li key={item.code} className="flex">
          <article aria-labelledby={`package-${item.code}`} className="frame-brand flex w-full flex-col rounded-lg border border-line bg-surface p-6 shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id={`package-${item.code}`} className="text-2xl">
                {item.name}
              </h2>
              {item.is_default && <Badge tone="primary">Where every account starts</Badge>}
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums text-primary-ink">
              {item.listing_limit}
              <span className="ml-2 text-base font-medium text-ink">
                {item.listing_limit === 1 ? "listing live at once" : "listings live at once"}
              </span>
            </p>
            {item.description && <p className="mt-3 leading-relaxed text-muted">{item.description}</p>}
            <div className="mt-auto pt-5">
              {item.prices.length === 0 ? (
                <p className="text-sm text-muted">Ask us for the price of this package.</p>
              ) : (
                <dl className="divide-y divide-line border-t border-line">
                  {item.prices.map((price) => (
                    <div key={price.billing_term} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
                      <dt className="text-sm text-muted">{billingTermLabel(price.billing_term, price.billing_term_label)}</dt>
                      <dd className="text-right">
                        <span className="font-semibold tabular-nums text-ink">{formatPrice(price.amount, price.currency, price.minor_unit)}</span>
                        <span className="text-sm text-muted"> {billingTermPer(price.billing_term, months.get(price.billing_term))}</span>
                        {price.sample && (
                          <Badge tone="warning" className="ml-2 align-middle">
                            Sample price
                          </Badge>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}

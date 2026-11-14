import { Badge } from "@/components/ui/badge";
import { load } from "@/lib/api/server/load";
import { getMarkets } from "@/lib/api/server/reference";

/**
 * Market details in the header and footer, from GET /v1/markets. Both are
 * async and read the API, so they are rendered inside `<Suspense>`.
 */

/** "Zimbabwe · USD" for the market the site is showing. Nothing when it cannot be loaded. */
export async function ActiveMarketLabel() {
  const loaded = await load(getMarkets);
  const market = loaded.ok ? loaded.data.find(({ status }) => status === "ACTIVE") : undefined;
  if (!market) return null;

  return (
    <span data-overlay-part className="hidden text-sm text-muted lg:inline" title="Current market">
      {market.name} · {market.currency_code}
    </span>
  );
}

/** Every market with its status, which keeps the multi-country roadmap honest. */
export async function MarketList() {
  const loaded = await load(getMarkets);
  if (!loaded.ok) {
    return <p className="mt-3 text-sm text-muted">The list of markets could not be loaded.</p>;
  }

  return (
    <ul className="mt-3 space-y-2">
      {loaded.data.map((market) => (
        <li key={market.code} className="flex items-center gap-2 text-sm text-muted">
          {market.name}
          {market.status === "ACTIVE" ? (
            <Badge tone="success">Live</Badge>
          ) : market.status === "SUSPENDED" ? (
            <Badge tone="warning">Paused</Badge>
          ) : (
            <Badge>Planned</Badge>
          )}
        </li>
      ))}
    </ul>
  );
}

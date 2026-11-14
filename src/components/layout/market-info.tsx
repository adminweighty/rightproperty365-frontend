import { Badge } from "@/components/ui/badge";
import { load } from "@/lib/api/server/load";
import { getMarkets } from "@/lib/api/server/reference";

/**
 * Every market with its status, from GET /v1/markets, which keeps the
 * multi-country roadmap honest. Shown in the footer. It is async and reads
 * the API, so it is rendered inside `ApiBoundary`.
 */
export async function MarketList() {
  const loaded = await load(getMarkets);
  if (!loaded.ok) {
    return <p className="mt-3 text-sm text-muted">The list of markets could not be loaded.</p>;
  }

  return (
    <ul className="mt-3 space-y-2">
      {loaded.data.map((market) => (
        <li key={market.code} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
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

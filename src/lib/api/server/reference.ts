import { cacheLife, cacheTag } from "next/cache";
import type { Market, ReferenceSets } from "@/lib/api/types";
import { apiGet, queryString } from "./client";

/** Reference data changes rarely: revalidate hourly, or on demand by tag. */
export async function getMarkets(): Promise<Market[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("markets");
  const { data } = await apiGet<{ data: Market[] }>("/v1/markets");
  return data.data;
}

async function getReferenceSets(marketCode: string | undefined): Promise<ReferenceSets> {
  "use cache";
  cacheLife("hours");
  cacheTag("reference");
  const { data } = await apiGet<{ sets: ReferenceSets }>(
    `/v1/reference${queryString({ market: marketCode })}`,
  );
  return data.sets;
}

/** Everything behind the drop-downs, filters and labels, for the active market. */
export type Catalogue = {
  /** The market the site is showing: the first ACTIVE one. */
  market: Market | null;
  markets: Market[];
  sets: ReferenceSets;
};

export async function getCatalogue(): Promise<Catalogue> {
  const markets = await getMarkets();
  const market = markets.find(({ status }) => status === "ACTIVE") ?? null;
  return { market, markets, sets: await getReferenceSets(market?.code) };
}

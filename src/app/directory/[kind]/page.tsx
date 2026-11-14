import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProfileGrid } from "@/components/directory/profile-card";
import { GetForm } from "@/components/listings/get-form";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { JsonLd } from "@/components/seo/json-ld";
import { Container } from "@/components/ui/container";
import { ErrorState } from "@/components/ui/error-state";
import { getDirectoryKinds, getDirectoryList } from "@/lib/api/server/directory";
import { load, readAtBuild } from "@/lib/api/server/load";
import { getCatalogue } from "@/lib/api/server/reference";
import type { DirectoryProfile, ReferenceItem } from "@/lib/api/types";
import { directoryJsonLd } from "@/lib/seo";
import { ApiBoundary } from "@/components/api-boundary";

type Props = PageProps<"/directory/[kind]">;

// The content reads the address and the API with no <Suspense> around it
// (ApiBoundary), so an address that was not prerendered has no static shell:
// the server renders the whole page before it answers. That keeps the content
// in the HTML, visible without JavaScript.
export const instant = false;

/** Cache Components needs at least one param to build the route's shell. This is never a directory. */
const SHELL_ONLY = [{ kind: "not-prerendered" }];

// Every directory is prerendered when the API is reachable during the build.
export async function generateStaticParams() {
  const kinds = await readAtBuild(getDirectoryKinds);
  return kinds?.length ? kinds.map(({ code }) => ({ kind: code })) : SHELL_ONLY;
}

type RawParams = Awaited<Props["searchParams"]>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || undefined;

/**
 * The directory, optionally narrowed to a country or a region
 * (`?region=harare`). A code that is not in the reference data is ignored.
 */
async function readDirectory(kind: string, params: RawParams = {}) {
  const [kinds, catalogue] = await Promise.all([getDirectoryKinds(), getCatalogue()]);
  const country = catalogue.markets.find(({ code }) => code === first(params.country))?.code;
  const region = (catalogue.sets.regions ?? []).find(({ code }) => code === first(params.region))?.code;
  const filters = { country, region };
  return { list: await getDirectoryList(kind, filters), kinds, catalogue, filters, filtered: Boolean(country || region) };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ kind }, query] = await Promise.all([params, searchParams]);
  const loaded = await load(() => readDirectory(kind, query));
  if (!loaded.ok) return { title: "Directory", robots: { index: false, follow: true } };

  const { list, catalogue } = loaded.data;
  if (!list) return { title: "Directory not found", robots: { index: false, follow: true } };

  const title = catalogue.market ? `${list.kind.label} in ${catalogue.market.name}` : list.kind.label;
  const { description } = list.kind;
  const path = `/directory/${list.kind.code}`;
  // A filtered list is a subset of the directory: not indexed, no canonical (docs/seo.md).
  if (loaded.data.filtered) return { title, description, robots: { index: false, follow: true } };
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", title, description, url: path, images: ["/opengraph-image"] },
  };
}

export default function DirectoryKindPage({ params, searchParams }: Props) {
  return (
    <Container className="py-10 md:py-14">
      <ApiBoundary fallback={<div aria-busy="true" className="h-96 rounded-lg bg-sunken" />}>
        <DirectoryList params={params} searchParams={searchParams} />
      </ApiBoundary>
    </Container>
  );
}

type TradeGroup = { code: string; label: string; entries: DirectoryProfile[] };

/** Profiles under their trade, in the order of the API's `service_trades` set. */
function groupByTrade(profiles: DirectoryProfile[], trades: ReferenceItem[]): TradeGroup[] {
  const groups: TradeGroup[] = trades.map(({ code, label }) => ({ code, label, entries: [] }));
  for (const profile of profiles) {
    if (!profile.trade) continue;
    let group = groups.find((item) => item.code === profile.trade?.code);
    if (!group) {
      // A trade that has since been retired still labels its profiles.
      group = { ...profile.trade, entries: [] };
      groups.push(group);
    }
    group.entries.push(profile);
  }
  return groups.filter((group) => group.entries.length > 0);
}

/** Profiles that have a trade, grouped under it, with jump links to each group. */
function ProfilesByTrade({ groups, others }: { groups: TradeGroup[]; others: DirectoryProfile[] }) {
  return (
    <>
      <nav aria-label="Trades" className="mt-8">
        <ul className="flex flex-wrap gap-2">
          {groups.map((group) => (
            <li key={group.code}>
              <a
                href={`#${group.code}`}
                className="flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-medium text-ink transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary-ink"
              >
                {group.label}
                <span className="tabular-nums text-muted">{group.entries.length}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {groups.map((group) => (
        <section key={group.code} id={group.code} aria-labelledby={`${group.code}-heading`} className="mt-12 scroll-mt-28">
          <h2 id={`${group.code}-heading`} className="text-2xl">
            {group.label}
          </h2>
          <div className="mt-6">
            <ProfileGrid profiles={group.entries} />
          </div>
        </section>
      ))}

      {others.length > 0 && (
        <section aria-labelledby="other-services-heading" className="mt-12">
          <h2 id="other-services-heading" className="text-2xl">
            Other services
          </h2>
          <div className="mt-6">
            <ProfileGrid profiles={others} />
          </div>
        </section>
      )}
    </>
  );
}

async function DirectoryList({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ kind: kindCode }, query] = await Promise.all([params, searchParams]);
  const loaded = await load(() => readDirectory(kindCode, query));
  if (!loaded.ok) {
    return <ErrorState title="We could not load this directory." retryHref={`/directory/${kindCode}`} />;
  }
  const { list, kinds, catalogue, filters, filtered } = loaded.data;
  if (!list) notFound();
  const regions = catalogue.sets.regions ?? [];

  const { kind, profiles } = list;
  const hasSponsored = profiles.some((profile) => profile.sponsored);
  // Only profiles with a trade are grouped; today those are the service providers.
  const tradeGroups = groupByTrade(profiles, catalogue.sets.service_trades);

  return (
    <>
      {!filtered && <JsonLd data={directoryJsonLd(kind, profiles, catalogue.market)} />}
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
          <li>
            <Link href="/" className="hover:text-ink hover:underline">
              Home
            </Link>
          </li>
          <ChevronRight className="size-4" aria-hidden="true" />
          <li>
            <Link href="/directory" className="hover:text-ink hover:underline">
              Directory
            </Link>
          </li>
          <ChevronRight className="size-4" aria-hidden="true" />
          <li aria-current="page" className="text-ink">
            {kind.label}
          </li>
        </ol>
      </nav>

      <h1 className="mt-6 text-3xl md:text-4xl">
        {kind.label}
        {catalogue.market && ` in ${catalogue.market.name}`}
      </h1>
      <p className="mt-3 max-w-2xl text-muted">{kind.description}</p>
      <p className="mt-2 text-sm text-muted" role="status">
        {list.total === 1 ? "1 profile" : `${list.total} profiles`}
        {hasSponsored && " · sponsored profiles are shown first"}
      </p>

      {/* A plain GET form: it works without JavaScript and the filtered list has its own address. */}
      <GetForm
        action={`/directory/${kind.code}`}
        role="search"
        aria-label={`Filter ${kind.label}`}
        className="mt-6 grid gap-4 rounded-xl border border-line bg-surface p-4 shadow-xs sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <Field id="directory-country" label="Country">
          <Select id="directory-country" name="country" defaultValue={filters.country ?? ""}>
            <option value="">Any country</option>
            {catalogue.markets.map((market) => (
              <option key={market.code} value={market.code}>
                {market.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="directory-region" label="Region or province">
          <Select id="directory-region" name="region" defaultValue={filters.region ?? ""}>
            <option value="">Any region</option>
            {regions.map((region) => (
              <option key={region.code} value={region.code}>
                {region.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex gap-3">
          <Button type="submit">Apply</Button>
          {filtered && (
            <ButtonLink href={`/directory/${kind.code}`} variant="secondary">
              Clear
            </ButtonLink>
          )}
        </div>
      </GetForm>

      {profiles.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-line-strong p-10 text-center text-muted">
          {filtered ? "No profiles match those filters." : "No profiles are listed here yet."}
        </p>
      ) : tradeGroups.length > 0 ? (
        <ProfilesByTrade groups={tradeGroups} others={profiles.filter((profile) => !profile.trade)} />
      ) : (
        <div className="mt-8">
          <ProfileGrid profiles={profiles} />
        </div>
      )}

      <nav aria-label="Other directories" className="mt-16 border-t border-line pt-10">
        <h2 className="text-xl">Other directories</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {kinds
            .filter((other) => other.code !== kind.code)
            .map((other) => (
              <li key={other.code}>
                <Link
                  href={`/directory/${other.code}`}
                  className="flex min-h-11 items-center rounded-full border border-line-strong bg-surface px-4 text-sm font-medium text-ink transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary-ink"
                >
                  {other.label}
                </Link>
              </li>
            ))}
        </ul>
      </nav>
    </>
  );
}

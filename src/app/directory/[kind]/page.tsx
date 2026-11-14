import { countryInSentence } from "@/lib/countries";
import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProfileGrid } from "@/components/directory/profile-card";
import { GetForm } from "@/components/listings/get-form";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Reveal } from "@/components/motion/reveal";
import { Stagger } from "@/components/motion/stagger";
import { JsonLd } from "@/components/seo/json-ld";
import { Container } from "@/components/ui/container";
import { ErrorState } from "@/components/ui/error-state";
import { getDirectoryKinds, getDirectoryList } from "@/lib/api/server/directory";
import { load, readAtBuild } from "@/lib/api/server/load";
import { getAllCountries, getCatalogue, placesIn } from "@/lib/api/server/reference";
import { joinPlaces } from "@/lib/places";
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
  const [kinds, catalogue, everyCountry] = await Promise.all([getDirectoryKinds(), getCatalogue(), getAllCountries()]);
  const wanted = first(params.country)?.toUpperCase();
  const chosen = everyCountry.find(({ code }) => code === wanted);
  const region = catalogue.sets.regions.find(({ code }) => code === first(params.region))?.code;
  const filters = { country: chosen?.code, region };
  const filtered = Boolean(chosen || region);
  // The place is named in the heading only when the visitor chose one: the region, else the country.
  const regionLabel = catalogue.sets.regions.find(({ code }) => code === region)?.label;
  const place = regionLabel
    ? joinPlaces([regionLabel, chosen?.name])
    : chosen && countryInSentence(chosen.code, chosen.name);

  const [list, everyone] = await Promise.all([
    getDirectoryList(kind, filters),
    filtered ? getDirectoryList(kind) : null,
  ]);
  // The filter offers the countries these profiles are in (and the chosen one), by name.
  const offered = new Map<string, string>();
  for (const profile of (everyone ?? list)?.profiles ?? []) {
    if (profile.country) offered.set(profile.country.code, profile.country.name);
  }
  if (chosen) offered.set(chosen.code, chosen.name);
  const countries = [...offered].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name));
  const { regions } = placesIn(catalogue.sets, countries.map(({ code }) => code));
  return { list, kinds, catalogue, filters, filtered, place, countries, regions };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ kind }, query] = await Promise.all([params, searchParams]);
  const loaded = await load(() => readDirectory(kind, query));
  if (!loaded.ok) return { title: "Professionals", robots: { index: false, follow: true } };

  const { list, place } = loaded.data;
  if (!list) return { title: "Page not found", robots: { index: false, follow: true } };

  const title = place ? `${list.kind.label} in ${place}` : list.kind.label;
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
        <Stagger as="ul" stagger={0.03} className="flex flex-wrap gap-2">
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
        </Stagger>
      </nav>

      {groups.map((group) => (
        <section key={group.code} id={group.code} aria-labelledby={`${group.code}-heading`} className="mt-12 scroll-mt-28">
          <Reveal>
            <h2 id={`${group.code}-heading`} className="text-2xl">
              {group.label}
            </h2>
          </Reveal>
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
    return <ErrorState title="We could not load these profiles." retryHref={`/directory/${kindCode}`} />;
  }
  const { list, kinds, catalogue, filters, filtered, place, countries, regions } = loaded.data;
  if (!list) notFound();

  const { kind, profiles } = list;
  const hasSponsored = profiles.some((profile) => profile.sponsored);
  // Only profiles with a trade are grouped; today those are the service providers.
  const tradeGroups = groupByTrade(profiles, catalogue.sets.service_trades);

  return (
    <>
      {!filtered && <JsonLd data={directoryJsonLd(kind, profiles)} />}
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
              Professionals
            </Link>
          </li>
          <ChevronRight className="size-4" aria-hidden="true" />
          <li aria-current="page" className="text-ink">
            {kind.label}
          </li>
        </ol>
      </nav>

      <div className="enter-rise">
        <h1 className="mt-6 text-3xl md:text-4xl">
          {kind.label}
          {place && ` in ${place}`}
        </h1>
        <p className="mt-3 max-w-2xl text-muted">{kind.description}</p>
      </div>
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
          <SearchableSelect
            id="directory-country"
            name="country"
            defaultValue={filters.country ?? ""}
            options={[
              { value: "", label: "Any country" },
              ...countries.map((country) => ({ value: country.code, label: country.name })),
            ]}
          />
        </Field>
        <Field id="directory-region" label="Region or province">
          <SearchableSelect
            id="directory-region"
            name="region"
            defaultValue={filters.region ?? ""}
            options={[
              { value: "", label: "Any region" },
              // Under their country, so "Harare" and "England" are not one flat list.
              ...countries
                .map((country) => ({
                  label: country.name,
                  options: regions
                    .filter((region) => region.market_code === country.code)
                    .map((region) => ({ value: region.code, label: region.label })),
                }))
                .filter((group) => group.options.length > 0),
            ]}
          />
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

      <nav aria-label="Other professionals and businesses" className="mt-16 border-t border-line pt-10">
        <h2 className="text-xl">Other professionals and businesses</h2>
        <Stagger as="ul" stagger={0.03} className="mt-4 flex flex-wrap gap-2">
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
        </Stagger>
      </nav>
    </>
  );
}

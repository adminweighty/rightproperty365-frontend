import { BadgeCheck, Check, ChevronRight, MapPin, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProfileAvatar, ProfileGrid, ProfileRefGrid } from "@/components/directory/profile-card";
import { ProfileEnquiryForm } from "@/components/directory/profile-enquiry-form";
import { ListingGrid } from "@/components/listings/listing-card";
import { JsonLd } from "@/components/seo/json-ld";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { ErrorState } from "@/components/ui/error-state";
import { getDirectoryKinds, getDirectoryList, getDirectoryProfile } from "@/lib/api/server/directory";
import { getSitemapEntries } from "@/lib/api/server/listings";
import { load, readAtBuild } from "@/lib/api/server/load";
import { getCatalogue } from "@/lib/api/server/reference";
import { toLabels, toOptions } from "@/lib/api/types";
import { profilePlace } from "@/lib/places";
import { profileJsonLd, profilePath } from "@/lib/seo";
import { ApiBoundary } from "@/components/api-boundary";

type Props = PageProps<"/directory/[kind]/[slug]">;

// The content reads the address and the API with no <Suspense> around it
// (ApiBoundary), so an address that was not prerendered has no static shell:
// the server renders the whole page before it answers. That keeps the content
// in the HTML, visible without JavaScript.
export const instant = false;

/** Profiles prerendered at build; the rest are rendered on first visit and then cached. */
const PRERENDER_LIMIT = 200;
/** Cache Components needs at least one param to build the route's shell. This is never a profile. */
const SHELL_ONLY = [{ kind: "not-prerendered", slug: "not-prerendered" }];

export async function generateStaticParams() {
  const entries = await readAtBuild(getSitemapEntries);
  const params = (entries?.profiles ?? []).slice(0, PRERENDER_LIMIT).map(({ kind, slug }) => ({ kind, slug }));
  return params.length > 0 ? params : SHELL_ONLY;
}

async function readProfile(kindCode: string, slug: string) {
  const profile = await getDirectoryProfile(kindCode, slug);
  if (!profile) return null;
  const [kinds, catalogue] = await Promise.all([getDirectoryKinds(), getCatalogue()]);
  const kind = kinds.find((item) => item.code === profile.kind);
  if (!kind) return null;

  // The API lists an agency's agents as references (name and verification).
  // Their full cards come from the directory they are listed in.
  const teamKinds = [...new Set(profile.agents.map((agent) => agent.kind))];
  const teamLists = await Promise.all(teamKinds.map((code) => getDirectoryList(code)));
  const directory = teamLists.flatMap((list) => list?.profiles ?? []);
  const team = profile.agents
    .map((agent) => directory.find((item) => item.kind === agent.kind && item.slug === agent.slug))
    .filter((item) => item !== undefined);

  return { profile, kind, catalogue, team };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kind, slug } = await params;
  const loaded = await load(() => readProfile(kind, slug));
  if (!loaded.ok) return { title: "Profile", robots: { index: false, follow: true } };
  if (!loaded.data) return { title: "Profile not found", robots: { index: false, follow: true } };

  const { profile, kind: directory } = loaded.data;
  // A profile created by an approval may have no role line yet: fall back to its trade or directory.
  const what = profile.role || profile.specialism?.label || profile.trade?.label || directory.singular_label;
  const where = profilePlace(profile);
  const title = `${profile.name}: ${what.toLowerCase()}${where ? ` in ${where}` : ""}`;
  const description = `${profile.tagline} ${profile.description}`.slice(0, 300);
  const path = profilePath(profile);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "profile", title, description, url: path, images: ["/opengraph-image"] },
  };
}

export default function ProfilePage({ params }: Props) {
  return (
    <Container className="py-8 md:py-12">
      <ApiBoundary fallback={<div aria-busy="true" className="h-96 rounded-lg bg-sunken" />}>
        <ProfileContent params={params} />
      </ApiBoundary>
    </Container>
  );
}

async function ProfileContent({ params }: Pick<Props, "params">) {
  const { kind: kindCode, slug } = await params;
  const loaded = await load(() => readProfile(kindCode, slug));
  if (!loaded.ok) {
    return <ErrorState title="We could not load this profile." retryHref={`/directory/${kindCode}/${slug}`} />;
  }
  if (!loaded.data) notFound();

  const { profile, kind, catalogue, team } = loaded.data;
  const { agency, agents, listings } = profile;

  return (
    <>
      <JsonLd data={profileJsonLd(profile, kind)} />
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
          <li>
            <Link href="/directory" className="hover:text-ink hover:underline">
              Professionals
            </Link>
          </li>
          <ChevronRight className="size-4" aria-hidden="true" />
          <li>
            <Link href={`/directory/${kind.code}`} className="hover:text-ink hover:underline">
              {kind.label}
            </Link>
          </li>
          <ChevronRight className="size-4" aria-hidden="true" />
          <li aria-current="page" className="text-ink">
            {profile.name}
          </li>
        </ol>
      </nav>

      <header className="mt-6 overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
        <div aria-hidden="true" className="rule-brand rounded-none" />
        <div aria-hidden="true" className="h-20 bg-tint md:h-24" />
        <div className="flex flex-col gap-5 px-6 pb-6 md:flex-row md:items-end md:px-8">
          <ProfileAvatar
            name={profile.name}
            person={agency !== null}
            className="-mt-10 size-24 text-3xl ring-4 ring-surface md:-mt-12 md:size-28"
          />
          <div className="min-w-0 flex-1 md:pt-5">
            <div className="flex flex-wrap gap-2">
              <Badge>{kind.singular_label}</Badge>
              {profile.trade && <Badge tone="primary">{profile.trade.label}</Badge>}
              {profile.specialism && <Badge tone="primary">{profile.specialism.label}</Badge>}
              {profile.verified && (
                <Badge tone="success">
                  <BadgeCheck className="size-3.5" aria-hidden="true" />
                  Verified
                </Badge>
              )}
              {profile.sponsored && <Badge tone="accent">Sponsored</Badge>}
            </div>
            <h1 className="mt-2 text-3xl md:text-4xl">{profile.name}</h1>
            <p className="mt-1 text-muted">
              {profile.role || profile.trade?.label || kind.singular_label}
              {agency && (
                <>
                  {" at "}
                  <Link href={profilePath(agency)} className="font-medium text-primary-ink hover:underline">
                    {agency.name}
                  </Link>
                </>
              )}
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              {profilePlace(profile) && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4" aria-hidden="true" />
                  {profilePlace(profile)}
                </span>
              )}
              {profile.since && <span>Established {profile.since}</span>}
            </p>
          </div>
        </div>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_22rem]">
        <div>
          <h2 className="text-2xl">About</h2>
          <p className="mt-3 max-w-prose whitespace-pre-line leading-relaxed text-muted">
            {profile.description}
          </p>

          {(profile.offerings.length > 0 || profile.services.length > 0) && (
            <h2 className="mt-10 text-2xl">Services</h2>
          )}
          {profile.offerings.length > 0 ? (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {profile.offerings.map((offering) => (
                <li key={offering.name} className="rounded-lg border border-line bg-surface p-5">
                  <h3 className="flex items-center gap-2.5 font-sans text-base font-semibold tracking-normal">
                    <Check className="size-4 shrink-0 text-primary-ink" aria-hidden="true" />
                    {offering.name}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{offering.description}</p>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {profile.services.map((service) => (
                <li key={service} className="flex items-center gap-2.5 text-ink">
                  <Check className="size-4 shrink-0 text-primary-ink" aria-hidden="true" />
                  {service}
                </li>
              ))}
            </ul>
          )}

          {profile.areas.length > 0 && (
            <>
              <h2 className="mt-10 text-2xl">Areas covered</h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {profile.areas.map((area) => (
                  <li key={area}>
                    <Badge tone="primary">{area}</Badge>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <aside aria-labelledby="enquiry-heading">
          <Card className="lg:sticky lg:top-24">
            <h2 id="enquiry-heading" className="text-2xl">
              Send an enquiry
            </h2>
            <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-muted">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary-ink" aria-hidden="true" />
              <span>
                Phone numbers and email addresses are not shown on RightProperty365. Your enquiry
                goes to {profile.name} in the app and they reply to you.
              </span>
            </p>
            <div className="mt-6">
              <ProfileEnquiryForm
                kind={profile.kind}
                slug={profile.slug}
                name={profile.name}
                services={profile.services}
                contactMethods={toOptions(catalogue.sets.contact_methods)}
              />
            </div>
            {listings.length > 0 && (
              <ButtonLink href="#listings" variant="secondary" className="mt-4 w-full">
                See their listings
              </ButtonLink>
            )}
          </Card>
        </aside>
      </div>

      {agents.length > 0 && (
        <section aria-labelledby="team-heading" className="mt-16 border-t border-line pt-12">
          <h2 id="team-heading" className="text-2xl md:text-3xl">
            Agents at {profile.name}
          </h2>
          <div className="mt-8">
            {team.length === agents.length ? (
              <ProfileGrid profiles={team} />
            ) : (
              <ProfileRefGrid profiles={agents} person />
            )}
          </div>
        </section>
      )}

      {listings.length > 0 && (
        <section
          id="listings"
          aria-labelledby="listings-heading"
          className="mt-16 scroll-mt-24 border-t border-line pt-12"
        >
          <h2 id="listings-heading" className="text-2xl md:text-3xl">
            {listings.length === 1 ? "1 property" : `${listings.length} properties`} from {profile.name}
          </h2>
          <div className="mt-8">
            <ListingGrid listings={listings} periods={toLabels(catalogue.sets.price_periods)} />
          </div>
        </section>
      )}
    </>
  );
}

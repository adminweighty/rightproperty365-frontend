import { BadgeCheck, Check, ChevronRight, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProfileAvatar, ProfileGrid } from "@/components/directory/profile-card";
import { ListingGrid } from "@/components/listings/listing-card";
import { JsonLd } from "@/components/seo/json-ld";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import {
  agencyOfAgent,
  agentsOfAgency,
  directories,
  getProfile,
  listingsForProfile,
  profilePath,
  profiles,
} from "@/lib/data/directory";
import { profileJsonLd } from "@/lib/seo";

type Props = PageProps<"/directory/[kind]/[slug]">;

export function generateStaticParams() {
  return profiles.map(({ kind, slug }) => ({ kind, slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kind, slug } = await params;
  const profile = getProfile(kind, slug);
  if (!profile) return { title: "Profile not found", robots: { index: false, follow: true } };

  const title = `${profile.name}: ${profile.role.toLowerCase()} in ${profile.city}`;
  const description = `${profile.tagline} ${profile.about}`.slice(0, 300);
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
      <Suspense fallback={<div aria-busy="true" className="h-96 rounded-lg bg-sunken" />}>
        <ProfileContent params={params} />
      </Suspense>
    </Container>
  );
}

async function ProfileContent({ params }: Pick<Props, "params">) {
  const { kind, slug } = await params;
  const profile = getProfile(kind, slug);
  if (!profile) notFound();

  const listings = listingsForProfile(profile);
  const agency = profile.kind === "agents" ? agencyOfAgent(profile) : undefined;
  const team = profile.kind === "agencies" ? agentsOfAgency(profile) : [];
  const directory = directories[profile.kind];

  return (
    <>
      <JsonLd data={profileJsonLd(profile)} />
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
          <li>
            <Link href="/directory" className="hover:text-ink hover:underline">
              Directory
            </Link>
          </li>
          <ChevronRight className="size-4" aria-hidden="true" />
          <li>
            <Link href={`/directory/${profile.kind}`} className="hover:text-ink hover:underline">
              {directory.title}
            </Link>
          </li>
          <ChevronRight className="size-4" aria-hidden="true" />
          <li aria-current="page" className="text-ink">
            {profile.name}
          </li>
        </ol>
      </nav>

      <header className="mt-6 overflow-hidden rounded-xl border border-line bg-surface">
        <div aria-hidden="true" className="h-24 bg-brand md:h-32" />
        <div className="flex flex-col gap-5 px-6 pb-6 md:flex-row md:items-end md:px-8">
          <ProfileAvatar
            profile={profile}
            className="-mt-10 size-24 text-3xl ring-4 ring-surface md:-mt-12 md:size-28"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-2">
              <Badge>{directory.singular}</Badge>
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
              {profile.role}
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
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden="true" />
                {profile.city}
              </span>
              {profile.since && <span>Established {profile.since}</span>}
            </p>
          </div>
        </div>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_22rem]">
        <div>
          <h2 className="text-2xl">About</h2>
          <p className="mt-3 max-w-prose leading-relaxed text-muted">{profile.about}</p>

          <h2 className="mt-10 text-2xl">Services</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {profile.services.map((service) => (
              <li key={service} className="flex items-center gap-2.5 text-ink">
                <Check className="size-4 shrink-0 text-primary-ink" aria-hidden="true" />
                {service}
              </li>
            ))}
          </ul>
        </div>

        <aside>
          <Card>
            <h2 className="text-xl">Areas covered</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {profile.areas.map((area) => (
                <li key={area}>
                  <Badge tone="primary">{area}</Badge>
                </li>
              ))}
            </ul>
            <h2 className="mt-8 text-xl">Get in touch</h2>
            {listings.length > 0 ? (
              <>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Open one of their listings and send a request. It goes straight to {profile.name}{" "}
                  and you can track the reply.
                </p>
                <ButtonLink href="#listings" className="mt-4 w-full">
                  See their listings
                </ButtonLink>
              </>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Direct enquiries to {directory.title.toLowerCase()} are not open yet. They will go
                through RightProperty365 in the same tracked way as listing enquiries.
              </p>
            )}
          </Card>
        </aside>
      </div>

      {team.length > 0 && (
        <section aria-labelledby="team-heading" className="mt-16 border-t border-line pt-12">
          <h2 id="team-heading" className="text-2xl md:text-3xl">
            Agents at {profile.name}
          </h2>
          <div className="mt-8">
            <ProfileGrid profiles={team} />
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
            <ListingGrid listings={listings} />
          </div>
        </section>
      )}
    </>
  );
}

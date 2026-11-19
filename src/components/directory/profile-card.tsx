import { BadgeCheck, MapPin } from "lucide-react";
import Link from "next/link";
import { Stagger } from "@/components/motion/stagger";
import { Badge } from "@/components/ui/badge";
import { LogoMark } from "@/components/ui/logo-mark";
import type { DirectoryProfile, Logo, ProfileRef } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { profilePlace } from "@/lib/places";
import { profileSummary } from "@/lib/reviews";
import { profilePath } from "@/lib/seo";
import { RatingSummaryLine } from "@/components/reviews/stars";

type AvatarProps = {
  name: string;
  /** The profile’s logo or photo. Without one, or when it does not load, the initials are shown. */
  logo?: Logo | null;
  /** Whose logo it is when it is not the profile’s own. */
  logoOf?: string;
  /** People get a round avatar, businesses a rounded square. */
  person?: boolean;
  className?: string;
};

/** A profile’s logo or photo, or its initials: see `LogoMark`. */
export function ProfileAvatar({ name, logo, logoOf, person, className }: AvatarProps) {
  return <LogoMark name={name} logo={logo} logoOf={logoOf} person={person} className={className} />;
}

const cardLink =
  "outline-none after:absolute after:inset-0 after:rounded-lg group-hover:underline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus";

/** One directory entry. The whole card is a single link, like ListingCard. */
export function ProfileCard({ profile }: { profile: DirectoryProfile }) {
  // The published reviews' average and count (API 0.36.4), only with at least one.
  const rating = profileSummary(profile);
  return (
    <article
      className={cn(
        "group relative flex h-full flex-col rounded-lg border border-line bg-surface p-5 shadow-xs transition-[box-shadow,translate] duration-200 ease-standard hover:shadow-md focus-within:shadow-md",
        // Sponsored profiles keep the brand outline; others show it on hover.
        profile.sponsored ? "frame-brand-on" : "frame-brand",
      )}
    >
      <div className="flex items-start gap-4">
        {/* A profile that works for an agency is a person; without a photo of their own they carry the agency’s logo. */}
        <ProfileAvatar
          name={profile.name}
          logo={profile.logo ?? profile.agency?.logo}
          logoOf={profile.logo ? undefined : profile.agency?.name}
          person={profile.agency !== null && Boolean(profile.logo)}
        />
        <div className="min-w-0 flex-1">
          <h3 className="font-sans text-base font-semibold tracking-normal text-ink">
            <Link href={profilePath(profile)} className={cardLink}>
              {profile.name}
            </Link>
          </h3>
          <p className="text-sm text-muted">
            {/* An agent's specialism is a title from the API: "Sales Agent", "Lettings Agent". */}
            {profile.specialism?.label || profile.role || profile.trade?.label}
            {profile.agency && ` · ${profile.agency.name}`}
          </p>
        </div>
      </div>

      {rating && rating.count >= 1 && <RatingSummaryLine average={rating.average} count={rating.count} size="sm" className="mt-3" />}
      <p className="mt-4 text-sm leading-relaxed text-muted">{profile.tagline}</p>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        {profilePlace(profile) && (
          <span className="flex items-center gap-1 text-sm text-muted">
            <MapPin className="size-4" aria-hidden="true" />
            {profilePlace(profile)}
          </span>
        )}
        {profile.listing_count > 0 && (
          <Badge tone="primary">
            {profile.listing_count === 1 ? "1 listing" : `${profile.listing_count} listings`}
          </Badge>
        )}
        {profile.verified && (
          <Badge tone="success" className="sheen">
            <BadgeCheck className="size-3.5" aria-hidden="true" />
            Verified
          </Badge>
        )}
        {profile.sponsored && <Badge tone="accent">Sponsored</Badge>}
      </div>
    </article>
  );
}

export function ProfileGrid({ profiles }: { profiles: DirectoryProfile[] }) {
  return (
    <Stagger as="ul" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {profiles.map((profile) => (
        <li key={`${profile.kind}/${profile.slug}`} className="motion-safe:[&:hover>article]:-translate-y-1">
          <ProfileCard profile={profile} />
        </li>
      ))}
    </Stagger>
  );
}

/**
 * A compact link to a profile, for places where the API gives only a
 * reference (name and verification), such as an agency's list of agents.
 */
export function ProfileRefGrid({ profiles, person }: { profiles: ProfileRef[]; person?: boolean }) {
  return (
    <Stagger as="ul" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {profiles.map((profile) => (
        <li key={`${profile.kind}/${profile.slug}`} className="motion-safe:[&:hover>article]:-translate-y-1">
          <article className="group frame-brand relative flex min-h-20 items-center gap-4 rounded-lg border border-line bg-surface p-4 shadow-xs transition-[box-shadow,translate] duration-200 ease-standard hover:shadow-md focus-within:shadow-md">
            <ProfileAvatar name={profile.name} logo={profile.logo} person={person} className="size-12 text-base" />
            <div className="min-w-0 flex-1">
              <h3 className="font-sans text-base font-semibold tracking-normal text-ink">
                <Link href={profilePath(profile)} className={cardLink}>
                  {profile.name}
                </Link>
              </h3>
              {profile.verified && (
                <Badge tone="success" className="mt-1">
                  <BadgeCheck className="size-3.5" aria-hidden="true" />
                  Verified
                </Badge>
              )}
            </div>
          </article>
        </li>
      ))}
    </Stagger>
  );
}

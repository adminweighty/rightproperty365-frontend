import { BadgeCheck, MapPin } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { DirectoryProfile, ProfileRef } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { profilePath } from "@/lib/seo";

export const initials = (name: string) =>
  name
    .split(" ")
    .filter((word) => word.toLowerCase() !== "and")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

type AvatarProps = {
  name: string;
  /** People get a round avatar, businesses a rounded square. */
  person?: boolean;
  className?: string;
};

export function ProfileAvatar({ name, person, className }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center bg-brand font-bold text-on-brand",
        person ? "rounded-full" : "rounded-md",
        className ?? "size-14 text-lg",
      )}
    >
      {initials(name)}
    </span>
  );
}

const cardLink =
  "outline-none after:absolute after:inset-0 after:rounded-lg group-hover:underline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus";

/** One directory entry. The whole card is a single link, like ListingCard. */
export function ProfileCard({ profile }: { profile: DirectoryProfile }) {
  return (
    <article
      className={cn(
        "group relative flex h-full flex-col rounded-lg border border-line bg-surface p-5 shadow-xs transition-shadow hover:shadow-md focus-within:shadow-md",
        // Sponsored profiles keep the brand outline; others show it on hover.
        profile.sponsored ? "frame-brand-on" : "frame-brand",
      )}
    >
      <div className="flex items-start gap-4">
        {/* A profile that works for an agency is a person. */}
        <ProfileAvatar name={profile.name} person={profile.agency !== null} />
        <div className="min-w-0 flex-1">
          <h3 className="font-sans text-base font-semibold tracking-normal text-ink">
            <Link href={profilePath(profile)} className={cardLink}>
              {profile.name}
            </Link>
          </h3>
          <p className="text-sm text-muted">
            {profile.role}
            {profile.agency && ` · ${profile.agency.name}`}
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-muted">{profile.tagline}</p>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        <span className="flex items-center gap-1 text-sm text-muted">
          <MapPin className="size-4" aria-hidden="true" />
          {profile.city.label}
        </span>
        {profile.listing_count > 0 && (
          <Badge tone="primary">
            {profile.listing_count === 1 ? "1 listing" : `${profile.listing_count} listings`}
          </Badge>
        )}
        {profile.verified && (
          <Badge tone="success">
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
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {profiles.map((profile) => (
        <li key={`${profile.kind}/${profile.slug}`}>
          <ProfileCard profile={profile} />
        </li>
      ))}
    </ul>
  );
}

/**
 * A compact link to a profile, for places where the API gives only a
 * reference (name and verification), such as an agency's list of agents.
 */
export function ProfileRefGrid({ profiles, person }: { profiles: ProfileRef[]; person?: boolean }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {profiles.map((profile) => (
        <li key={`${profile.kind}/${profile.slug}`}>
          <article className="group frame-brand relative flex min-h-20 items-center gap-4 rounded-lg border border-line bg-surface p-4 shadow-xs transition-shadow hover:shadow-md focus-within:shadow-md">
            <ProfileAvatar name={profile.name} person={person} className="size-12 text-base" />
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
    </ul>
  );
}

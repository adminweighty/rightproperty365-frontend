import { BadgeCheck, MapPin } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import {
  agencyOfAgent,
  initials,
  listingsForProfile,
  profilePath,
  type Profile,
} from "@/lib/data/directory";

export function ProfileAvatar({ profile, className }: { profile: Profile; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center bg-brand font-bold text-on-brand",
        // People get a round avatar, businesses a rounded square.
        profile.kind === "agents" ? "rounded-full" : "rounded-md",
        className ?? "size-14 text-lg",
      )}
    >
      {initials(profile.name)}
    </span>
  );
}

/** One directory entry. The whole card is a single link, like ListingCard. */
export function ProfileCard({ profile }: { profile: Profile }) {
  const listingCount = listingsForProfile(profile).length;
  const agency = profile.kind === "agents" ? agencyOfAgent(profile) : undefined;

  return (
    <article className="group relative flex h-full flex-col rounded-lg border border-line bg-surface p-5 shadow-xs transition-shadow hover:shadow-md focus-within:shadow-md">
      <div className="flex items-start gap-4">
        <ProfileAvatar profile={profile} />
        <div className="min-w-0 flex-1">
          <h3 className="font-sans text-base font-semibold tracking-normal text-ink">
            <Link
              href={profilePath(profile)}
              className="outline-none after:absolute after:inset-0 after:rounded-lg group-hover:underline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus"
            >
              {profile.name}
            </Link>
          </h3>
          <p className="text-sm text-muted">
            {profile.role}
            {agency && ` · ${agency.name}`}
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-muted">{profile.tagline}</p>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        <span className="flex items-center gap-1 text-sm text-muted">
          <MapPin className="size-4" aria-hidden="true" />
          {profile.city}
        </span>
        {listingCount > 0 && (
          <Badge tone="primary">{listingCount === 1 ? "1 listing" : `${listingCount} listings`}</Badge>
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

export function ProfileGrid({ profiles }: { profiles: Profile[] }) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {profiles.map((profile) => (
        <li key={profile.slug}>
          <ProfileCard profile={profile} />
        </li>
      ))}
    </ul>
  );
}

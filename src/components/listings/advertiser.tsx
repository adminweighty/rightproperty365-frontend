import { BadgeCheck } from "lucide-react";
import Link from "next/link";
import { LogoMark } from "@/components/ui/logo-mark";
import type { AdvertiserDisplay, ListingAdvertiser, ListingVerification } from "@/lib/api/types";
import { cn } from "@/lib/cn";

/** The FAQ answer that says what the badge means. */
export const VERIFIED_FAQ = "/faq#what-verified-means";

/**
 * Who to show for a listing. The API sends it ready (`display`); an API build
 * from before that gets the same shape from the older fields, without a role
 * label or a logo.
 */
export function advertiserDisplay(advertiser: ListingAdvertiser): AdvertiserDisplay {
  if (advertiser.display) return advertiser.display;
  const { agency } = advertiser;
  return {
    name: agency?.name ?? advertiser.name,
    secondary_name: advertiser.agent?.name ?? null,
    role_label: "",
    logo: agency?.logo ?? null,
    verified: advertiser.verified,
    profile: agency ? { kind: agency.kind, slug: agency.slug } : null,
  };
}

/** The assigned agent, when the listing has one. */
export function agentDisplay(advertiser: ListingAdvertiser): AdvertiserDisplay | null {
  if (advertiser.agent_display !== undefined) return advertiser.agent_display;
  const { agent } = advertiser;
  if (!agent) return null;
  return {
    name: agent.name,
    role_label: "",
    logo: agent.logo ?? null,
    verified: agent.verified,
    profile: { kind: agent.kind, slug: agent.slug },
  };
}

/**
 * "Verified", with its tick, only when the API says so. Anything else reads
 * "Not verified" in a neutral colour: never a badge the API did not grant.
 * The word carries the meaning; the colour and the icon only support it.
 */
export function VerifiedMark({ verified, className }: { verified: boolean; className?: string }) {
  return verified ? (
    <span className={cn("inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-success", className)}>
      <BadgeCheck className="size-3.5" aria-hidden="true" />
      Verified
    </span>
  ) : (
    <span className={cn("inline-flex shrink-0 items-center text-xs font-medium text-muted", className)}>Not verified</span>
  );
}

/**
 * The advertiser on a listing card: logo (or initials), name and the Verified
 * mark, kept to the right of the card's bottom row. Plain text and an image,
 * never a link: the whole card is already one link.
 */
export function AdvertiserCompact({ advertiser, className }: { advertiser: ListingAdvertiser; className?: string }) {
  const display = advertiserDisplay(advertiser);
  return (
    <p className={cn("flex min-w-0 max-w-full items-center gap-2 text-sm", className)}>
      <LogoMark name={display.name} logo={display.logo} person={display.profile === null} className="size-8 text-xs" />
      <span className="flex min-w-0 flex-col">
        {/* A long name is cut with an ellipsis; the whole name is in the title. */}
        <span className="truncate font-medium leading-tight text-ink" title={display.name}>
          <span className="sr-only">Advertised by </span>
          {display.name}
        </span>
        <VerifiedMark verified={display.verified} />
      </span>
    </p>
  );
}

const verifiedOn = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso));

/** One party of the full block: logo, name (a link to the profile when there is one), title, badge. */
function Party({ display, person, size }: { display: AdvertiserDisplay; person: boolean; size: string }) {
  const href = display.profile ? `/directory/${display.profile.kind}/${display.profile.slug}` : null;
  return (
    <div className="flex items-center gap-3">
      <LogoMark name={display.name} logo={display.logo} person={person} className={size} />
      <div className="min-w-0">
        <p className="break-words font-semibold leading-snug text-ink">
          {href ? (
            <Link href={href} className="text-primary-ink hover:underline">
              {display.name}
            </Link>
          ) : (
            display.name
          )}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          {display.role_label}
          <VerifiedMark verified={display.verified} />
        </p>
      </div>
    </div>
  );
}

type BlockProps = {
  advertiser: ListingAdvertiser;
  verification?: ListingVerification;
  /** The id of the block's heading, for the region that holds it. */
  headingId: string;
};

/**
 * The advertiser on a listing page: the agency, company or owner with its
 * logo, title and Verified mark, then the assigned agent with their own, and
 * when the advertiser was verified. Names link to public profiles; a direct
 * owner has none. No phone number or email address, ever: contact is the
 * request form.
 */
export function AdvertiserBlock({ advertiser, verification, headingId }: BlockProps) {
  const display = advertiserDisplay(advertiser);
  const agent = agentDisplay(advertiser);
  const verifiedAt = display.verified ? verification?.advertiser_verified_at : null;
  return (
    <div>
      <h2 id={headingId} className="font-sans text-sm font-semibold tracking-normal text-muted">
        Advertised by
      </h2>
      <div className="mt-3 space-y-4">
        <Party display={display} person={display.profile === null} size="size-14 text-lg" />
        {agent && <Party display={agent} person size="size-10 text-sm" />}
      </div>
      <p className="mt-3 text-sm text-muted">
        {verifiedAt && <>Verified on {verifiedOn(verifiedAt)}. </>}
        <Link href={VERIFIED_FAQ} className="font-medium text-primary-ink underline underline-offset-2 hover:no-underline">
          What does Verified mean?
        </Link>
      </p>
    </div>
  );
}

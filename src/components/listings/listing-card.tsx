import { Bath, BedDouble, MapPin, Maximize2, Moon, Users } from "lucide-react";
import Link from "next/link";
import { AdvertiserCompact } from "@/components/listings/advertiser";
import { ListingMedia } from "@/components/listings/listing-media";
import type { Listing } from "@/lib/api/types";
import { formatArea, formatMoney, pricePeriodLabel } from "@/lib/format";
import { shortPlace } from "@/lib/places";

/** code -> label of the API's `price_periods` set: "per month", "per night". */
export type PeriodLabels = Record<string, string>;

/**
 * The dates and guests of the search a card was found by. They travel in the
 * link to a short stay, so its request form starts from them.
 */
export type StayQuery = { check_in?: string; check_out?: string; guests?: number };

type PriceProps = { listing: Listing; periods?: PeriodLabels; className?: string };

/** The price in the listing's own currency, and what it is charged per when it is a rental. */
export function ListingPrice({ listing, periods, className }: PriceProps) {
  return (
    <p className={className}>
      <span className="font-display font-bold tabular-nums text-ink">
        {formatMoney(listing.price)}
      </span>
      {listing.price_period && (
        <span className="ml-1 text-sm text-muted">{pricePeriodLabel(listing.price_period, periods)}</span>
      )}
    </p>
  );
}

const factIcon = "size-4 shrink-0 text-primary-ink";
const factValue = "font-semibold text-ink";

/**
 * Bedrooms, bathrooms and area on one line. A short stay leads with how many
 * it sleeps and ends with its shortest stay instead of its area. A value the
 * listing does not have is left out.
 */
export function ListingFacts({ listing }: { listing: Listing }) {
  const area = listing.floor_area ?? listing.land_area;
  const guests = listing.max_guests ?? null;
  const minNights = listing.min_nights ?? null;
  const isStay = guests !== null || minNights !== null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
      {guests !== null && (
        <li className="flex items-center gap-1.5">
          <Users className={factIcon} aria-hidden="true" />
          <span>
            Sleeps <span className={factValue}>{guests}</span>
          </span>
        </li>
      )}
      {listing.bedrooms !== null && (
        <li className="flex items-center gap-1.5">
          <BedDouble className={factIcon} aria-hidden="true" />
          <span>
            <span className={factValue}>{listing.bedrooms}</span> <span className="sr-only">bedrooms</span>
            <span aria-hidden="true">bed</span>
          </span>
        </li>
      )}
      {listing.bathrooms !== null && (
        <li className="flex items-center gap-1.5">
          <Bath className={factIcon} aria-hidden="true" />
          <span>
            <span className={factValue}>{listing.bathrooms}</span> <span className="sr-only">bathrooms</span>
            <span aria-hidden="true">bath</span>
          </span>
        </li>
      )}
      {minNights !== null && (
        <li className="flex items-center gap-1.5">
          <Moon className={factIcon} aria-hidden="true" />
          <span>
            <span className={factValue}>{minNights}</span> {minNights === 1 ? "night" : "nights"} minimum
          </span>
        </li>
      )}
      {area !== null && !isStay && (
        <li className="flex items-center gap-1.5">
          <Maximize2 className={factIcon} aria-hidden="true" />
          <span className={factValue}>{formatArea(area)}</span>
        </li>
      )}
    </ul>
  );
}

const tag = "rounded-sm px-2 py-1 text-xs font-semibold shadow-xs";

/** The listing's address, carrying the stay of the search to a listing that can be stayed in. */
function listingHref(listing: Listing, stay: StayQuery | undefined): string {
  const path = `/listings/${listing.slug}`;
  if (!stay || listing.max_guests == null) return path;
  const query = new URLSearchParams();
  if (stay.check_in && stay.check_out) {
    query.set("check_in", stay.check_in);
    query.set("check_out", stay.check_out);
  }
  if (stay.guests) query.set("guests", String(stay.guests));
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

type CardProps = { listing: Listing; isNew?: boolean; periods?: PeriodLabels; stay?: StayQuery };

/**
 * A listing in a grid or a row: a large photo with the status tag on it, then
 * price, title and place, and a bottom row with the facts on the left and, at
 * the far right, who advertises it: logo, name and the Verified mark. Where
 * the two do not fit side by side the advertiser drops below, still on the
 * right. The advertiser is text and an image, not a link: the card is one link. The place is whatever the listing
 * names (suburb and city, or city and country); a listing that names none has
 * no place line.
 */
export function ListingCard({ listing, isNew, periods, stay }: CardProps) {
  const place = shortPlace(listing);
  return (
    <article className="group frame-brand flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-xs transition-shadow duration-200 hover:shadow-md focus-within:shadow-md">
      <div className="relative">
        <ListingMedia
          photo={listing.photos[0]}
          sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
          zoomOnHover
          className="aspect-[4/3]"
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <span className={`${tag} bg-primary text-on-primary`}>{listing.deal.label}</span>
          {isNew && <span className={`${tag} bg-surface text-ink`}>New</span>}
          {listing.featured && <span className={`${tag} bg-brand-accent text-brand-deep`}>Featured</span>}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
        <ListingPrice listing={listing} periods={periods} className="text-2xl" />
        <h3 className="font-sans text-base font-medium tracking-normal text-ink">
          {/* The stretched link makes the whole card one target. */}
          <Link
            href={listingHref(listing, stay)}
            className="outline-none after:absolute after:inset-0 after:rounded-lg group-hover:underline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus"
          >
            {listing.title}
          </Link>
        </h3>
        {place && (
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            {place}
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-t border-line pt-3">
          <ListingFacts listing={listing} />
          <AdvertiserCompact advertiser={listing.advertiser} className="ml-auto" />
        </div>
      </div>
    </article>
  );
}

type GridProps = { listings: Listing[]; periods?: PeriodLabels; stay?: StayQuery };

export function ListingGrid({ listings, periods, stay }: GridProps) {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map((listing) => (
        <li key={listing.id} className="flex [&>article]:w-full">
          <ListingCard listing={listing} periods={periods} stay={stay} />
        </li>
      ))}
    </ul>
  );
}

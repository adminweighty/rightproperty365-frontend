import { Bath, BedDouble, MapPin, Maximize2 } from "lucide-react";
import Link from "next/link";
import { ListingMedia } from "@/components/listings/listing-media";
import type { Listing } from "@/lib/api/types";
import { formatArea, formatMoney } from "@/lib/format";

export function ListingPrice({ listing, className }: { listing: Listing; className?: string }) {
  return (
    <p className={className}>
      <span className="font-display font-bold tabular-nums text-ink">
        {formatMoney(listing.price)}
      </span>
      {listing.price_period === "month" && <span className="ml-1 text-sm text-muted">per month</span>}
    </p>
  );
}

const factIcon = "size-4 shrink-0 text-primary-ink";
const factValue = "font-semibold text-ink";

/** Bedrooms, bathrooms and area on one line. A value the listing does not have is left out. */
export function ListingFacts({ listing }: { listing: Listing }) {
  const area = listing.floor_area ?? listing.land_area;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
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
      {area !== null && (
        <li className="flex items-center gap-1.5">
          <Maximize2 className={factIcon} aria-hidden="true" />
          <span className={factValue}>{formatArea(area)}</span>
        </li>
      )}
    </ul>
  );
}

const tag = "rounded-sm px-2 py-1 text-xs font-semibold shadow-xs";

/**
 * A listing in a grid or a row: a large photo with the status tag on it, then
 * price, the facts line, title and place.
 */
export function ListingCard({ listing, isNew }: { listing: Listing; isNew?: boolean }) {
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
        <ListingPrice listing={listing} className="text-2xl" />
        <ListingFacts listing={listing} />
        <h3 className="mt-1 font-sans text-base font-medium tracking-normal text-ink">
          {/* The stretched link makes the whole card one target. */}
          <Link
            href={`/listings/${listing.slug}`}
            className="outline-none after:absolute after:inset-0 after:rounded-lg group-hover:underline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus"
          >
            {listing.title}
          </Link>
        </h3>
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <MapPin className="size-4 shrink-0" aria-hidden="true" />
          {listing.suburb.label}, {listing.city.label}
        </p>
      </div>
    </article>
  );
}

export function ListingGrid({ listings }: { listings: Listing[] }) {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map((listing) => (
        <li key={listing.id} className="flex [&>article]:w-full">
          <ListingCard listing={listing} />
        </li>
      ))}
    </ul>
  );
}

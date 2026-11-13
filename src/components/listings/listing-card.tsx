import { Bath, BedDouble, MapPin, Maximize2 } from "lucide-react";
import Link from "next/link";
import { ListingMedia } from "@/components/listings/listing-media";
import { Badge } from "@/components/ui/badge";
import { dealLabels, type Listing } from "@/lib/data/listings";
import { formatArea, formatMoney } from "@/lib/format";

export function ListingPrice({ listing, className }: { listing: Listing; className?: string }) {
  return (
    <p className={className}>
      <span className="font-display font-medium tabular-nums text-ink">
        {formatMoney(listing.price)}
      </span>
      {listing.pricePeriod && <span className="ml-1 text-sm text-muted">per month</span>}
    </p>
  );
}

export function ListingFacts({ listing }: { listing: Listing }) {
  const area = listing.floorArea ?? listing.landArea;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
      {listing.bedrooms !== undefined && (
        <li className="flex items-center gap-1.5">
          <BedDouble className="size-4" aria-hidden="true" />
          {listing.bedrooms} <span className="sr-only">bedrooms</span>
          <span aria-hidden="true">bed</span>
        </li>
      )}
      {listing.bathrooms !== undefined && (
        <li className="flex items-center gap-1.5">
          <Bath className="size-4" aria-hidden="true" />
          {listing.bathrooms} <span className="sr-only">bathrooms</span>
          <span aria-hidden="true">bath</span>
        </li>
      )}
      {area !== undefined && (
        <li className="flex items-center gap-1.5">
          <Maximize2 className="size-4" aria-hidden="true" />
          {formatArea(area)}
        </li>
      )}
    </ul>
  );
}

export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-xs transition-shadow duration-200 hover:shadow-md focus-within:shadow-md">
      <div className="relative">
        <ListingMedia tone={listing.tone} className="aspect-[16/10]" />
        <div className="absolute left-3 top-3 flex gap-1.5">
          <Badge tone="primary" className="bg-surface text-ink shadow-xs">
            {dealLabels[listing.deal]}
          </Badge>
          {listing.featured && <Badge tone="accent">Featured</Badge>}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <ListingPrice listing={listing} className="text-2xl" />
        <h3 className="font-sans text-base font-medium tracking-normal text-ink">
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
          {listing.suburb}, {listing.city}
        </p>
        <div className="mt-auto border-t border-line pt-3">
          <ListingFacts listing={listing} />
        </div>
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

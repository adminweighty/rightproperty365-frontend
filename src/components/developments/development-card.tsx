import { CalendarClock, MapPin } from "lucide-react";
import Link from "next/link";
import { VerifiedMark } from "@/components/listings/advertiser";
import { cardLift } from "@/components/listings/listing-card";
import { ListingMedia } from "@/components/listings/listing-media";
import { Stagger } from "@/components/motion/stagger";
import { Badge } from "@/components/ui/badge";
import {
  completionText,
  developmentPath,
  developmentPlace,
  developmentStatusLabel,
  developmentStatusTone,
  priceFromText,
  type DevelopmentListItem,
} from "@/lib/developments";

type CardProps = {
  development: DevelopmentListItem;
  /** "high" for the first card of a page, "eager" for the rest of the first row. */
  photoLoading?: "high" | "eager";
  /** The heading level inside the section the card is listed in. */
  headingLevel?: "h2" | "h3";
};

/**
 * A development project in a grid: cover photo with its construction status,
 * then the price from, name, place and completion estimate, and the developer
 * by name. The whole card is one link to the project; the developer is text
 * here (their profile is linked from the project page). No contact details.
 */
export function DevelopmentCard({ development, photoLoading, headingLevel: Heading = "h3" }: CardProps) {
  const place = developmentPlace(development.location);
  const price = priceFromText(development);
  const completion = completionText(development.completion, development.status.code);
  return (
    <article className="group frame-brand relative flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-xs transition-[box-shadow,translate] duration-200 ease-standard hover:shadow-md focus-within:shadow-md">
      <div className="relative">
        <ListingMedia
          photo={development.cover_photo ?? undefined}
          sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
          priority={photoLoading === "high"}
          eager={photoLoading === "eager"}
          zoomOnHover
          className="aspect-[4/3]"
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <Badge tone={developmentStatusTone(development.status.code)} className="shadow-xs">
            {developmentStatusLabel(development.status)}
          </Badge>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        {price && <p className="font-display text-xl font-bold tabular-nums text-ink">{price}</p>}
        <Heading className="font-sans text-base font-semibold tracking-normal text-ink">
          <Link
            href={developmentPath(development)}
            className="outline-none after:absolute after:inset-0 after:rounded-lg group-hover:underline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus"
          >
            {development.name}
          </Link>
        </Heading>
        {place && (
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            {place}
          </p>
        )}
        {completion && (
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <CalendarClock className="size-4 shrink-0" aria-hidden="true" />
            {completion}
          </p>
        )}
        <p className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line pt-3 text-sm">
          <span className="min-w-0 break-words text-ink">
            <span className="sr-only">Developer: </span>
            {development.developer.name}
          </span>
          <VerifiedMark verified={development.developer.verified} />
        </p>
      </div>
    </article>
  );
}

/** Projects in a grid, coming in row by row as they are scrolled to; the first row never fades. */
export function DevelopmentGrid({ developments, headingLevel }: { developments: DevelopmentListItem[]; headingLevel?: "h2" | "h3" }) {
  return (
    <Stagger as="ul" solid={3} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {developments.map((development, index) => (
        <li key={development.id} className={`flex [&>article]:w-full ${cardLift}`}>
          <DevelopmentCard
            development={development}
            headingLevel={headingLevel}
            photoLoading={index === 0 ? "high" : index < 3 ? "eager" : undefined}
          />
        </li>
      ))}
    </Stagger>
  );
}

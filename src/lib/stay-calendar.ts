import type { PublicAvailability } from "@/lib/api/types";

/**
 * The public calendar of a short stay, as the page hands it to the browser:
 * the span it covers and the nights in it that are not available. Small on
 * purpose, because it is part of the page's HTML.
 */
export type StayCalendarData = {
  slug: string;
  /** IANA zone the dates are in. */
  timezone: string;
  /** The first night covered: the listing's today when the page was rendered. */
  from: string;
  /** The last night covered. */
  to: string;
  minNights: number;
  maxGuests: number | null;
  /** When the host last changed the calendar. Null when they never have. */
  updatedAt: string | null;
  unavailable: string[];
};

export function toStayCalendarData(availability: PublicAvailability): StayCalendarData {
  return {
    slug: availability.listing.slug,
    timezone: availability.timezone,
    from: availability.from,
    to: availability.to,
    minNights: availability.min_nights,
    maxGuests: availability.max_guests,
    updatedAt: availability.availability_updated_at,
    unavailable: availability.days.filter((day) => !day.available).map((day) => day.date),
  };
}

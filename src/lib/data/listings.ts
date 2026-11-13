import type { StaticImageData } from "next/image";
import apartmentAvondale from "@/assets/images/listing-apartment-avondale.jpg";
import houseBorrowdale from "@/assets/images/listing-house-borrowdale.jpg";
import houseVictoriaFalls from "@/assets/images/listing-house-victoria-falls.jpg";
import officeEastlea from "@/assets/images/listing-office-eastlea.jpg";
import standHillside from "@/assets/images/listing-stand-hillside.jpg";
import townhouseMountPleasant from "@/assets/images/listing-townhouse-mount-pleasant.jpg";

/**
 * SAMPLE DATA for UI development only. Replace with the Go API listings
 * endpoints once they exist. The ids match the listings seeded in the
 * backend's in-memory dev store so property requests can be submitted.
 */

export type Money = { amount: string; currency: string };

export type DealType = "sale" | "rent";
export type Category = "residential" | "commercial" | "land";

export type Listing = {
  id: string;
  slug: string;
  /** Sample photo (see src/assets/images/CREDITS.md). Real photos will come from object storage. */
  image: { src: StaticImageData; alt: string };
  reference: string;
  /** UTC instant the current 90-day publication cycle started. */
  publishedAt: string;
  title: string;
  deal: DealType;
  category: Category;
  propertyType: string;
  price: Money;
  pricePeriod?: "month";
  suburb: string;
  city: string;
  marketCode: string;
  bedrooms?: number;
  bathrooms?: number;
  floorArea?: number;
  landArea?: number;
  summary: string;
  description: string;
  features: string[];
  advertiser: { name: string; kind: "agency" | "private-seller"; verified: boolean };
  featured?: boolean;
  tone: "evergreen" | "ochre" | "stone";
};

const id = (n: number) => `0195c0de-0000-7000-8000-${String(n).padStart(12, "0")}`;

export const listings: Listing[] = [
  {
    id: id(1),
    slug: "four-bedroom-family-home-borrowdale",
    image: { src: houseBorrowdale, alt: "White two-storey house with a tiled roof under a blue sky" },
    reference: "RP-ZW-10001",
    publishedAt: "2026-11-10T08:00:00Z",
    title: "Four-bedroom family home with garden",
    deal: "sale",
    category: "residential",
    propertyType: "House",
    price: { amount: "385000.00", currency: "USD" },
    suburb: "Borrowdale",
    city: "Harare",
    marketCode: "ZW",
    bedrooms: 4,
    bathrooms: 3,
    floorArea: 320,
    landArea: 2000,
    summary: "Single-storey home on a walled half-acre with borehole and solar backup.",
    description:
      "A well-kept single-storey home set back from a quiet road. The living areas open onto a covered veranda and an established garden. Borehole with storage tanks, a 5 kVA solar system and staff quarters are included.",
    features: ["Borehole", "Solar backup", "Staff quarters", "Double garage", "Walled and gated"],
    advertiser: { name: "Sample Estates", kind: "agency", verified: true },
    featured: true,
    tone: "evergreen",
  },
  {
    id: id(2),
    slug: "two-bedroom-garden-apartment-avondale",
    image: { src: apartmentAvondale, alt: "White apartment building behind a large green tree" },
    reference: "RP-ZW-10002",
    publishedAt: "2026-11-08T08:00:00Z",
    title: "Two-bedroom garden apartment",
    deal: "rent",
    category: "residential",
    propertyType: "Apartment",
    price: { amount: "950.00", currency: "USD" },
    pricePeriod: "month",
    suburb: "Avondale",
    city: "Harare",
    marketCode: "ZW",
    bedrooms: 2,
    bathrooms: 1,
    floorArea: 96,
    summary: "Ground-floor unit in a small secure complex, walking distance to shops.",
    description:
      "A bright ground-floor apartment with its own small garden in a complex of twelve. Fitted kitchen, built-in cupboards, one covered parking bay and shared borehole water.",
    features: ["Private garden", "Covered parking", "Shared borehole", "24-hour security"],
    advertiser: { name: "Sample Estates", kind: "agency", verified: true },
    featured: true,
    tone: "ochre",
  },
  {
    id: id(3),
    slug: "office-suite-eastlea",
    image: { src: officeEastlea, alt: "Bright office with a long meeting table and chairs" },
    reference: "RP-ZW-10003",
    publishedAt: "2026-11-03T08:00:00Z",
    title: "Office suite with reception and boardroom",
    deal: "rent",
    category: "commercial",
    propertyType: "Office",
    price: { amount: "2400.00", currency: "USD" },
    pricePeriod: "month",
    suburb: "Eastlea",
    city: "Harare",
    marketCode: "ZW",
    floorArea: 210,
    summary: "First-floor suite with six offices, fibre-ready, eight parking bays.",
    description:
      "A first-floor office suite in a converted office park. Six enclosed offices, an open-plan area, reception, boardroom and kitchenette. Backup generator serves the whole park.",
    features: ["Fibre-ready", "Backup generator", "8 parking bays", "Boardroom"],
    advertiser: { name: "Sample Commercial", kind: "agency", verified: true },
    tone: "stone",
  },
  {
    id: id(4),
    slug: "residential-stand-hillside-bulawayo",
    image: { src: standHillside, alt: "Open grassy plot with trees along the boundary" },
    reference: "RP-ZW-10004",
    publishedAt: "2026-10-28T08:00:00Z",
    title: "Serviced residential stand",
    deal: "sale",
    category: "land",
    propertyType: "Stand",
    price: { amount: "48000.00", currency: "USD" },
    suburb: "Hillside",
    city: "Bulawayo",
    marketCode: "ZW",
    landArea: 2000,
    summary: "Level 2,000 mÃ‚Â² stand on a tarred road with water and power at the boundary.",
    description:
      "A level, cleared stand in an established suburb. Municipal water and electricity run along the boundary and the road is tarred. Title deeds are available for inspection.",
    features: ["Title deeds", "Tarred road", "Water at boundary", "Power at boundary"],
    advertiser: { name: "Sample Land Agents", kind: "agency", verified: true },
    tone: "evergreen",
  },
  {
    id: id(5),
    slug: "three-bedroom-townhouse-mount-pleasant",
    image: { src: townhouseMountPleasant, alt: "Row of white townhouses beside a quiet road" },
    reference: "RP-ZW-10005",
    publishedAt: "2026-11-06T08:00:00Z",
    title: "Three-bedroom townhouse",
    deal: "rent",
    category: "residential",
    propertyType: "Townhouse",
    price: { amount: "1600.00", currency: "USD" },
    pricePeriod: "month",
    suburb: "Mount Pleasant",
    city: "Harare",
    marketCode: "ZW",
    bedrooms: 3,
    bathrooms: 2,
    floorArea: 180,
    summary: "Double-storey townhouse in a gated cluster near the university.",
    description:
      "A modern double-storey townhouse with open-plan living downstairs and three bedrooms upstairs. Small private courtyard, lock-up garage and communal borehole.",
    features: ["Gated cluster", "Lock-up garage", "Courtyard", "Communal borehole"],
    advertiser: { name: "Sample Estates", kind: "agency", verified: true },
    featured: true,
    tone: "stone",
  },
  {
    id: id(6),
    slug: "five-bedroom-house-victoria-falls",
    image: { src: houseVictoriaFalls, alt: "Swimming pool and timber deck surrounded by trees" },
    reference: "RP-ZW-10006",
    publishedAt: "2026-10-22T08:00:00Z",
    title: "Five-bedroom house near the river",
    deal: "sale",
    category: "residential",
    propertyType: "House",
    price: { amount: "520000.00", currency: "USD" },
    suburb: "Low Density",
    city: "Victoria Falls",
    marketCode: "ZW",
    bedrooms: 5,
    bathrooms: 4,
    floorArea: 410,
    landArea: 4000,
    summary: "Thatched home on an acre, sold directly by the owner.",
    description:
      "A thatched five-bedroom home on a one-acre plot a short drive from the town centre. All bedrooms are en suite or share a bathroom between two. Pool, borehole and mature indigenous trees.",
    features: ["Swimming pool", "Borehole", "Thatched roof", "Sold by owner"],
    advertiser: { name: "Private seller", kind: "private-seller", verified: true },
    tone: "ochre",
  },
];

export type ListingFilters = { deal?: string; category?: string; q?: string };

export function findListings({ deal, category, q }: ListingFilters = {}): Listing[] {
  const term = q?.trim().toLowerCase();
  return listings.filter(
    (listing) =>
      (!deal || listing.deal === deal) &&
      (!category || listing.category === category) &&
      (!term ||
        [listing.title, listing.suburb, listing.city, listing.propertyType]
          .join(" ")
          .toLowerCase()
          .includes(term)),
  );
}

export function getListingBySlug(slug: string): Listing | undefined {
  return listings.find((listing) => listing.slug === slug);
}

export const dealLabels: Record<DealType, string> = { sale: "For sale", rent: "To rent" };
export const categoryLabels: Record<Category, string> = {
  residential: "Residential",
  commercial: "Commercial",
  land: "Land",
};

/** Listings are published for 90 days (FR-006). */
export const PUBLICATION_DAYS = 90;

/** UTC instant the listing's current publication cycle ends. */
export function listingExpiresAt(listing: Listing): string {
  const expires = new Date(listing.publishedAt);
  expires.setUTCDate(expires.getUTCDate() + PUBLICATION_DAYS);
  return expires.toISOString();
}

import type { StaticImageData } from "next/image";
import houseHighlands from "@/assets/images/listing-house-highlands.jpg";
import houseGlenLorne from "@/assets/images/listing-house-glen-lorne.jpg";
import apartmentAvenues from "@/assets/images/listing-apartment-avenues.jpg";
import apartmentBelgravia from "@/assets/images/listing-apartment-belgravia.jpg";
import houseBurnside from "@/assets/images/listing-house-burnside.jpg";
import houseSuburbsBulawayo from "@/assets/images/listing-house-suburbs-bulawayo.jpg";
import officeCbd from "@/assets/images/listing-office-cbd.jpg";
import standRuwa from "@/assets/images/listing-stand-ruwa.jpg";
import plotMutare from "@/assets/images/listing-plot-mutare.jpg";
import townhouseGreendale from "@/assets/images/listing-townhouse-greendale.jpg";
import cottageGreystonePark from "@/assets/images/listing-cottage-greystone-park.jpg";
import houseMutare from "@/assets/images/listing-house-mutare.jpg";
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
  /** The assigned agent, or the owner for a private sale. Matches the backend's seeded dev accounts. */
  listedBy: string;
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
};

const id = (n: number) => `0195c0de-0000-7000-8000-${String(n).padStart(12, "0")}`;

export const listings: Listing[] = [
  {
    id: id(1),
    slug: "four-bedroom-family-home-borrowdale",
    image: { src: houseBorrowdale, alt: "White two-storey house with a tiled roof under a blue sky" },
    reference: "RP-ZW-10001",
    listedBy: "Tendai Ncube",
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
  },
  {
    id: id(2),
    slug: "two-bedroom-garden-apartment-avondale",
    image: { src: apartmentAvondale, alt: "White apartment building behind a large green tree" },
    reference: "RP-ZW-10002",
    listedBy: "Tendai Ncube",
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
  },
  {
    id: id(3),
    slug: "office-suite-eastlea",
    image: { src: officeEastlea, alt: "Bright office with a long meeting table and chairs" },
    reference: "RP-ZW-10003",
    listedBy: "Farai Chikwanha",
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
  },
  {
    id: id(4),
    slug: "residential-stand-hillside-bulawayo",
    image: { src: standHillside, alt: "Open grassy plot with trees along the boundary" },
    reference: "RP-ZW-10004",
    listedBy: "Nomsa Sibanda",
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
    summary: "Level 2,000 mÃƒâ€šÃ‚Â² stand on a tarred road with water and power at the boundary.",
    description:
      "A level, cleared stand in an established suburb. Municipal water and electricity run along the boundary and the road is tarred. Title deeds are available for inspection.",
    features: ["Title deeds", "Tarred road", "Water at boundary", "Power at boundary"],
    advertiser: { name: "Sample Land Agents", kind: "agency", verified: true },
  },
  {
    id: id(5),
    slug: "three-bedroom-townhouse-mount-pleasant",
    image: { src: townhouseMountPleasant, alt: "Row of white townhouses beside a quiet road" },
    reference: "RP-ZW-10005",
    listedBy: "Tendai Ncube",
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
  },
  {
    id: id(6),
    slug: "five-bedroom-house-victoria-falls",
    image: { src: houseVictoriaFalls, alt: "Swimming pool and timber deck surrounded by trees" },
    reference: "RP-ZW-10006",
    listedBy: "Grace Mhlanga",
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
  },
  {
    id: id(7),
    slug: "four-bedroom-house-highlands",
    image: { src: houseHighlands, alt: "White and grey house beside a swimming pool" },
    reference: "RP-ZW-10007",
    listedBy: "Chipo Dube",
    publishedAt: "2026-11-12T08:00:00Z",
    title: "Four-bedroom house with pool",
    deal: "sale",
    category: "residential",
    propertyType: "House",
    price: { amount: "295000.00", currency: "USD" },
    suburb: "Highlands",
    city: "Harare",
    marketCode: "ZW",
    bedrooms: 4,
    bathrooms: 3,
    floorArea: 280,
    landArea: 1800,
    summary: "Renovated home on a quiet close with a pool and entertainment area.",
    description:
      "A renovated four-bedroom home with open-plan living that leads out to a covered patio and pool. New kitchen, borehole, and a cottage that can be let separately.",
    features: ["Swimming pool", "Borehole", "Cottage", "Electric gate"],
    advertiser: { name: "Sample Estates", kind: "agency", verified: true },
    featured: true,
  },
  {
    id: id(8),
    slug: "five-bedroom-house-glen-lorne",
    image: { src: houseGlenLorne, alt: "Modern house with glass walls beside a pool" },
    reference: "RP-ZW-10008",
    listedBy: "Tatenda Mutasa",
    publishedAt: "2026-11-11T08:00:00Z",
    title: "Five-bedroom contemporary house",
    deal: "sale",
    category: "residential",
    propertyType: "House",
    price: { amount: "640000.00", currency: "USD" },
    suburb: "Glen Lorne",
    city: "Harare",
    marketCode: "ZW",
    bedrooms: 5,
    bathrooms: 5,
    floorArea: 520,
    landArea: 4200,
    summary: "Architect-designed home on an acre with views over the valley.",
    description:
      "Double-volume living spaces with floor-to-ceiling glass, five en-suite bedrooms and a study. Full solar system, two boreholes and a triple garage.",
    features: ["Valley views", "Full solar", "Two boreholes", "Triple garage", "Study"],
    advertiser: { name: "Sample Realty", kind: "agency", verified: true },
    featured: true,
  },
  {
    id: id(9),
    slug: "one-bedroom-apartment-avenues",
    image: { src: apartmentAvenues, alt: "Paved walkway between two apartment buildings" },
    reference: "RP-ZW-10009",
    listedBy: "Tatenda Mutasa",
    publishedAt: "2026-11-12T08:00:00Z",
    title: "One-bedroom apartment near the city",
    deal: "rent",
    category: "residential",
    propertyType: "Apartment",
    price: { amount: "700.00", currency: "USD" },
    pricePeriod: "month",
    suburb: "Avenues",
    city: "Harare",
    marketCode: "ZW",
    bedrooms: 1,
    bathrooms: 1,
    floorArea: 58,
    summary: "Third-floor apartment with a lift, a short walk from the CBD.",
    description:
      "A neat one-bedroom apartment in a well-run block. Open-plan lounge and kitchen, balcony, one secure parking bay and a backup water tank.",
    features: ["Lift", "Balcony", "Secure parking", "Backup water"],
    advertiser: { name: "Sample Realty", kind: "agency", verified: true },
  },
  {
    id: id(10),
    slug: "three-bedroom-apartment-belgravia",
    image: { src: apartmentBelgravia, alt: "Apartment balconies with plants" },
    reference: "RP-ZW-10010",
    listedBy: "Chipo Dube",
    publishedAt: "2026-11-09T08:00:00Z",
    title: "Three-bedroom apartment with balcony",
    deal: "sale",
    category: "residential",
    propertyType: "Apartment",
    price: { amount: "145000.00", currency: "USD" },
    suburb: "Belgravia",
    city: "Harare",
    marketCode: "ZW",
    bedrooms: 3,
    bathrooms: 2,
    floorArea: 132,
    summary: "Spacious second-floor unit in a small block with sectional title.",
    description:
      "Three bedrooms, two bathrooms and a wide balcony overlooking the gardens. Sectional title, lock-up garage and a communal borehole.",
    features: ["Sectional title", "Lock-up garage", "Communal borehole", "Balcony"],
    advertiser: { name: "Sample Estates", kind: "agency", verified: true },
    featured: true,
  },
  {
    id: id(11),
    slug: "three-bedroom-house-burnside-bulawayo",
    image: { src: houseBurnside, alt: "Two-storey family house with a front lawn" },
    reference: "RP-ZW-10011",
    listedBy: "Sipho Nkomo",
    publishedAt: "2026-11-07T08:00:00Z",
    title: "Three-bedroom family house",
    deal: "rent",
    category: "residential",
    propertyType: "House",
    price: { amount: "1100.00", currency: "USD" },
    pricePeriod: "month",
    suburb: "Burnside",
    city: "Bulawayo",
    marketCode: "ZW",
    bedrooms: 3,
    bathrooms: 2,
    floorArea: 210,
    landArea: 3000,
    summary: "Double-storey house on a large stand with a borehole and garden.",
    description:
      "A solid family home with three bedrooms upstairs and generous living rooms below. Large garden, borehole, double carport and staff quarters.",
    features: ["Borehole", "Large garden", "Double carport", "Staff quarters"],
    advertiser: { name: "Sample Homes Bulawayo", kind: "agency", verified: true },
  },
  {
    id: id(12),
    slug: "four-bedroom-house-suburbs-bulawayo",
    image: { src: houseSuburbsBulawayo, alt: "White and brown house under a blue sky" },
    reference: "RP-ZW-10012",
    listedBy: "Sipho Nkomo",
    publishedAt: "2026-11-05T08:00:00Z",
    title: "Four-bedroom house close to schools",
    deal: "sale",
    category: "residential",
    propertyType: "House",
    price: { amount: "180000.00", currency: "USD" },
    suburb: "Suburbs",
    city: "Bulawayo",
    marketCode: "ZW",
    bedrooms: 4,
    bathrooms: 2,
    floorArea: 260,
    landArea: 2400,
    summary: "Character home with high ceilings, walking distance to schools.",
    description:
      "A well-maintained older home with wooden floors and high ceilings. Four bedrooms, two bathrooms, a separate dining room and a flatlet at the back.",
    features: ["Wooden floors", "Flatlet", "Borehole", "Walled"],
    advertiser: { name: "Sample Homes Bulawayo", kind: "agency", verified: true },
    featured: true,
  },
  {
    id: id(13),
    slug: "office-floor-harare-cbd",
    image: { src: officeCbd, alt: "Modern lobby with a marble reception desk" },
    reference: "RP-ZW-10013",
    listedBy: "Farai Chikwanha",
    publishedAt: "2026-11-10T08:00:00Z",
    title: "Full office floor with reception",
    deal: "rent",
    category: "commercial",
    propertyType: "Office",
    price: { amount: "3800.00", currency: "USD" },
    pricePeriod: "month",
    suburb: "CBD",
    city: "Harare",
    marketCode: "ZW",
    floorArea: 420,
    summary: "Whole fourth floor in a managed building with lifts and a generator.",
    description:
      "A complete floor with a reception area, open-plan space, eight partitioned offices and two meeting rooms. Building has lifts, a generator and basement parking.",
    features: ["Lifts", "Generator", "Basement parking", "Two meeting rooms"],
    advertiser: { name: "Sample Commercial", kind: "agency", verified: true },
    featured: true,
  },
  {
    id: id(14),
    slug: "residential-stand-ruwa",
    image: { src: standRuwa, alt: "Green grass field under a cloudy sky" },
    reference: "RP-ZW-10014",
    listedBy: "Nomsa Sibanda",
    publishedAt: "2026-11-08T08:00:00Z",
    title: "Residential stand in a new development",
    deal: "sale",
    category: "land",
    propertyType: "Stand",
    price: { amount: "22000.00", currency: "USD" },
    suburb: "Ruwa",
    city: "Harare",
    marketCode: "ZW",
    landArea: 800,
    summary: "800 mÂ² serviced stand with roads and water reticulation complete.",
    description:
      "A level stand in a gated development. Roads, water and sewer reticulation are complete, and power is being connected. Payment terms are available from the developer.",
    features: ["Serviced", "Gated development", "Payment terms", "Tarred roads"],
    advertiser: { name: "Sample Land Agents", kind: "agency", verified: true },
  },
  {
    id: id(15),
    slug: "one-acre-plot-murambi-mutare",
    image: { src: plotMutare, alt: "Open green field under a blue sky" },
    reference: "RP-ZW-10015",
    listedBy: "Nomsa Sibanda",
    publishedAt: "2026-11-02T08:00:00Z",
    title: "One-acre plot with mountain views",
    deal: "sale",
    category: "land",
    propertyType: "Plot",
    price: { amount: "65000.00", currency: "USD" },
    suburb: "Murambi",
    city: "Mutare",
    marketCode: "ZW",
    landArea: 4000,
    summary: "Gently sloping acre in an established suburb, ready to build.",
    description:
      "A one-acre plot with views towards the mountains. Municipal water and power are available in the road, and title deeds are ready for transfer.",
    features: ["Mountain views", "Title deeds", "Water in road", "Power in road"],
    advertiser: { name: "Sample Land Agents", kind: "agency", verified: true },
  },
  {
    id: id(16),
    slug: "three-bedroom-townhouse-greendale",
    image: { src: townhouseGreendale, alt: "White modern townhouse in daylight" },
    reference: "RP-ZW-10016",
    listedBy: "Tatenda Mutasa",
    publishedAt: "2026-11-06T08:00:00Z",
    title: "Three-bedroom townhouse in a small complex",
    deal: "sale",
    category: "residential",
    propertyType: "Townhouse",
    price: { amount: "210000.00", currency: "USD" },
    suburb: "Greendale",
    city: "Harare",
    marketCode: "ZW",
    bedrooms: 3,
    bathrooms: 2,
    floorArea: 190,
    summary: "Modern lock-up-and-go unit, one of six, with its own garden.",
    description:
      "A modern townhouse with open-plan living, a fitted kitchen and three bedrooms. Private garden, double garage, solar geyser and a shared borehole.",
    features: ["Private garden", "Double garage", "Solar geyser", "Shared borehole"],
    advertiser: { name: "Sample Realty", kind: "agency", verified: true },
  },
  {
    id: id(17),
    slug: "garden-cottage-greystone-park",
    image: { src: cottageGreystonePark, alt: "Small white and timber cottage under a blue sky" },
    reference: "RP-ZW-10017",
    listedBy: "Chipo Dube",
    publishedAt: "2026-11-11T08:00:00Z",
    title: "Garden cottage with its own entrance",
    deal: "rent",
    category: "residential",
    propertyType: "Cottage",
    price: { amount: "600.00", currency: "USD" },
    pricePeriod: "month",
    suburb: "Greystone Park",
    city: "Harare",
    marketCode: "ZW",
    bedrooms: 1,
    bathrooms: 1,
    floorArea: 64,
    summary: "Self-contained cottage on a shared property, water and power included.",
    description:
      "A one-bedroom cottage with a private entrance and a small veranda. Rent includes borehole water, solar-backed power and garden service.",
    features: ["Private entrance", "Water included", "Solar backup", "Garden service"],
    advertiser: { name: "Sample Estates", kind: "agency", verified: true },
  },
  {
    id: id(18),
    slug: "three-bedroom-house-morningside-mutare",
    image: { src: houseMutare, alt: "White house with large windows under a blue sky" },
    reference: "RP-ZW-10018",
    listedBy: "Tatenda Mutasa",
    publishedAt: "2026-10-30T08:00:00Z",
    title: "Three-bedroom house with garden",
    deal: "sale",
    category: "residential",
    propertyType: "House",
    price: { amount: "130000.00", currency: "USD" },
    suburb: "Morningside",
    city: "Mutare",
    marketCode: "ZW",
    bedrooms: 3,
    bathrooms: 2,
    floorArea: 175,
    landArea: 1500,
    summary: "Bright family home on a corner stand in a quiet neighbourhood.",
    description:
      "A bright three-bedroom home with a modern kitchen and a covered veranda. Corner stand with a mature garden, borehole and a single garage.",
    features: ["Corner stand", "Borehole", "Veranda", "Single garage"],
    advertiser: { name: "Sample Realty", kind: "agency", verified: true },
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

/**
 * SAMPLE DATA for the public directories. Replace with Go API endpoints once
 * organisations and professional profiles are served by the backend. Agency
 * and agent names match the listings in ./listings.ts and the backend's
 * seeded development accounts.
 */
import { listings, type Listing } from "@/lib/data/listings";

export type DirectoryKind =
  | "agencies"
  | "agents"
  | "developers"
  | "property-managers"
  | "hosts"
  | "service-providers";

export type Profile = {
  slug: string;
  kind: DirectoryKind;
  name: string;
  /** Job title for people, speciality for businesses. */
  role: string;
  tagline: string;
  about: string;
  city: string;
  areas: string[];
  services: string[];
  verified: boolean;
  /** Paid placement. Always labelled "Sponsored" wherever it is shown. */
  sponsored?: boolean;
  since?: number;
  /** For agents: the agency they work for. */
  agencySlug?: string;
};

export const directories: Record<
  DirectoryKind,
  { title: string; singular: string; description: string }
> = {
  agencies: {
    title: "Estate agencies",
    singular: "Estate agency",
    description: "Registered agencies selling and letting property across Zimbabwe.",
  },
  agents: {
    title: "Estate agents",
    singular: "Estate agent",
    description: "Individual agents, the areas they cover and the properties they are marketing.",
  },
  developers: {
    title: "Property developers",
    singular: "Property developer",
    description: "Developers of estates, cluster homes, apartments and commercial projects.",
  },
  "property-managers": {
    title: "Landlords and property managers",
    singular: "Property manager",
    description: "Landlords and managers who let and look after residential and commercial property.",
  },
  hosts: {
    title: "Hosts and venues",
    singular: "Host",
    description: "Short-stay hosts and owners of showrooms and venues for hire.",
  },
  "service-providers": {
    title: "Property services",
    singular: "Service provider",
    description: "Conveyancers, valuers, movers and tradespeople for buying, selling and maintaining property.",
  },
};

export const directoryKinds = Object.keys(directories) as DirectoryKind[];

export const profiles: Profile[] = [
  // ---- Agencies ----
  {
    slug: "sample-estates",
    kind: "agencies",
    name: "Sample Estates",
    role: "Residential sales and lettings",
    tagline: "Homes for sale and to rent in Harare's northern suburbs.",
    about:
      "Sample Estates sells and lets houses, townhouses and apartments in Harare. The team handles viewings, offers and lease paperwork, and keeps every enquiry on record from first message to handover.",
    city: "Harare",
    areas: ["Borrowdale", "Avondale", "Mount Pleasant", "Highlands", "Belgravia", "Greystone Park"],
    services: ["Residential sales", "Residential lettings", "Valuations for sale"],
    verified: true,
    sponsored: true,
    since: 2009,
  },
  {
    slug: "sample-realty",
    kind: "agencies",
    name: "Sample Realty",
    role: "Residential sales and lettings",
    tagline: "Family homes and apartments in Harare and Mutare.",
    about:
      "Sample Realty markets family homes, apartments and townhouses. It works with first-time buyers as well as owners moving up, and has an office in Mutare.",
    city: "Harare",
    areas: ["Glen Lorne", "Avenues", "Greendale", "Morningside (Mutare)"],
    services: ["Residential sales", "Residential lettings", "Buyer representation"],
    verified: true,
    sponsored: true,
    since: 2014,
  },
  {
    slug: "sample-commercial",
    kind: "agencies",
    name: "Sample Commercial",
    role: "Commercial property",
    tagline: "Offices, retail and industrial space to let and for sale.",
    about:
      "Sample Commercial lets and sells offices, shops and warehouses in Harare. It advises tenants on space planning and landlords on lease terms.",
    city: "Harare",
    areas: ["CBD", "Eastlea", "Msasa"],
    services: ["Office lettings", "Commercial sales", "Lease negotiation"],
    verified: true,
    since: 2011,
  },
  {
    slug: "sample-land-agents",
    kind: "agencies",
    name: "Sample Land Agents",
    role: "Land and stands",
    tagline: "Serviced stands, plots and farms with clean title.",
    about:
      "Sample Land Agents specialises in residential stands, plots and agricultural land. Every listing is checked for title, servicing and access before it is advertised.",
    city: "Bulawayo",
    areas: ["Hillside", "Ruwa", "Murambi (Mutare)"],
    services: ["Stand sales", "Plot and farm sales", "Title checks"],
    verified: true,
    since: 2016,
  },
  {
    slug: "sample-homes-bulawayo",
    kind: "agencies",
    name: "Sample Homes Bulawayo",
    role: "Residential sales and lettings",
    tagline: "Houses for sale and to rent across Bulawayo.",
    about:
      "Sample Homes Bulawayo is a local agency covering the city's established suburbs. It manages sales and rentals and knows the schools, roads and water situation street by street.",
    city: "Bulawayo",
    areas: ["Burnside", "Suburbs", "Hillside", "Kumalo"],
    services: ["Residential sales", "Residential lettings"],
    verified: true,
    since: 2018,
  },

  // ---- Agents ----
  {
    slug: "rudo-moyo",
    kind: "agents",
    name: "Rudo Moyo",
    role: "Principal agent",
    tagline: "Leads the sales team at Sample Estates.",
    about:
      "Rudo runs Sample Estates and oversees every sale and lease the agency handles. She has worked in Harare residential property for more than fifteen years.",
    city: "Harare",
    areas: ["Borrowdale", "Highlands"],
    services: ["Residential sales", "Valuations for sale"],
    verified: true,
    agencySlug: "sample-estates",
  },
  {
    slug: "tendai-ncube",
    kind: "agents",
    name: "Tendai Ncube",
    role: "Sales and lettings agent",
    tagline: "Houses and apartments in Borrowdale, Avondale and Mount Pleasant.",
    about:
      "Tendai handles both sales and rentals and is usually the person showing you around. He answers enquiries the same day.",
    city: "Harare",
    areas: ["Borrowdale", "Avondale", "Mount Pleasant"],
    services: ["Residential sales", "Residential lettings"],
    verified: true,
    agencySlug: "sample-estates",
  },
  {
    slug: "chipo-dube",
    kind: "agents",
    name: "Chipo Dube",
    role: "Sales and lettings agent",
    tagline: "Family homes, apartments and cottages in Harare.",
    about:
      "Chipo works with families looking for their next home and with tenants looking for cottages and apartments close to work.",
    city: "Harare",
    areas: ["Highlands", "Belgravia", "Greystone Park"],
    services: ["Residential sales", "Residential lettings"],
    verified: true,
    agencySlug: "sample-estates",
  },
  {
    slug: "tatenda-mutasa",
    kind: "agents",
    name: "Tatenda Mutasa",
    role: "Principal agent",
    tagline: "Homes in Harare's eastern suburbs and in Mutare.",
    about:
      "Tatenda founded Sample Realty and still handles listings personally, from contemporary homes in Glen Lorne to family houses in Mutare.",
    city: "Harare",
    areas: ["Glen Lorne", "Avenues", "Greendale", "Morningside (Mutare)"],
    services: ["Residential sales", "Residential lettings"],
    verified: true,
    agencySlug: "sample-realty",
  },
  {
    slug: "farai-chikwanha",
    kind: "agents",
    name: "Farai Chikwanha",
    role: "Commercial agent",
    tagline: "Office space in and around the Harare CBD.",
    about:
      "Farai matches businesses with office space and negotiates lease terms for both tenants and landlords.",
    city: "Harare",
    areas: ["CBD", "Eastlea"],
    services: ["Office lettings", "Lease negotiation"],
    verified: true,
    agencySlug: "sample-commercial",
  },
  {
    slug: "nomsa-sibanda",
    kind: "agents",
    name: "Nomsa Sibanda",
    role: "Land specialist",
    tagline: "Stands and plots in Bulawayo, Ruwa and Mutare.",
    about:
      "Nomsa sells residential stands and plots and walks buyers through title, servicing and payment terms before they commit.",
    city: "Bulawayo",
    areas: ["Hillside", "Ruwa", "Murambi (Mutare)"],
    services: ["Stand sales", "Plot and farm sales"],
    verified: true,
    agencySlug: "sample-land-agents",
  },
  {
    slug: "sipho-nkomo",
    kind: "agents",
    name: "Sipho Nkomo",
    role: "Sales and lettings agent",
    tagline: "Family houses for sale and to rent in Bulawayo.",
    about:
      "Sipho has lived in Bulawayo all his life and sells and lets houses in its older suburbs.",
    city: "Bulawayo",
    areas: ["Burnside", "Suburbs"],
    services: ["Residential sales", "Residential lettings"],
    verified: true,
    agencySlug: "sample-homes-bulawayo",
  },

  // ---- Developers ----
  {
    slug: "sample-developments",
    kind: "developers",
    name: "Sample Developments",
    role: "Gated estates and cluster homes",
    tagline: "Serviced stands and cluster homes in secure estates.",
    about:
      "Sample Developments plans and builds gated residential estates around Harare, selling serviced stands and completed cluster homes with staged payment terms.",
    city: "Harare",
    areas: ["Ruwa", "Borrowdale West", "Mount Pleasant Heights"],
    services: ["Serviced stands", "Cluster homes", "Staged payment plans"],
    verified: true,
    sponsored: true,
    since: 2012,
  },
  {
    slug: "sample-urban-builders",
    kind: "developers",
    name: "Sample Urban Builders",
    role: "Apartments and townhouses",
    tagline: "Mid-rise apartments and townhouse complexes in Bulawayo.",
    about:
      "Sample Urban Builders develops sectional-title apartments and small townhouse complexes close to schools and transport.",
    city: "Bulawayo",
    areas: ["Suburbs", "Kumalo", "Hillside"],
    services: ["Apartments", "Townhouses", "Sectional title"],
    verified: true,
    since: 2017,
  },
  {
    slug: "sample-heights",
    kind: "developers",
    name: "Sample Heights",
    role: "Residential and hospitality",
    tagline: "Homes and lodges near the Victoria Falls.",
    about:
      "Sample Heights builds low-density homes and small hospitality projects in Victoria Falls, designed for the climate and the setting.",
    city: "Victoria Falls",
    areas: ["Low Density", "Aerodrome"],
    services: ["Residential projects", "Hospitality projects"],
    verified: true,
    since: 2019,
  },

  // ---- Landlords and property managers ----
  {
    slug: "sample-property-management",
    kind: "property-managers",
    name: "Sample Property Management",
    role: "Residential and commercial management",
    tagline: "Rent collection, maintenance and inspections for owners.",
    about:
      "Sample Property Management looks after houses, apartment blocks and offices on behalf of their owners: finding tenants, collecting rent, arranging repairs and reporting every month.",
    city: "Harare",
    areas: ["Avondale", "Avenues", "Eastlea", "CBD"],
    services: ["Tenant placement", "Rent collection", "Maintenance", "Inspections"],
    verified: true,
    sponsored: true,
    since: 2010,
  },
  {
    slug: "sample-rentals-bulawayo",
    kind: "property-managers",
    name: "Sample Rentals Bulawayo",
    role: "Residential lettings",
    tagline: "A landlord with houses and flats to let in Bulawayo.",
    about:
      "Sample Rentals Bulawayo owns and lets a portfolio of houses and flats, and manages them directly.",
    city: "Bulawayo",
    areas: ["Burnside", "Kumalo", "City centre"],
    services: ["Houses to let", "Flats to let"],
    verified: true,
    since: 2015,
  },

  // ---- Hosts and venues ----
  {
    slug: "sample-falls-stays",
    kind: "hosts",
    name: "Sample Falls Stays",
    role: "Short stays",
    tagline: "Self-catering houses and cottages near the Victoria Falls.",
    about:
      "Sample Falls Stays hosts visitors in self-catering houses and garden cottages a short drive from the Falls, for a few nights or a few weeks.",
    city: "Victoria Falls",
    areas: ["Low Density", "Town centre"],
    services: ["Self-catering houses", "Garden cottages", "Airport transfers"],
    verified: true,
    since: 2020,
  },
  {
    slug: "sample-showrooms",
    kind: "hosts",
    name: "Sample Showrooms",
    role: "Showroom and venue hire",
    tagline: "Showrooms and event space to hire by the hour in Harare.",
    about:
      "Sample Showrooms lets furnished showroom and event space by the hour for launches, exhibitions and pop-up retail.",
    city: "Harare",
    areas: ["Borrowdale", "Msasa"],
    services: ["Hourly showroom hire", "Event space", "Pop-up retail"],
    verified: true,
    sponsored: true,
    since: 2021,
  },

  // ---- Service providers ----
  {
    slug: "sample-conveyancers",
    kind: "service-providers",
    name: "Sample Conveyancers",
    role: "Legal and conveyancing",
    tagline: "Transfers, title deeds and agreements of sale.",
    about:
      "Sample Conveyancers handles property transfers, title deed registration, agreements of sale and lease agreements.",
    city: "Harare",
    areas: ["Harare", "Bulawayo", "Mutare"],
    services: ["Property transfers", "Title deeds", "Agreements of sale", "Leases"],
    verified: true,
    sponsored: true,
    since: 2005,
  },
  {
    slug: "sample-valuers",
    kind: "service-providers",
    name: "Sample Valuers",
    role: "Valuations",
    tagline: "Independent valuations for sale, finance and insurance.",
    about:
      "Sample Valuers provides independent valuations of residential, commercial and agricultural property.",
    city: "Harare",
    areas: ["Harare", "Bulawayo"],
    services: ["Market valuations", "Insurance valuations", "Rental assessments"],
    verified: true,
    since: 2008,
  },
  {
    slug: "sample-movers",
    kind: "service-providers",
    name: "Sample Movers",
    role: "Removals and storage",
    tagline: "House and office moves within Zimbabwe and across the border.",
    about:
      "Sample Movers packs, moves and stores household and office contents, locally and to neighbouring countries.",
    city: "Harare",
    areas: ["Harare", "Bulawayo", "Victoria Falls"],
    services: ["House moves", "Office moves", "Storage", "Cross-border moves"],
    verified: true,
    since: 2013,
  },
  {
    slug: "sample-solar-and-boreholes",
    kind: "service-providers",
    name: "Sample Solar and Boreholes",
    role: "Power and water",
    tagline: "Solar systems and borehole drilling for homes and businesses.",
    about:
      "Sample Solar and Boreholes designs and installs solar power systems and drills, equips and services boreholes.",
    city: "Bulawayo",
    areas: ["Bulawayo", "Harare"],
    services: ["Solar installation", "Borehole drilling", "Pumps and tanks", "Servicing"],
    verified: true,
    since: 2016,
  },
  {
    slug: "sample-plumbing-and-electrical",
    kind: "service-providers",
    name: "Sample Plumbing and Electrical",
    role: "Maintenance and repairs",
    tagline: "Plumbers and electricians for repairs and renovations.",
    about:
      "Sample Plumbing and Electrical carries out repairs, installations and compliance checks for homes, landlords and agents.",
    city: "Harare",
    areas: ["Harare"],
    services: ["Plumbing", "Electrical", "Geysers", "Compliance certificates"],
    verified: true,
    since: 2014,
  },
];

/** Sponsored profiles first, then alphabetical. */
export function profilesOfKind(kind: DirectoryKind): Profile[] {
  return profiles
    .filter((profile) => profile.kind === kind)
    .sort((a, b) => Number(b.sponsored ?? false) - Number(a.sponsored ?? false) || a.name.localeCompare(b.name));
}

export function getProfile(kind: string, slug: string): Profile | undefined {
  return profiles.find((profile) => profile.kind === kind && profile.slug === slug);
}

export function profilePath(profile: Pick<Profile, "kind" | "slug">): string {
  return `/directory/${profile.kind}/${profile.slug}`;
}

export function isDirectoryKind(value: string): value is DirectoryKind {
  return value in directories;
}

/** The listings an agency or agent is marketing. Other kinds have none yet. */
export function listingsForProfile(profile: Profile): Listing[] {
  if (profile.kind === "agencies") {
    return listings.filter((listing) => listing.advertiser.name === profile.name);
  }
  if (profile.kind === "agents") {
    return listings.filter((listing) => listing.listedBy === profile.name);
  }
  return [];
}

export function agentsOfAgency(agency: Profile): Profile[] {
  return profiles.filter((profile) => profile.kind === "agents" && profile.agencySlug === agency.slug);
}

export function agencyOfAgent(agent: Profile): Profile | undefined {
  return profiles.find((profile) => profile.kind === "agencies" && profile.slug === agent.agencySlug);
}

/** Profile pages for a listing's agency and agent, when they exist. */
export function profilesForListing(listing: Listing): { agency?: Profile; agent?: Profile } {
  return {
    agency: profiles.find((p) => p.kind === "agencies" && p.name === listing.advertiser.name),
    agent: profiles.find((p) => p.kind === "agents" && p.name === listing.listedBy),
  };
}

export const initials = (name: string) =>
  name
    .split(" ")
    .filter((word) => word.toLowerCase() !== "and")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

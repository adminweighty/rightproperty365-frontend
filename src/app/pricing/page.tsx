import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ApiBoundary } from "@/components/api-boundary";
import { EmptyState } from "@/components/portal/portal-ui";
import { JsonLd } from "@/components/seo/json-ld";
import { Container } from "@/components/ui/container";
import { ErrorState } from "@/components/ui/error-state";
import { load } from "@/lib/api/server/load";
import { getPricingMarkets } from "@/lib/api/server/packages";
import { legal } from "@/lib/legal";
import { pricingPath } from "@/lib/packages";
import { absoluteUrl, breadcrumbJsonLd } from "@/lib/seo";

const title = "Listing packages and prices";
const description =
  "How many listings agencies, agents and owners can have live at once on RightProperty365, and what each package costs, country by country.";

export async function generateMetadata(): Promise<Metadata> {
  const loaded = await load(getPricingMarkets);
  // No country to show, or the API is not there: not worth a search result (docs/seo.md).
  if (!loaded.ok || loaded.data.length === 0) return { title, description, robots: { index: false, follow: true } };
  return {
    title,
    description,
    alternates: { canonical: "/pricing" },
    openGraph: { type: "website", title, description, url: "/pricing", images: ["/opengraph-image"] },
  };
}

/** One link per country that has packages. */
async function Countries() {
  const loaded = await load(getPricingMarkets);
  if (!loaded.ok) return <ErrorState title="We could not load the packages." retryHref="/pricing" className="mt-10" />;
  if (loaded.data.length === 0) {
    return (
      <div className="mt-10">
        <EmptyState title="No packages are published yet">
          Listing packages are set country by country. Write to{" "}
          <a href={`mailto:${legal.emails.support}`} className="font-medium text-primary-ink hover:underline">
            {legal.emails.support}
          </a>{" "}
          to ask what applies where you list.
        </EmptyState>
      </div>
    );
  }
  return (
    <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {loaded.data.map((pricing) => (
        <li key={pricing.market.code}>
          <Link
            href={pricingPath(pricing.market.code)}
            className="group flex h-full min-h-11 flex-col rounded-lg border border-line bg-surface p-5 shadow-xs transition-shadow hover:shadow-md"
          >
            <span className="text-xl font-bold text-ink group-hover:underline">{pricing.market.name}</span>
            <span className="mt-1 text-sm text-muted">
              {pricing.items.length === 1 ? "1 package" : `${pricing.items.length} packages`}, prices in {pricing.market.currency}
            </span>
            <span className="mt-auto flex items-center gap-1.5 pt-4 text-sm font-semibold text-primary-ink">
              See the packages
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** `/pricing`: the countries that publish listing packages. */
export default function PricingPage() {
  return (
    <Container className="py-10 md:py-14">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          url: absoluteUrl("/pricing"),
          name: title,
          breadcrumb: breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Listing packages", path: "/pricing" },
          ]),
        }}
      />
      <div className="enter-rise">
        <div className="rule-brand w-12" aria-hidden="true" />
        <h1 className="mt-4 text-3xl md:text-5xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">
          A package sets how many of an agency&apos;s or an owner&apos;s listings can be live at once. Searching and sending
          enquiries are always free. Packages and prices are set per country.
        </p>
      </div>
      <ApiBoundary fallback={<div aria-busy="true" aria-label="Loading the countries" className="mt-10 h-48 rounded-lg bg-sunken" />}>
        <Countries />
      </ApiBoundary>
    </Container>
  );
}

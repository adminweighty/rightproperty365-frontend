import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ApiBoundary } from "@/components/api-boundary";
import { PricingList } from "@/components/packages/pricing-list";
import { EmptyState } from "@/components/portal/portal-ui";
import { JsonLd } from "@/components/seo/json-ld";
import { Container } from "@/components/ui/container";
import { ErrorState } from "@/components/ui/error-state";
import { load, readAtBuild } from "@/lib/api/server/load";
import { getMarketPricing, getPricingMarkets } from "@/lib/api/server/packages";
import { countryInSentence } from "@/lib/countries";
import { legal } from "@/lib/legal";
import { pricingPath } from "@/lib/packages";
import { absoluteUrl, breadcrumbJsonLd } from "@/lib/seo";

type Props = PageProps<"/pricing/[country]">;

// The content reads the address and the API with no <Suspense> around it
// (ApiBoundary), so an address that was not prerendered has no static shell.
export const instant = false;

/** Cache Components needs at least one param to build the route's shell. This is never a country. */
const SHELL_ONLY = [{ country: "not-prerendered" }];

// Every country with packages is prerendered when the API is reachable during the build.
export async function generateStaticParams() {
  const markets = await readAtBuild(getPricingMarkets);
  return markets?.length ? markets.map(({ market }) => ({ country: market.code.toLowerCase() })) : SHELL_ONLY;
}

const headingFor = (code: string, name: string) => `Listing packages and prices in ${countryInSentence(code, name)}`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country } = await params;
  const loaded = await load(() => getMarketPricing(country));
  if (!loaded.ok) return { title: "Listing packages", robots: { index: false, follow: true } };
  if (!loaded.data) return { title: "Page not found", robots: { index: false, follow: true } };
  const { market, items } = loaded.data;
  const title = headingFor(market.code, market.name);
  const description = `The listing packages offered in ${countryInSentence(market.code, market.name)}: how many listings each lets you have live at once, and the price per billing term in ${market.currency}.`;
  const path = pricingPath(market.code);
  // A country without packages is an empty page, and an upper-case address redirects: neither is indexed (docs/seo.md).
  if (items.length === 0 || country !== country.toLowerCase()) return { title, description, robots: { index: false, follow: true } };
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", title, description, url: path, images: ["/opengraph-image"] },
  };
}

async function Pricing({ params }: Pick<Props, "params">) {
  const { country } = await params;
  if (!/^[a-z]{2}$/i.test(country)) notFound();
  if (country !== country.toLowerCase()) permanentRedirect(pricingPath(country));
  const loaded = await load(() => getMarketPricing(country));
  if (!loaded.ok) return <ErrorState title="We could not load the packages." retryHref={pricingPath(country)} />;
  if (!loaded.data) notFound();

  const pricing = loaded.data;
  const { market } = pricing;
  const heading = headingFor(market.code, market.name);
  const path = pricingPath(market.code);
  const hasSample = pricing.items.some((item) => item.prices.some((price) => price.sample));

  return (
    <>
      {pricing.items.length > 0 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "WebPage",
            url: absoluteUrl(path),
            name: heading,
            breadcrumb: breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Listing packages", path: "/pricing" },
              { name: market.name, path },
            ]),
          }}
        />
      )}
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
          <li>
            <Link href="/" className="hover:text-ink hover:underline">
              Home
            </Link>
          </li>
          <ChevronRight className="size-4" aria-hidden="true" />
          <li>
            <Link href="/pricing" className="hover:text-ink hover:underline">
              Listing packages
            </Link>
          </li>
          <ChevronRight className="size-4" aria-hidden="true" />
          <li aria-current="page" className="text-ink">
            {market.name}
          </li>
        </ol>
      </nav>
      <div className="enter-rise mt-4">
        <h1 className="text-3xl md:text-5xl">{heading}</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">
          How many of your listings can be live at once, and what each package costs in {market.currency}. Every listing is
          checked by our review team before it is public, whatever the package.
        </p>
      </div>

      {hasSample && (
        <p className="mt-6 max-w-2xl rounded-md bg-warning-soft p-3 text-sm text-ink">
          <span className="font-medium text-warning">Sample prices. </span>
          Prices marked &ldquo;Sample price&rdquo; are examples from test data, not prices you can buy at.
        </p>
      )}

      <div className="mt-10">
        {pricing.items.length === 0 ? (
          <EmptyState
            title={`No packages are published for ${countryInSentence(market.code, market.name)} yet`}
            action={
              <Link href="/pricing" className="font-medium text-primary-ink hover:underline">
                Other countries
              </Link>
            }
          >
            There is no listing limit here for now.
          </EmptyState>
        ) : (
          <PricingList pricing={pricing} />
        )}
      </div>

      <section aria-labelledby="pricing-ask" className="mt-12 max-w-2xl rounded-lg border border-line bg-soft p-6">
        <h2 id="pricing-ask" className="text-xl">
          Need a different package?
        </h2>
        <p className="mt-2 leading-relaxed text-ink">
          Write to{" "}
          <a href={`mailto:${legal.emails.support}`} className="font-medium text-primary-ink underline underline-offset-2 hover:no-underline">
            {legal.emails.support}
          </a>{" "}
          with the name of your agency or account and how many listings you want live, and we will get back to you.
        </p>
      </section>
    </>
  );
}

/** `/pricing/<country>`: the active listing packages of one country and their prices, exactly as the API gives them. */
export default function CountryPricingPage({ params }: Props) {
  return (
    <Container className="py-10 md:py-14">
      <ApiBoundary fallback={<div aria-busy="true" aria-label="Loading the packages" className="h-96 rounded-lg bg-sunken" />}>
        <Pricing params={params} />
      </ApiBoundary>
    </Container>
  );
}

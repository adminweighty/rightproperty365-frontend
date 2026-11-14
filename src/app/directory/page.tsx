import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProfileGrid } from "@/components/directory/profile-card";
import { CountUp } from "@/components/motion/count-up";
import { Reveal } from "@/components/motion/reveal";
import { Stagger } from "@/components/motion/stagger";
import { JsonLd } from "@/components/seo/json-ld";
import { Container } from "@/components/ui/container";
import { ErrorState } from "@/components/ui/error-state";
import { getDirectoryKinds, getDirectoryList } from "@/lib/api/server/directory";
import { load } from "@/lib/api/server/load";
import { absoluteUrl, breadcrumbJsonLd } from "@/lib/seo";
import { ApiBoundary } from "@/components/api-boundary";

// "Professionals" is the name people see for what the code and the addresses call the directory.
const title = "Find a property professional";
const description =
  "Find Real Estate Agencies, Estate Agents, Solicitors, Property Managers, Property Developers, Hosts and Property Services, each checked before they appear.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/directory" },
  openGraph: { type: "website", title, description, url: "/directory", images: ["/opengraph-image"] },
};

/** The directories with their profile counts, then every sponsored profile. */
async function Directories() {
  const loaded = await load(async () => {
    const kinds = await getDirectoryKinds();
    const lists = await Promise.all(kinds.map((kind) => getDirectoryList(kind.code)));
    return {
      kinds,
      sponsored: lists.flatMap((list) => list?.profiles ?? []).filter((profile) => profile.sponsored),
    };
  });

  if (!loaded.ok) {
    return <ErrorState title="We could not load the professionals." retryHref="/directory" className="mt-10" />;
  }
  const { kinds, sponsored } = loaded.data;

  return (
    <>
      <Stagger as="ul" className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {kinds.map((kind) => (
          <li key={kind.code}>
            <Link
              href={`/directory/${kind.code}`}
              className="group frame-brand flex h-full flex-col rounded-lg border border-line bg-surface p-6 shadow-xs transition-shadow hover:shadow-md"
            >
              <CountUp value={kind.count} className="text-4xl font-bold text-primary-ink" />
              <span className="mt-2 text-xl font-bold text-ink group-hover:underline">{kind.label}</span>
              <span className="mt-2 text-sm leading-relaxed text-muted">{kind.description}</span>
              <span className="mt-auto flex items-center gap-1.5 pt-5 text-sm font-semibold text-primary-ink">
                Browse
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </Stagger>

      {sponsored.length > 0 && (
        <section aria-labelledby="sponsored-heading" className="mt-16">
          <Reveal>
            <h2 id="sponsored-heading" className="text-2xl md:text-3xl">
              Sponsored profiles
            </h2>
            <p className="mt-2 text-sm text-muted">
              These businesses pay for a featured position. Sponsorship does not change verification.
            </p>
          </Reveal>
          <div className="mt-8">
            <ProfileGrid profiles={sponsored} />
          </div>
        </section>
      )}
    </>
  );
}

export default function DirectoryPage() {
  return (
    <Container className="py-10 md:py-14">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          url: absoluteUrl("/directory"),
          name: title,
          breadcrumb: breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Professionals", path: "/directory" },
          ]),
        }}
      />
      <div className="enter-rise">
        <h1 className="text-3xl md:text-5xl">Find a property professional</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">
          The people and businesses behind property: who sells it, builds it, manages it and keeps
          it running.
        </p>
      </div>

      <ApiBoundary fallback={<div aria-busy="true" aria-label="Loading professionals and businesses" className="mt-10 h-96 rounded-lg bg-sunken" />}>
        <Directories />
      </ApiBoundary>
    </Container>
  );
}

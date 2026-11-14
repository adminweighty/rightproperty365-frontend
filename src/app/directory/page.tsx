import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProfileGrid } from "@/components/directory/profile-card";
import { JsonLd } from "@/components/seo/json-ld";
import { Container } from "@/components/ui/container";
import { ErrorState } from "@/components/ui/error-state";
import { getDirectoryKinds, getDirectoryList } from "@/lib/api/server/directory";
import { load } from "@/lib/api/server/load";
import { absoluteUrl, breadcrumbJsonLd } from "@/lib/seo";

const title = "Property directory: agents, developers and services in Zimbabwe";
const description =
  "Find estate agencies and agents, property developers, landlords and property managers, hosts and property service providers in Zimbabwe.";

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
    return <ErrorState title="We could not load the directory." retryHref="/directory" className="mt-10" />;
  }
  const { kinds, sponsored } = loaded.data;

  return (
    <>
      <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {kinds.map((kind) => (
          <li key={kind.code}>
            <Link
              href={`/directory/${kind.code}`}
              className="group frame-brand flex h-full flex-col rounded-lg border border-line bg-surface p-6 shadow-xs transition-shadow hover:shadow-md"
            >
              <span className="text-4xl font-bold tabular-nums text-primary-ink">{kind.count}</span>
              <span className="mt-2 text-xl font-bold text-ink group-hover:underline">{kind.label}</span>
              <span className="mt-2 text-sm leading-relaxed text-muted">{kind.description}</span>
              <span className="mt-auto flex items-center gap-1.5 pt-5 text-sm font-semibold text-primary-ink">
                Browse
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {sponsored.length > 0 && (
        <section aria-labelledby="sponsored-heading" className="mt-16">
          <h2 id="sponsored-heading" className="text-2xl md:text-3xl">
            Sponsored profiles
          </h2>
          <p className="mt-2 text-sm text-muted">
            These businesses pay for a featured position. Sponsorship does not change verification.
          </p>
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
            { name: "Directory", path: "/directory" },
          ]),
        }}
      />
      <h1 className="text-3xl md:text-5xl">Property directory</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">
        The people and businesses behind property in Zimbabwe: who sells it, builds it, manages it
        and keeps it running.
      </p>

      <Suspense fallback={<div aria-busy="true" aria-label="Loading the directory" className="mt-10 h-96 rounded-lg bg-sunken" />}>
        <Directories />
      </Suspense>
    </Container>
  );
}

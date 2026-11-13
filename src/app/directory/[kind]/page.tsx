import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProfileGrid } from "@/components/directory/profile-card";
import { JsonLd } from "@/components/seo/json-ld";
import { Container } from "@/components/ui/container";
import { directories, directoryKinds, isDirectoryKind, profilesOfKind } from "@/lib/data/directory";
import { activeMarket } from "@/lib/data/markets";
import { directoryJsonLd } from "@/lib/seo";

type Props = PageProps<"/directory/[kind]">;

export function generateStaticParams() {
  return directoryKinds.map((kind) => ({ kind }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kind } = await params;
  if (!isDirectoryKind(kind)) return { title: "Directory not found", robots: { index: false, follow: true } };

  const title = `${directories[kind].title} in ${activeMarket.name}`;
  const { description } = directories[kind];
  const path = `/directory/${kind}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", title, description, url: path, images: ["/opengraph-image"] },
  };
}

export default function DirectoryKindPage({ params }: Props) {
  return (
    <Container className="py-10 md:py-14">
      <Suspense fallback={<div aria-busy="true" className="h-96 rounded-lg bg-sunken" />}>
        <DirectoryList params={params} />
      </Suspense>
    </Container>
  );
}

async function DirectoryList({ params }: Pick<Props, "params">) {
  const { kind } = await params;
  if (!isDirectoryKind(kind)) notFound();

  const entries = profilesOfKind(kind);
  const hasSponsored = entries.some((profile) => profile.sponsored);

  return (
    <>
      <JsonLd data={directoryJsonLd(kind, entries)} />
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
          <li>
            <Link href="/" className="hover:text-ink hover:underline">
              Home
            </Link>
          </li>
          <ChevronRight className="size-4" aria-hidden="true" />
          <li>
            <Link href="/directory" className="hover:text-ink hover:underline">
              Directory
            </Link>
          </li>
          <ChevronRight className="size-4" aria-hidden="true" />
          <li aria-current="page" className="text-ink">
            {directories[kind].title}
          </li>
        </ol>
      </nav>

      <h1 className="mt-6 text-3xl md:text-4xl">
        {directories[kind].title} in {activeMarket.name}
      </h1>
      <p className="mt-3 max-w-2xl text-muted">{directories[kind].description}</p>
      <p className="mt-2 text-sm text-muted" role="status">
        {entries.length === 1 ? "1 profile" : `${entries.length} profiles`}
        {hasSponsored && " · sponsored profiles are shown first"}
      </p>

      <div className="mt-8">
        <ProfileGrid profiles={entries} />
      </div>

      <nav aria-label="Other directories" className="mt-16 border-t border-line pt-10">
        <h2 className="text-xl">Other directories</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {directoryKinds
            .filter((other) => other !== kind)
            .map((other) => (
              <li key={other}>
                <Link
                  href={`/directory/${other}`}
                  className="flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors hover:border-brand hover:bg-brand hover:text-on-brand"
                >
                  {directories[other].title}
                </Link>
              </li>
            ))}
        </ul>
      </nav>
    </>
  );
}

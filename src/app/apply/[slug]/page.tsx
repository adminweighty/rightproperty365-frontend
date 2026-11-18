import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ApplyFlow } from "@/components/applications/apply-flow";
import { Container } from "@/components/ui/container";

type Props = PageProps<"/apply/[slug]">;

export const metadata: Metadata = { title: "Apply for a property", robots: { index: false, follow: false } };

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** The form and the application are read and saved in the browser with the session cookie. */
async function Flow({ params }: Pick<Props, "params">) {
  const { slug } = await params;
  if (!SLUG.test(slug) || slug.length > 200) notFound();
  return <ApplyFlow slug={slug} />;
}

export default function ApplyPage({ params }: Props) {
  return (
    <Container className="max-w-3xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Flow params={params} />
      </Suspense>
    </Container>
  );
}

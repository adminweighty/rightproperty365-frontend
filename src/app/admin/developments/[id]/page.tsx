import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DevelopmentReview } from "@/components/admin/development-review";
import { Container } from "@/components/ui/container";

type Props = PageProps<"/admin/developments/[id]">;

export const metadata: Metadata = { title: "Development review", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** The project is read in the browser with the administrator's session. */
async function Review({ params }: Pick<Props, "params">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return <DevelopmentReview developmentId={id} />;
}

export default function DevelopmentReviewPage({ params }: Props) {
  return (
    <Container className="max-w-6xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Review params={params} />
      </Suspense>
    </Container>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { ProviderReviews } from "@/components/reviews/provider-reviews";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Reviews", robots: { index: false, follow: false } };

/** Private: read in the browser with the session cookie; inside Suspense because it reads the book and page in the address. */
export default function AgentReviewsPage() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <ProviderReviews />
      </Suspense>
    </Container>
  );
}

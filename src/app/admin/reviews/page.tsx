import type { Metadata } from "next";
import { Suspense } from "react";
import { ReviewModeration } from "@/components/admin/review-moderation";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Review moderation", robots: { index: false, follow: false } };

/** The queue is read in the browser with the administrator's session; inside Suspense because it reads the filters in the address. */
export default function ReviewModerationPage() {
  return (
    <Container className="max-w-5xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <ReviewModeration />
      </Suspense>
    </Container>
  );
}

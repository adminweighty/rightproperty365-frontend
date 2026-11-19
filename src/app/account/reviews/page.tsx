import type { Metadata } from "next";
import { ActivityNav } from "@/components/account/activity-nav";
import { MyReviews } from "@/components/reviews/my-reviews";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Your reviews", robots: { index: false, follow: false } };

/** Private: the reviews the account wrote and the ones it may write, read in the browser with the session cookie. */
export default function MyReviewsPage() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <ActivityNav current="reviews" className="mb-6" />
      <MyReviews />
    </Container>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { ActivityNav } from "@/components/account/activity-nav";
import { CustomerVenueBookings } from "@/components/venues/venue-booking-lists";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Your hourly bookings", robots: { index: false, follow: false } };

// The list is read in the browser with the session cookie; nothing is rendered on the server.
export default function Page() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <ActivityNav current="venue-bookings" className="mb-6" />
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <CustomerVenueBookings />
      </Suspense>
    </Container>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { HostVenueBookings } from "@/components/venues/venue-booking-lists";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Hourly bookings", robots: { index: false, follow: false } };

// Read in the browser with the session cookie; the scope, view and day are in the address.
export default function Page() {
  return (
    <Container className="max-w-5xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <HostVenueBookings />
      </Suspense>
    </Container>
  );
}

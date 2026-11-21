import type { Metadata } from "next";
import { Suspense } from "react";
import { AppointmentAvailability } from "@/components/agent/appointment-availability";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Availability", robots: { index: false, follow: false } };

export default function AvailabilityPage() {
  return (
    <Container className="max-w-5xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <AppointmentAvailability />
      </Suspense>
    </Container>
  );
}

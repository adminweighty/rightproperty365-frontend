import type { Metadata } from "next";
import { Suspense } from "react";
import { ActivityNav } from "@/components/account/activity-nav";
import { CustomerAppointments } from "@/components/appointments/appointment-lists";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Your appointments", robots: { index: false, follow: false } };

// The list is read in the browser with the session cookie; nothing is rendered on the server.
export default function Page() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <ActivityNav current="appointments" className="mb-6" />
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <CustomerAppointments />
      </Suspense>
    </Container>
  );
}

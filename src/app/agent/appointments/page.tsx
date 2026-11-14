import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfessionalAppointments } from "@/components/appointments/appointment-lists";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Appointments", robots: { index: false, follow: false } };

// The list is read in the browser with the session cookie; nothing is rendered on the server.
export default function Page() {
  return (
    <Container className="max-w-5xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <ProfessionalAppointments />
      </Suspense>
    </Container>
  );
}

import type { Metadata } from "next";
import { TimeZonePreferences } from "@/components/account/time-zone-preferences";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Time zone", robots: { index: false, follow: false } };

export default function TimeZonePage() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <TimeZonePreferences />
    </Container>
  );
}

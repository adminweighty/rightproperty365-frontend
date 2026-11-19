import type { Metadata } from "next";
import { LegalUpdates } from "@/components/legal/legal-updates";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Updated terms and policies", robots: { index: false, follow: false } };

/** The versions waiting to be accepted come from the signed-in session, in the browser. */
export default function LegalUpdatesPage() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <LegalUpdates />
    </Container>
  );
}

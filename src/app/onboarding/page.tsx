import type { Metadata } from "next";
import { Suspense } from "react";
import { OnboardingHub } from "@/components/onboarding/onboarding-hub";
import { Container } from "@/components/ui/container";
import { load } from "@/lib/api/server/load";
import { getOnboardingRequirements } from "@/lib/api/server/onboarding";

export const metadata: Metadata = { title: "Complete your profile", robots: { index: false } };

/**
 * The applications themselves are read in the browser with the session cookie.
 * The requirements only name what is missing; without them the hub still works
 * and shows a missing document by its code.
 */
async function HubWithRequirements() {
  const loaded = await load(getOnboardingRequirements);
  return <OnboardingHub requirements={loaded.ok ? loaded.data : []} />;
}

export default function OnboardingPage() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <HubWithRequirements />
      </Suspense>
    </Container>
  );
}

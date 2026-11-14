import type { Metadata } from "next";
import { Suspense } from "react";
import { ReviewQueue } from "@/components/admin/review-queue";
import { Container } from "@/components/ui/container";
import { load } from "@/lib/api/server/load";
import { getOnboardingRequirements } from "@/lib/api/server/onboarding";

export const metadata: Metadata = { title: "Verifications", robots: { index: false, follow: false } };

/**
 * The queue is read in the browser with the administrator's session. Only the
 * role filter's options come from the server; without them the filter lists
 * no roles and the queue still works.
 */
async function QueueWithRoles() {
  const loaded = await load(getOnboardingRequirements);
  const roles = loaded.ok ? loaded.data.map(({ role, label }) => ({ value: role, label })) : [];
  return <ReviewQueue roles={roles} />;
}

export default function VerificationsPage() {
  return (
    <Container className="max-w-5xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <QueueWithRoles />
      </Suspense>
    </Container>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { Container } from "@/components/ui/container";
import { ErrorState } from "@/components/ui/error-state";
import { slugToRole } from "@/lib/api/onboarding";
import { load } from "@/lib/api/server/load";
import { getOnboardingLists } from "@/lib/api/server/onboarding";

type Props = PageProps<"/onboarding/[role]">;

export const metadata: Metadata = { title: "Your application", robots: { index: false } };

/**
 * What the role has to provide, and the lists its fields choose from, come
 * from the API on the server. The application itself is private and is read
 * in the browser with the session cookie.
 */
async function Form({ params }: Pick<Props, "params">) {
  const { role: slug } = await params;
  const loaded = await load(getOnboardingLists);
  if (!loaded.ok) {
    return <ErrorState title="We could not load this form." retryHref={`/onboarding/${slug}`} />;
  }
  const { requirements, ...lists } = loaded.data;
  const requirement = requirements.find((item) => item.role === slugToRole(slug));
  // A role with no onboarding (or no such role) has no form.
  if (!requirement) notFound();
  return <OnboardingForm requirement={requirement} lists={lists} />;
}

export default function OnboardingRolePage({ params }: Props) {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Form params={params} />
      </Suspense>
    </Container>
  );
}

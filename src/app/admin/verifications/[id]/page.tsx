import type { Metadata } from "next";
import { Suspense } from "react";
import { ReviewDetail } from "@/components/admin/review-detail";
import { Container } from "@/components/ui/container";
import { getDirectoryKinds } from "@/lib/api/server/directory";
import { load } from "@/lib/api/server/load";
import { getOnboardingLists } from "@/lib/api/server/onboarding";
import { getCatalogue } from "@/lib/api/server/reference";
import { toLabels } from "@/lib/api/types";

type Props = PageProps<"/admin/verifications/[id]">;

export const metadata: Metadata = { title: "Review application", robots: { index: false, follow: false } };

/**
 * The application is read in the browser with the administrator's session.
 * The server adds the public lists used to label it. Without them the page
 * still works and shows codes in place of labels.
 */
async function Detail({ params }: Pick<Props, "params">) {
  const { id } = await params;
  const loaded = await load(async () => {
    const [lists, kinds, catalogue] = await Promise.all([getOnboardingLists(), getDirectoryKinds(), getCatalogue()]);
    return { lists, kinds, organisationKinds: catalogue.sets.organisation_kinds ?? [] };
  });
  const { requirements = [], ...lists } = loaded.ok
    ? loaded.data.lists
    : { requirements: [], cities: [], trades: [], agencies: [] };
  const directoryLabels = loaded.ok
    ? Object.fromEntries(loaded.data.kinds.map(({ code, label }) => [code, label]))
    : {};

  return (
    <ReviewDetail
      id={id}
      requirements={requirements}
      lists={lists}
      directoryLabels={directoryLabels}
      organisationKindLabels={loaded.ok ? toLabels(loaded.data.organisationKinds) : {}}
    />
  );
}

export default function VerificationPage({ params }: Props) {
  return (
    <Container className="max-w-6xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Detail params={params} />
      </Suspense>
    </Container>
  );
}

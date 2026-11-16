import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { UserDetail } from "@/components/admin/user-detail";
import { Container } from "@/components/ui/container";
import { load } from "@/lib/api/server/load";
import { getCatalogue } from "@/lib/api/server/reference";
import { toLabels } from "@/lib/api/types";

type Props = PageProps<"/admin/users/[id]">;

export const metadata: Metadata = { title: "Account", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** The account is read and changed in the browser with the administrator's session; labels come from the server. */
async function Detail({ params }: Pick<Props, "params">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const loaded = await load(getCatalogue);
  const sets = loaded.ok ? loaded.data.sets : undefined;
  return (
    <UserDetail
      userId={id}
      roleLabels={sets ? toLabels(sets.account_roles) : {}}
      organisationKindLabels={sets ? toLabels(sets.organisation_kinds ?? []) : {}}
    />
  );
}

export default function UserPage({ params }: Props) {
  return (
    <Container className="max-w-5xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Detail params={params} />
      </Suspense>
    </Container>
  );
}

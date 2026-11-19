import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccountPackage } from "@/components/admin/account-package";
import { Container } from "@/components/ui/container";

type Props = PageProps<"/admin/packages/users/[id]">;

export const metadata: Metadata = { title: "Direct owner package", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** Read and changed in the browser with the administrator's session. */
async function Account({ params }: Pick<Props, "params">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return <AccountPackage kind="DIRECT_OWNER" accountId={id} />;
}

export default function AccountPackagePage({ params }: Props) {
  return (
    <Container className="max-w-6xl py-10 md:py-14">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Account params={params} />
      </Suspense>
    </Container>
  );
}

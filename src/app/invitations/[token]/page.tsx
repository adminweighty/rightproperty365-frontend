import type { Metadata } from "next";
import { Suspense } from "react";
import { InvitationView } from "@/components/invitations/invitation-view";
import { Container } from "@/components/ui/container";

type Props = PageProps<"/invitations/[token]">;

// The token in the address is a credential: never indexed, never sent on to another site.
export const metadata: Metadata = {
  title: "Team invitation",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * The invitation is read in the browser: it is private to whoever holds the
 * link, and accepting it needs the session cookie. The server only reads the
 * token from the address.
 */
async function Invitation({ params }: Pick<Props, "params">) {
  const { token } = await params;
  return <InvitationView token={token} />;
}

export default function InvitationPage({ params }: Props) {
  return (
    <Container className="max-w-2xl py-10 md:py-16">
      <Suspense fallback={<div className="h-80 rounded-lg bg-sunken" aria-busy="true" />}>
        <Invitation params={params} />
      </Suspense>
    </Container>
  );
}

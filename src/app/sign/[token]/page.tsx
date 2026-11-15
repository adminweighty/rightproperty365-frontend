import type { Metadata } from "next";
import { Suspense } from "react";
import { SigningPage } from "@/components/signing/signing-view";
import { Container } from "@/components/ui/container";

type Props = PageProps<"/sign/[token]">;

// The token in the address is a credential: never indexed, never sent on to another site.
export const metadata: Metadata = {
  title: "Sign a document",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * The document is read in the browser: it is private to whoever holds the
 * link. The server only reads the token from the address.
 */
async function Signing({ params }: Pick<Props, "params">) {
  const { token } = await params;
  return <SigningPage token={token} />;
}

export default function SignPage({ params }: Props) {
  return (
    <Container className="max-w-5xl py-6 md:py-10">
      <Suspense fallback={<div className="h-96 rounded-lg bg-sunken" aria-busy="true" />}>
        <Signing params={params} />
      </Suspense>
    </Container>
  );
}

import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Account deleted", robots: { index: false, follow: false } };

/** Where a person lands after deleting their account. Static: they are signed out. */
export default function AccountDeletedPage() {
  return (
    <Container className="max-w-2xl py-16 md:py-24">
      <h1 className="text-4xl">Your account has been deleted</h1>
      <p className="mt-4 leading-relaxed text-muted">
        You are signed out everywhere and the account can no longer be used. Your name and email address were removed from it.
        We have sent a last email to your address to confirm this.
      </p>
      <p className="mt-3 leading-relaxed text-muted">
        Signed agreements, leases and the requests you sent stay with the people you sent them to. You are welcome to register
        again at any time.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/">Go to the home page</ButtonLink>
        <ButtonLink href="/listings" variant="secondary">
          Find a property
        </ButtonLink>
      </div>
    </Container>
  );
}

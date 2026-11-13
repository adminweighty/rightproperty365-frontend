import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountOverview } from "@/components/auth/account-overview";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };

export default function AccountPage() {
  return (
    <Container className="py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <AccountOverview />
      </Suspense>
    </Container>
  );
}

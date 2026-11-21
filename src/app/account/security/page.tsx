import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountSecurity } from "@/components/account/account-security";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Security", robots: { index: false, follow: false } };

export default function AccountSecurityPage() {
  return (
    <Container className="max-w-5xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <AccountSecurity />
      </Suspense>
    </Container>
  );
}

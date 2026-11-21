import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfirmEmailChange } from "@/components/auth/confirm-email-change";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Confirm your new email address", robots: { index: false, follow: false } };

export default function ConfirmEmailChangePage() {
  return (
    <Container className="py-14">
      <Suspense fallback={<p className="text-muted">Confirming…</p>}>
        <ConfirmEmailChange />
      </Suspense>
    </Container>
  );
}

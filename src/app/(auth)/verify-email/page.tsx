import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyEmail } from "@/components/auth/verify-email";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false } };

export default function VerifyEmailPage() {
  return (
    <AuthShell title="Confirm your email">
      <Suspense fallback={<p className="text-muted">Confirming your email address…</p>}>
        <VerifyEmail />
      </Suspense>
    </AuthShell>
  );
}

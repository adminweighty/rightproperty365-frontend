"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { verifyEmail } from "@/lib/api/auth";
import type { ApiFailure } from "@/lib/api/http";

export function VerifyEmail() {
  const token = useSearchParams().get("token");
  const router = useRouter();
  const { setUser } = useAuth();
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  // The token is single-use, so guard against the effect running twice.
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    verifyEmail(token).then((result) => {
      if (result.ok) {
        setUser(result.data.user);
        router.replace("/account?welcome=1");
      } else {
        setFailure(result.failure);
      }
    });
  }, [token, router, setUser]);

  if (!token || failure) {
    const expired = !token || failure?.code === "INVALID_TOKEN";
    return (
      <>
        <Alert
          title={expired ? "This link has expired or was already used." : failure!.message}
          traceId={expired ? undefined : failure?.traceId}
        >
          {expired && <p>Sign in with your email and password to request a new one.</p>}
        </Alert>
        <ButtonLink href="/sign-in" className="mt-6 w-full">
          Go to sign in
        </ButtonLink>
      </>
    );
  }

  return (
    <p role="status" className="text-muted">
      Confirming your email address…
    </p>
  );
}

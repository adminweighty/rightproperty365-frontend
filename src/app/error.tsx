"use client"; // Error boundaries must be Client Components.

import { useEffect } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

/**
 * Catches an unexpected error while rendering any page. Pages handle an
 * unreachable API themselves (ErrorState); this is for everything else, so a
 * failure never leaves a blank page.
 */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest =
    typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined;

  return (
    <Container className="py-16 md:py-24">
      <h1 className="text-3xl md:text-4xl">This page could not be shown</h1>
      <Alert title="Something went wrong on our side. Please try again." traceId={digest} className="mt-6 max-w-xl" />
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={() => retry()}>Try again</Button>
        <ButtonLink href="/" variant="secondary">
          Go to the home page
        </ButtonLink>
      </div>
    </Container>
  );
}

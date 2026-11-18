import type { Metadata } from "next";
import { Suspense } from "react";
import { FormList } from "@/components/forms/form-list";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Application forms", robots: { index: false, follow: false } };

/** Read in the browser with the session cookie; the organisation is in `?org=`. */
export default function AgentFormsPage() {
  return (
    <Container className="max-w-5xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <FormList />
      </Suspense>
    </Container>
  );
}

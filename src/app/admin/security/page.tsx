import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminSecurity } from "@/components/admin/admin-security";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Two-step sign-in", robots: { index: false, follow: false } };

// Read and changed in the browser with the administrator's session; nothing is rendered on the server.
export default function AdminSecurityPage() {
  return (
    <Container className="max-w-3xl py-10 md:py-14">
      {/* The page reads ?required= from the URL, which is request-time data. */}
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <AdminSecurity />
      </Suspense>
    </Container>
  );
}

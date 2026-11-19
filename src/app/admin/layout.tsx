import type { Metadata } from "next";
import { Suspense } from "react";
import { MfaEnrolmentRedirect } from "@/components/admin/mfa-enrolment-redirect";

// Nothing under /admin is public: keep it out of search results and do not
// link to it from public pages (administrators are given the address).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      {/* A session that may only set up two-step verification is sent to /admin/security. Renders nothing. */}
      <Suspense fallback={null}>
        <MfaEnrolmentRedirect />
      </Suspense>
      {children}
    </>
  );
}

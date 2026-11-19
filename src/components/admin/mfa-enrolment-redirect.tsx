"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { MFA_ENROLMENT_REQUIRED_EVENT } from "@/lib/api/http";
import { ENROLMENT_REQUIRED_PATH, isSecurityPath } from "@/lib/admin-mfa";

/**
 * When any request of an admin page is refused with 403
 * `MFA_ENROLMENT_REQUIRED`, the session may only set up two-step
 * verification: go to /admin/security, which explains why. The address is
 * read when the event comes, so nothing here depends on request-time data
 * while rendering.
 */
export function MfaEnrolmentRedirect() {
  const router = useRouter();

  useEffect(() => {
    const go = () => {
      const { pathname } = window.location;
      if (isSecurityPath(pathname) || pathname.startsWith("/admin/sign-in")) return;
      router.replace(ENROLMENT_REQUIRED_PATH);
    };
    window.addEventListener(MFA_ENROLMENT_REQUIRED_EVENT, go);
    return () => window.removeEventListener(MFA_ENROLMENT_REQUIRED_EVENT, go);
  }, [router]);

  return null;
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminSignInForm } from "@/components/admin/admin-sign-in-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: "Administrator sign in",
  robots: { index: false, follow: false },
};

export default function AdminSignInPage() {
  return (
    <AuthShell
      title="Administrator sign in"
      description="For RightProperty365 staff. Customers and agents sign in from the main site."
    >
      {/* The form reads ?next= from the URL, which is request-time data. */}
      <Suspense fallback={<div className="h-72 rounded-md bg-sunken" aria-busy="true" />}>
        <AdminSignInForm />
      </Suspense>
    </AuthShell>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthSwitchLink } from "@/components/auth/auth-switch-link";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function SignInPage() {
  return (
    <AuthShell
      title="Sign in"
      description="Track your requests, or manage your listings and leads."
      footer={
        <>
          New to RightProperty365?{" "}
          <AuthSwitchLink href="/register">Create an account</AuthSwitchLink>
        </>
      }
    >
      {/* The form reads ?next= from the URL, which is request-time data. */}
      <Suspense fallback={<div className="h-72 rounded-md bg-sunken" aria-busy="true" />}>
        <SignInForm />
      </Suspense>
    </AuthShell>
  );
}

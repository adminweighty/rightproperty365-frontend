"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { platformRoleLabels } from "@/lib/api/auth";

/**
 * Landing page for platform administrators. This chooses what to display; the
 * API only accepts administrator sessions for platform-role actions.
 */
export function AdminHome() {
  const { status, user, isAdmin, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "anonymous") router.replace("/admin/sign-in");
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <div aria-busy="true" aria-label="Loading" className="space-y-4">
        <div className="h-10 max-w-xs rounded-md bg-sunken" />
        <div className="h-40 rounded-lg bg-sunken" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-dashed border-line-strong p-10 text-center">
        <h1 className="text-2xl">You do not have access to this page</h1>
        <p className="mx-auto mt-2 max-w-md text-muted">
          This area is for RightProperty365 administrators. Your account is signed in as a
          customer account.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/account" variant="secondary">
            Go to your account
          </ButtonLink>
          <ButtonLink href="/sign-in" variant="ghost">
            Customer sign in
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <>
      <p className="text-sm font-medium text-primary-ink">Administration</p>
      <h1 className="mt-2 text-4xl">Welcome, {user.name}</h1>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-2xl">Your administrator roles</h2>
          <ul className="mt-4 space-y-3">
            {user.platform_roles.map((assignment) => (
              <li
                key={`${assignment.role}-${assignment.market_code ?? "all"}`}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-ink">{platformRoleLabels[assignment.role]}</span>
                <Badge tone="accent">{assignment.market_code ?? "All markets"}</Badge>
              </li>
            ))}
          </ul>
          <p className="mt-4 break-all text-sm text-muted">{user.email}</p>
        </Card>

        <Card>
          <h2 className="text-2xl">Admin console</h2>
          <Alert tone="info" title="The admin console has not been built yet." className="mt-4">
            <p>
              Moderation, markets, invoices, users and audit will appear here as each one is
              released.
            </p>
          </Alert>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Administrator sessions end after 30 minutes without activity.
          </p>
        </Card>
      </div>

      <Button
        variant="secondary"
        className="mt-8"
        onClick={async () => {
          await signOut();
          router.push("/admin/sign-in");
        }}
      >
        Sign out
      </Button>
    </>
  );
}

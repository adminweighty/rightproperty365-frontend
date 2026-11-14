"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminGate } from "@/components/admin/admin-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { platformRoleLabels, type User } from "@/lib/api/auth";
import { listApplications } from "@/lib/api/onboarding";

/** How many applications are waiting for a decision. Null while loading or if it cannot be read. */
function useSubmittedCount(): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    listApplications({ status: "SUBMITTED", page_size: 1 }).then((result) => {
      if (!cancelled && result.ok) setCount(result.data.counts.SUBMITTED);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return count;
}

function Home({ user }: { user: User }) {
  const { signOut } = useAuth();
  const router = useRouter();
  const waiting = useSubmittedCount();

  return (
    <>
      <p className="text-sm font-medium text-primary-ink">Administration</p>
      <h1 className="mt-2 text-4xl">Welcome, {user.name}</h1>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-2xl">Verifications</h2>
          <p className="mt-2 leading-relaxed text-muted">
            Applications from people who signed up to list or manage property, or to work at an
            agency. Approving one confirms the role and, where the role has one, publishes a
            verified public profile under Professionals.
          </p>
          <p className="mt-4 text-ink" role="status">
            {waiting === null ? (
              <span className="text-muted">Checking for applications…</span>
            ) : (
              <>
                <span className="text-3xl font-bold tabular-nums">{waiting}</span>{" "}
                {waiting === 1 ? "application is" : "applications are"} waiting for review
              </>
            )}
          </p>
          <ButtonLink href="/admin/verifications" className="mt-5">
            Open the review queue
          </ButtonLink>
        </Card>

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

        <Card className="lg:col-span-2">
          <h2 className="text-2xl">Not built yet</h2>
          <p className="mt-2 leading-relaxed text-muted">
            Listing moderation, markets and reference data, invoices, user management and the audit
            log are not in the admin console yet. They will appear here as each one is released.
          </p>
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

/** Landing page for platform administrators. */
export function AdminHome() {
  return <AdminGate>{(user) => <Home user={user} />}</AdminGate>;
}

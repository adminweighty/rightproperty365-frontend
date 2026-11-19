"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { ChipNav } from "@/components/portal/portal-ui";
import { listMyTenancies } from "@/lib/api/properties";

export type ActivityTab = "requests" | "appointments" | "venue-bookings" | "applications" | "saved" | "tenancies";

const TABS: { key: ActivityTab; href: string; label: string }[] = [
  { key: "requests", href: "/account/requests", label: "Requests" },
  { key: "appointments", href: "/account/appointments", label: "Appointments" },
  { key: "venue-bookings", href: "/account/venue-bookings", label: "Hourly bookings" },
  { key: "applications", href: "/account/applications", label: "Applications" },
  { key: "saved", href: "/account/saved", label: "Saved" },
];

const TENANCY_TAB = { key: "tenancies" as const, href: "/account/tenancies", label: "My tenancy" };

/** Whether each signed-in user has a tenancy, asked once per user per visit. */
const hasTenancy = new Map<string, Promise<boolean>>();

function askHasTenancy(userId: string): Promise<boolean> {
  let answer = hasTenancy.get(userId);
  if (!answer) {
    answer = listMyTenancies().then((result) => result.ok && (result.data.total > 0 || result.data.items.length > 0));
    // A failure is not remembered: the next page asks again.
    answer.then((yes) => {
      if (!yes) hasTenancy.delete(userId);
    });
    hasTenancy.set(userId, answer);
  }
  return answer;
}

/**
 * The customer's activity pages, one row of links at the top of each: what
 * they asked about, the viewings they arranged, the venues they asked to
 * book by the hour, the applications they made, the properties they saved
 * and, only when the API returns at least one, their tenancy.
 * Each page says which one it is, so nothing here reads the address; the
 * row is part of the static shell and "My tenancy" joins it once known.
 */
export function ActivityNav({ current, className }: { current: ActivityTab; className?: string }) {
  const { status, user, isAdmin } = useAuth();
  const userId = status === "authenticated" && !isAdmin ? user.id : null;
  const [tenant, setTenant] = useState<{ userId: string; yes: boolean } | null>(null);

  useEffect(() => {
    if (!userId || current === "tenancies") return;
    let cancelled = false;
    askHasTenancy(userId).then((yes) => {
      if (!cancelled) setTenant({ userId, yes });
    });
    return () => {
      cancelled = true;
    };
  }, [userId, current]);

  const showTenancy = current === "tenancies" || (tenant !== null && tenant.userId === userId && tenant.yes);
  const tabs = showTenancy ? [...TABS, TENANCY_TAB] : TABS;

  return (
    <div className={className}>
      <ChipNav label="Your activity" items={tabs.map((tab) => ({ key: tab.key, href: tab.href, label: tab.label, current: tab.key === current }))} />
    </div>
  );
}

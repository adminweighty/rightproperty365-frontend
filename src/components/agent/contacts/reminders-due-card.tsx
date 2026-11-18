"use client";

import { BellRing } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatWhen } from "@/components/portal/portal-ui";
import { Badge } from "@/components/ui/badge";
import { listDueReminders, type DueReminder } from "@/lib/api/contacts";
import type { DashboardOrganisation } from "@/lib/api/dashboard";
import { contactHref, contactsPath } from "@/lib/contacts";

const SHOWN = 5;

type Due = DueReminder & { org: string; orgName: string; overdue: boolean };
type State = { status: "loading" } | { status: "ready"; items: Due[] } | { status: "failed" };

/**
 * "Reminders due" on the professional dashboard: the overdue reminders and
 * those due today in every contact book the person belongs to, soonest
 * first, five shown. Says one plain sentence when they cannot be read.
 */
export function RemindersDueCard({ organisations }: { organisations: DashboardOrganisation[] }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const key = organisations.map((item) => item.id).join(",");

  useEffect(() => {
    let cancelled = false;
    const list = key ? key.split(",") : [];
    Promise.all(list.flatMap((org) => [listDueReminders(org, "overdue"), listDueReminders(org, "today")])).then((answers) => {
      if (cancelled) return;
      if (answers.length > 0 && answers.every((answer) => !answer.ok)) {
        setState({ status: "failed" });
        return;
      }
      const seen = new Set<string>();
      const items: Due[] = [];
      answers.forEach((answer, index) => {
        if (!answer.ok) return;
        const org = list[Math.floor(index / 2)];
        const orgName = organisations.find((item) => item.id === org)?.name ?? "";
        for (const reminder of answer.data.items) {
          if (seen.has(reminder.id) || reminder.done) continue;
          seen.add(reminder.id);
          items.push({ ...reminder, org, orgName, overdue: index % 2 === 0 });
        }
      });
      items.sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at));
      setState({ status: "ready", items });
    });
    return () => {
      cancelled = true;
    };
    // `organisations` is read for names only; `key` says when the list changed.
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const several = organisations.length > 1;
  const firstOrg = organisations[0]?.id;

  return (
    <section aria-labelledby="dash-reminders">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="dash-reminders" className="text-xl">
          Reminders due
        </h2>
        <Link href={contactsPath("", firstOrg, { due: "1" })} className="font-medium text-primary-ink hover:underline">
          Contacts with a reminder due
        </Link>
      </div>
      <div className="mt-3">
        {state.status === "loading" && <div aria-busy="true" aria-label="Loading reminders" className="h-20 rounded-lg bg-sunken" />}
        {state.status === "failed" && <p className="text-muted">Your reminders could not be loaded just now.</p>}
        {state.status === "ready" && state.items.length === 0 && <p className="text-muted">No reminders are due today.</p>}
        {state.status === "ready" && state.items.length > 0 && (
          <>
            <p className="text-sm text-muted" role="status">
              {state.items.length === 1 ? "1 reminder" : `${state.items.length} reminders`} overdue or due today
            </p>
            <ul className="mt-2 divide-y divide-line rounded-lg border border-line bg-surface">
              {state.items.slice(0, SHOWN).map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4">
                  <BellRing className="size-4 shrink-0 text-warning" aria-hidden="true" />
                  <Link href={contactHref(item.contact.id, item.org)} className="min-h-11 content-center font-medium text-primary-ink hover:underline">
                    {item.contact.name}
                  </Link>
                  <span className="min-w-0 break-words text-sm text-ink">{item.text}</span>
                  {item.overdue ? <Badge tone="warning">Overdue</Badge> : <Badge>Today</Badge>}
                  <span className="text-sm text-subtle sm:ml-auto">
                    {formatWhen(item.due_at)}
                    {several && item.orgName && ` · ${item.orgName}`}
                  </span>
                </li>
              ))}
            </ul>
            {state.items.length > SHOWN && (
              <p className="mt-2 text-sm text-muted">and {state.items.length - SHOWN} more in your contacts.</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

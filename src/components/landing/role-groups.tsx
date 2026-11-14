import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { AccountRoleGroup } from "@/lib/api/auth";

type Props = {
  /** The API's `account_roles` reference set under its group headings, in display order. */
  groups: AccountRoleGroup[];
};

/**
 * "Who RightProperty365 is for": one card per role group with each role's
 * title and one-line description, all from the API. A group whose roles need
 * no verification (people looking for property) leads to the listings; every
 * other group leads to registration and says its roles are verified first.
 * Which is which comes from the API's `requires_verification`, not from a
 * list of codes.
 */
export function RoleGroups({ groups }: Props) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((group) => {
        const verified = group.roles.some((role) => role.requiresVerification);
        const headingId = `roles-${group.code}`;
        return (
          <li key={group.code}>
            <section
              aria-labelledby={headingId}
              className="flex h-full flex-col rounded-lg border border-line bg-surface p-6 shadow-xs"
            >
              <h3 id={headingId} className="text-xl">
                {group.label}
              </h3>
              <dl className="mt-4 space-y-4">
                {group.roles.map((role) => (
                  <div key={role.code}>
                    <dt className="font-semibold text-ink">{role.label}</dt>
                    {role.description && <dd className="text-sm leading-relaxed text-muted">{role.description}</dd>}
                  </div>
                ))}
              </dl>
              <div className="mt-auto pt-5">
                {verified && (
                  <p className="mb-2 flex items-center gap-1.5 text-sm text-muted">
                    <ShieldCheck className="size-4 shrink-0 text-primary-ink" aria-hidden="true" />
                    Verified before the role is active
                  </p>
                )}
                <Link
                  href={verified ? "/register" : "/listings"}
                  className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary-ink hover:underline"
                >
                  {verified ? "Create an account" : "Browse listings"}
                  <span className="sr-only">: {group.label}</span>
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </section>
          </li>
        );
      })}
    </ul>
  );
}

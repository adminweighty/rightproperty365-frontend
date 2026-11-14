"use client";

import { useState } from "react";
import type { AccountRoleGroup } from "@/lib/api/auth";
import { splitRoleGroups } from "@/lib/auth-validation";

type Props = {
  /** The API's `account_roles` reference set, grouped under its headings, in display order. */
  groups: AccountRoleGroup[];
  error?: string;
};

/** Behaviour tied to an API code (not a list): the role every new account starts with. */
const DEFAULT_ROLE = "CONSUMER";

type Kind = "seeker" | "other";

const boxClass = "mt-0.5 size-5 shrink-0 accent-(--rp-color-primary-base)";
const rowClass = "flex min-h-11 cursor-pointer items-start gap-3 py-2 text-base text-ink";

/**
 * The sign-up question "How will you use RightProperty365?".
 *
 * An account is either for a Property Seeker (buyer, tenant or both) or for
 * roles from the other groups (any mix of those), never both. So the question
 * is asked in two steps: a pair of radio buttons for which kind of account,
 * then the checkboxes of that kind only. The other kind's checkboxes are
 * hidden and disabled, so they are not sent, and keep their ticks if the
 * person switches back. The API enforces the same rule.
 *
 * The roles, their groups, their titles and their one-line descriptions come
 * from the API; only roles people may choose for themselves are in that set.
 */
export function RoleSelect({ groups, error }: Props) {
  const { seekers, others } = splitRoleGroups(groups);
  // With only one side on offer there is nothing to choose between.
  const twoKinds = seekers.length > 0 && others.length > 0;
  const [kind, setKind] = useState<Kind>(() =>
    others.some((group) => group.roles.some((role) => role.code === DEFAULT_ROLE)) ? "other" : "seeker",
  );

  const anyNeedsVerification = groups.some((group) => group.roles.some((role) => role.requiresVerification));

  const roleList = (group: AccountRoleGroup, active: boolean) => (
    <ul>
      {group.roles.map((role) => (
        <li key={role.code}>
          <label className={rowClass}>
            <input
              type="checkbox"
              name="roles"
              value={role.code}
              defaultChecked={role.code === DEFAULT_ROLE}
              disabled={!active}
              className={boxClass}
            />
            <span>
              <span className="font-medium">{role.label}</span>
              {role.requiresVerification && (
                <span className="block text-sm text-muted sm:ml-2 sm:inline">Needs verification</span>
              )}
              {role.description && (
                <span className="block text-sm leading-snug text-muted">{role.description}</span>
              )}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );

  const groupFieldsets = (list: AccountRoleGroup[], active: boolean) =>
    list.map((group) => (
      <fieldset key={group.code} className="rounded-md border border-line p-3">
        <legend className="px-1 text-sm font-semibold text-ink">{group.label}</legend>
        {roleList(group, active)}
      </fieldset>
    ));

  const kindRadio = (value: Kind, label: string, description: string) => (
    <label className={rowClass}>
      <input
        type="radio"
        name="account_kind"
        value={value}
        checked={kind === value}
        onChange={() => setKind(value)}
        className={boxClass}
      />
      <span>
        <span className="font-semibold">{label}</span>
        <span className="block text-sm leading-snug text-muted">{description}</span>
      </span>
    </label>
  );

  const verificationNote = anyNeedsVerification && (
    <p className="text-sm leading-relaxed text-muted">
      Roles marked “Needs verification” are confirmed after we verify you or your organisation.
      Until then they give no extra access.
    </p>
  );

  return (
    <fieldset id="roles" aria-describedby={error ? "roles-hint roles-error" : "roles-hint"}>
      <legend className="text-sm font-medium text-ink">How will you use RightProperty365?</legend>
      <p id="roles-hint" className="mt-1 text-sm text-muted">
        {twoKinds
          ? "Choose one. An account is either for finding a property or for property work, not both."
          : "Choose all that apply."}
      </p>

      {twoKinds ? (
        <div className="mt-3 space-y-3">
          <div className="rounded-md border border-line p-3">
            {kindRadio(
              "seeker",
              "I am looking for a property",
              "To buy or to rent.",
            )}
            <div hidden={kind !== "seeker"} className="ml-8 border-t border-line pt-1">
              {seekers.map((group) => (
                <fieldset key={group.code}>
                  <legend className="pt-2 text-sm text-muted">{group.label}: choose all that apply.</legend>
                  {roleList(group, kind === "seeker")}
                </fieldset>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-line p-3">
            {kindRadio(
              "other",
              "I work in property, or I own property to sell or let",
              "Professionals, businesses and property owners.",
            )}
            <div hidden={kind !== "other"} className="border-t border-line pt-3">
              <p className="text-sm text-muted">Choose all that apply.</p>
              <div className="mt-3 space-y-4">{groupFieldsets(others, kind === "other")}</div>
              {verificationNote && <div className="mt-3">{verificationNote}</div>}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-3 space-y-4">{groupFieldsets(groups, true)}</div>
          {verificationNote && <div className="mt-3">{verificationNote}</div>}
        </>
      )}

      {error && (
        <p id="roles-error" role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}

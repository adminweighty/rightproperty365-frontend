import type { AccountRoleGroup } from "@/lib/api/auth";

type Props = {
  /** The API's `account_roles` reference set, grouped under its headings, in display order. */
  groups: AccountRoleGroup[];
  error?: string;
};

/** Behaviour tied to an API code (not a list): the role every new account starts with. */
const DEFAULT_ROLE = "CONSUMER";

/**
 * The sign-up question "How will you use RightProperty365?": grouped
 * checkboxes named `roles`, any combination, at least one. The roles, their
 * groups, their titles and their one-line descriptions come from the API;
 * only roles people may choose for themselves are in that set.
 */
export function RoleSelect({ groups, error }: Props) {
  const anyNeedsVerification = groups.some((group) =>
    group.roles.some((role) => role.requiresVerification),
  );

  return (
    <fieldset aria-describedby={error ? "roles-error" : "roles-hint"}>
      <legend className="text-sm font-medium text-ink">How will you use RightProperty365?</legend>
      <p id="roles-hint" className="mt-1 text-sm text-muted">
        Choose all that apply.
      </p>

      <div className="mt-3 space-y-4">
        {groups.map((group) => (
          <fieldset key={group.code} className="rounded-md border border-line p-3">
            <legend className="px-1 text-sm font-semibold text-ink">{group.label}</legend>
            <ul>
              {group.roles.map((role) => (
                <li key={role.code}>
                  <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-base text-ink">
                    <input
                      type="checkbox"
                      name="roles"
                      value={role.code}
                      defaultChecked={role.code === DEFAULT_ROLE}
                      className="mt-0.5 size-5 shrink-0 accent-(--rp-color-primary-base)"
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
          </fieldset>
        ))}
      </div>

      {anyNeedsVerification && (
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Roles marked “Needs verification” are confirmed after we verify you or your organisation.
          Until then they give no extra access.
        </p>
      )}

      {error && (
        <p id="roles-error" role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}

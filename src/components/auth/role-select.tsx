import { accountRoleGroups } from "@/lib/api/auth";

type Props = { error?: string };

/**
 * The sign-up question "How will you use RightProperty365?": grouped
 * checkboxes named `roles`, any combination, at least one. Only roles people
 * may choose for themselves appear here.
 */
export function RoleSelect({ error }: Props) {
  return (
    <fieldset aria-describedby={error ? "roles-error" : "roles-hint"}>
      <legend className="text-sm font-medium text-ink">How will you use RightProperty365?</legend>
      <p id="roles-hint" className="mt-1 text-sm text-muted">
        Choose all that apply.
      </p>

      <div className="mt-3 space-y-4">
        {accountRoleGroups.map((group) => (
          <fieldset key={group.legend} className="rounded-md border border-line p-3">
            <legend className="px-1 text-sm font-medium text-muted">{group.legend}</legend>
            <ul>
              {group.roles.map((role) => (
                <li key={role.value}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base text-ink">
                    <input
                      type="checkbox"
                      name="roles"
                      value={role.value}
                      defaultChecked={role.value === "CONSUMER"}
                      className="size-5 shrink-0 accent-(--rp-color-primary-base)"
                    />
                    {role.label}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        ))}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-muted">
        Listing, managing and agency roles are confirmed after we verify you or your organisation.
        Until then your account works as a buyer or renter account.
      </p>

      {error && (
        <p id="roles-error" role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}

import type { AccountRoleGroup } from "@/lib/api/auth";
import type { ReferenceItem } from "@/lib/api/types";

/**
 * The API's `account_roles` reference set under its group headings
 * ("Property Seekers", "Real Estate Professionals", ...). The API returns
 * roles and groups already in display order, with each role's title and
 * one-line description. Nothing here names a role or a group.
 */
export function groupRoles(roles: ReferenceItem[]): AccountRoleGroup[] {
  const groups: AccountRoleGroup[] = [];
  for (const role of roles) {
    const heading = role.group ?? { code: "other", label: "Other" };
    let group = groups.find((item) => item.code === heading.code);
    if (!group) {
      group = { code: heading.code, label: heading.label, roles: [] };
      groups.push(group);
    }
    group.roles.push({
      code: role.code,
      label: role.label,
      description: role.description,
      requiresVerification: role.requires_verification === true,
    });
  }
  return groups;
}

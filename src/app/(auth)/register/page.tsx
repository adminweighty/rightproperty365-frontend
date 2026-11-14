import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { authLinkClass, AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { ErrorState } from "@/components/ui/error-state";
import type { AccountRoleGroup } from "@/lib/api/auth";
import { load } from "@/lib/api/server/load";
import { getCatalogue } from "@/lib/api/server/reference";
import type { ReferenceItem } from "@/lib/api/types";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

/** The roles under their group headings. The API returns both already in display order. */
function groupRoles(roles: ReferenceItem[]): AccountRoleGroup[] {
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
      requiresVerification: role.requires_verification === true,
    });
  }
  return groups;
}

/** The form needs the role list from the API, so it is loaded on the server and passed down. */
async function RegisterFormWithRoles() {
  const loaded = await load(getCatalogue);
  if (!loaded.ok || loaded.data.sets.account_roles.length === 0) {
    return <ErrorState title="We could not load the sign-up form." retryHref="/register" className="border-0 p-0" />;
  }
  return <RegisterForm roleGroups={groupRoles(loaded.data.sets.account_roles)} />;
}

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create an account"
      description="Save properties and follow every request you send."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/sign-in" className={authLinkClass}>
            Sign in
          </Link>
        </>
      }
    >
      <Suspense fallback={<div aria-busy="true" aria-label="Loading the sign-up form" className="h-96 rounded-md bg-sunken" />}>
        <RegisterFormWithRoles />
      </Suspense>
    </AuthShell>
  );
}

"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import { countLabel, failureNotice, NoticeArea, type Notice } from "@/components/agent/team/shared";
import { EmptyState, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  createBranch,
  listBranches,
  pinMemberBranch,
  updateBranch,
  type Branch,
  type BranchList,
  type TeamMember,
} from "@/lib/api/team";
import { STALE_CODES } from "@/lib/team-messages";

const NAME_MAX = 80;
const WHOLE = "";

/**
 * Branches (API 0.57.0): add, rename and archive the organisation's branches,
 * and say which branch each member works in. A member in a branch sees only
 * the work of that branch and the work with no branch.
 */
export function Branches({ organisationId, members }: { organisationId: string; members: TeamMember[] }) {
  const load = useCallback(() => listBranches(organisationId), [organisationId]);
  const branches = useApi(load);

  return (
    <section aria-labelledby="team-branches">
      <h2 id="team-branches" className="text-2xl">
        Branches
      </h2>
      <p className="mt-1 max-w-2xl text-muted">
        Someone placed in a branch sees only that branch&apos;s listings, leads and ledger entries, and the ones that
        belong to no branch. People in no branch see everything. Tie a listing to a branch on the listing&apos;s page.
      </p>
      <div className="mt-4">
        {branches.state.status === "loading" && <LoadingBlock label="Loading branches" rows={1} />}
        {branches.state.status === "error" && <LoadError failure={branches.state.failure} onRetry={branches.reload} />}
        {branches.state.status === "ready" && (
          <BranchesReady
            organisationId={organisationId}
            data={branches.state.data}
            members={members}
            onChanged={branches.replace}
            onReload={branches.reload}
          />
        )}
      </div>
    </section>
  );
}

function BranchesReady({
  organisationId,
  data,
  members,
  onChanged,
  onReload,
}: {
  organisationId: string;
  data: BranchList;
  members: TeamMember[];
  onChanged: (data: BranchList) => void;
  onReload: () => void;
}) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const result = useRef<HTMLDivElement>(null);
  const say = (next: Notice) => {
    setNotice(next);
    requestAnimationFrame(() => result.current?.focus());
  };
  const replaceBranch = (branch: Branch) =>
    onChanged({ ...data, items: data.items.map((item) => (item.id === branch.id ? branch : item)) });

  const active = data.items.filter((branch) => branch.active);
  const nameOf = (id: string | undefined) => data.items.find((branch) => branch.id === id)?.name;

  async function pin(member: TeamMember, branchId: string) {
    const answer = await pinMemberBranch(organisationId, member.user_id, branchId || null);
    if (!answer.ok) {
      say(failureNotice(answer.failure));
      if (STALE_CODES.has(answer.failure.code)) onReload();
      return;
    }
    const pins = { ...data.member_branches };
    if (branchId) pins[member.user_id] = branchId;
    else delete pins[member.user_id];
    onChanged({ ...data, member_branches: pins });
    say({
      tone: "success",
      text: branchId
        ? `${member.name} now works in ${nameOf(branchId)}.`
        : `${member.name} is in no branch now and sees the whole organisation.`,
    });
  }

  return (
    <div className="space-y-6">
      <AddBranch
        organisationId={organisationId}
        onAdded={(branch) => {
          onChanged({ ...data, items: [...data.items, branch].sort((a, b) => a.name.localeCompare(b.name)) });
          say({ tone: "success", text: `${branch.name} was added.` });
        }}
        onFailed={say}
      />
      <NoticeArea ref={result} notice={notice} />

      {data.items.length === 0 ? (
        <EmptyState title="No branches yet">
          Without branches everyone in the team sees all of the organisation&apos;s work.
        </EmptyState>
      ) : (
        <>
          <Card padded={false}>
            <p role="status" className="sr-only">
              {countLabel(data.items.length, "branch", "branches")}
            </p>
            <ul className="divide-y divide-line">
              {data.items.map((branch) => (
                <BranchRow
                  key={branch.id}
                  organisationId={organisationId}
                  branch={branch}
                  people={members.filter((member) => data.member_branches[member.user_id] === branch.id).length}
                  onChanged={(next, text) => {
                    replaceBranch(next);
                    say({ tone: "success", text });
                  }}
                  onFailed={(failure) => {
                    say(failure);
                  }}
                />
              ))}
            </ul>
          </Card>

          <div>
            <h3 className="text-lg font-semibold">Who works where</h3>
            <Card padded={false} className="mt-3">
              <ul className="divide-y divide-line">
                {members.map((member) => {
                  const current = data.member_branches[member.user_id] ?? WHOLE;
                  const options = [
                    { value: WHOLE, label: "No branch (sees everything)" },
                    ...active.map((branch) => ({ value: branch.id, label: branch.name })),
                  ];
                  // An archived branch a member is still in stays visible until they are moved.
                  if (current && !active.some((branch) => branch.id === current)) {
                    options.push({ value: current, label: `${nameOf(current) ?? "Archived branch"} (archived)` });
                  }
                  const id = `branch-of-${member.user_id}`;
                  return (
                    <li key={member.user_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                      <label htmlFor={id} className="min-w-0 flex-1 font-medium">
                        {member.name}
                        <span className="ml-2 text-sm font-normal text-muted">{member.role_label}</span>
                      </label>
                      <div className="w-full sm:w-72">
                        <SearchableSelect
                          id={id}
                          name={id}
                          options={options}
                          value={current}
                          onValueChange={(value) => void pin(member, value)}
                          aria-label={`Branch of ${member.name}`}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function AddBranch({
  organisationId,
  onAdded,
  onFailed,
}: {
  organisationId: string;
  onAdded: (branch: Branch) => void;
  onFailed: (notice: Notice) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = event.currentTarget;
    const name = String(new FormData(target).get("name") ?? "").trim();
    if (!name) {
      setError("Enter the branch's name.");
      return;
    }
    setBusy(true);
    setError(undefined);
    const answer = await createBranch(organisationId, name);
    setBusy(false);
    if (answer.ok) {
      target.reset();
      onAdded(answer.data.branch);
      return;
    }
    if (answer.failure.code === "BRANCH_NAME_TAKEN") {
      setError("Another branch already has that name.");
      return;
    }
    if (answer.failure.fields?.name) {
      setError(answer.failure.fields.name);
      return;
    }
    onFailed(failureNotice(answer.failure));
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-wrap items-start gap-3">
      <Field id="branch-new-name" label="New branch" error={error} className="w-full max-w-sm">
        <Input
          id="branch-new-name"
          name="name"
          maxLength={NAME_MAX}
          placeholder="For example Harare North"
          aria-invalid={Boolean(error)}
          aria-describedby={fieldDescribedBy("branch-new-name", { error })}
        />
      </Field>
      <Button type="submit" variant="secondary" className="sm:mt-[26px]" disabled={busy} aria-busy={busy}>
        {busy ? "Adding…" : "Add the branch"}
      </Button>
    </form>
  );
}

function BranchRow({
  organisationId,
  branch,
  people,
  onChanged,
  onFailed,
}: {
  organisationId: string;
  branch: Branch;
  people: number;
  onChanged: (branch: Branch, text: string) => void;
  onFailed: (notice: Notice) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const inputId = `branch-name-${branch.id}`;

  async function change(next: { name?: string; active?: boolean }, text: (b: Branch) => string) {
    setBusy(true);
    setError(undefined);
    const answer = await updateBranch(organisationId, branch.id, next);
    setBusy(false);
    if (answer.ok) {
      setEditing(false);
      onChanged(answer.data.branch, text(answer.data.branch));
      return;
    }
    if (answer.failure.code === "BRANCH_NAME_TAKEN" || answer.failure.fields?.name) {
      setError(answer.failure.fields?.name ?? "Another branch already has that name.");
      return;
    }
    onFailed(failureNotice(answer.failure));
  }

  function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") ?? "").trim();
    if (!name) {
      setError("Enter the branch's name.");
      return;
    }
    void change({ name }, (b) => `The branch is now called ${b.name}.`);
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
      {editing ? (
        <form onSubmit={rename} noValidate className="flex w-full flex-wrap items-start gap-3">
          <Field id={inputId} label="Branch name" error={error} className="w-full max-w-sm">
            <Input
              id={inputId}
              name="name"
              defaultValue={branch.name}
              maxLength={NAME_MAX}
              autoFocus
              aria-invalid={Boolean(error)}
              aria-describedby={fieldDescribedBy(inputId, { error })}
            />
          </Field>
          <div className="flex gap-2 sm:mt-[30px]">
            <Button type="submit" size="sm" disabled={busy} aria-busy={busy}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <span className="font-medium">{branch.name}</span>
            {!branch.active && (
              <Badge tone="neutral" className="ml-2">
                Archived
              </Badge>
            )}
            <p className="text-sm text-muted">{countLabel(people, "person", "people")}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)} aria-label={`Rename ${branch.name}`}>
              Rename
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void change({ active: !branch.active }, (b) =>
                  b.active
                    ? `${b.name} is in use again.`
                    : `${b.name} was archived. Its work and people keep it until you move them.`,
                )
              }
            >
              {branch.active ? "Archive" : "Restore"}
            </Button>
          </div>
        </>
      )}
    </li>
  );
}

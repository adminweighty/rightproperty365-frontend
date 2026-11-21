"use client";

import { useCallback, useState } from "react";
import { useApi } from "@/components/portal/use-api";
import { Card } from "@/components/ui/card";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { getDashboard } from "@/lib/api/dashboard";
import type { ApiResult } from "@/lib/api/http";
import { listBranches, tieListingBranch, type Branch } from "@/lib/api/team";
import { teamMessage } from "@/lib/team-messages";

type Loaded = { branches: Branch[]; canManage: boolean };

const NONE = "";

/**
 * The branch of an organisation's listing (API 0.57.0). Its leads follow it.
 * Shown only when the organisation has branches; only its owners and managers
 * change it.
 */
export function ListingBranch({
  organisationId,
  listingId,
  branchId,
}: {
  organisationId: string;
  listingId: string;
  branchId: string | null;
}) {
  const load = useCallback(async (): Promise<ApiResult<Loaded>> => {
    const [branches, dashboard] = await Promise.all([listBranches(organisationId), getDashboard()]);
    if (!branches.ok) return branches;
    const organisation = dashboard.ok ? dashboard.data.organisations.find((item) => item.id === organisationId) : undefined;
    return { ok: true, status: 200, data: { branches: branches.data.items, canManage: Boolean(organisation?.can_manage_team) } };
  }, [organisationId]);
  const loaded = useApi(load);
  const [current, setCurrent] = useState(branchId ?? NONE);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  if (loaded.state.status !== "ready") return null;
  const { branches, canManage } = loaded.state.data;
  const named = branches.find((branch) => branch.id === current);
  if (branches.length === 0 && !current) return null;

  async function choose(value: string) {
    const before = current;
    setCurrent(value);
    setBusy(true);
    setMessage(null);
    const answer = await tieListingBranch(organisationId, listingId, value || null);
    setBusy(false);
    if (!answer.ok) {
      setCurrent(before);
      setMessage({ tone: "error", text: teamMessage(answer.failure) });
      return;
    }
    const name = branches.find((branch) => branch.id === value)?.name;
    setMessage({ tone: "ok", text: name ? `This listing and its leads now belong to ${name}.` : "This listing belongs to no branch now." });
  }

  const options = [
    { value: NONE, label: "No branch" },
    ...branches
      .filter((branch) => branch.active || branch.id === current)
      .map((branch) => ({ value: branch.id, label: branch.active ? branch.name : `${branch.name} (archived)` })),
  ];

  return (
    <Card>
      <h2 className="font-sans text-lg font-semibold tracking-normal">Branch</h2>
      {canManage ? (
        <>
          <p className="mt-1 text-sm text-muted">Only people in this branch, and people in no branch, can work on it.</p>
          <div className="mt-3">
            <SearchableSelect
              id="listing-branch"
              name="branch"
              options={options}
              value={current}
              disabled={busy}
              onValueChange={(value) => void choose(value)}
              aria-label="Branch of this listing"
            />
          </div>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted">{named ? named.name : "No branch"}</p>
      )}
      <p role="status" aria-live="polite" className={message?.tone === "error" ? "mt-2 text-sm text-danger" : "mt-2 text-sm text-muted"}>
        {message?.text}
      </p>
    </Card>
  );
}

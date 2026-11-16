"use client";

import { Filter, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { RoleGate } from "@/components/admin/admin-gate";
import { BackLink, EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  adminListAudit,
  AUDIT_ACTION_LABELS,
  AUDIT_TARGET_LABELS,
  type AdminAuditEvent,
  type AuditAction,
  type AuditTargetType,
} from "@/lib/api/admin-users";
import { AUDIT_ROLES, titleFromCode } from "@/lib/api/auth";
import { pageFrom } from "@/lib/request-filters";

const PATH = "/admin/audit";
const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const TARGET_TYPES = Object.keys(AUDIT_TARGET_LABELS) as AuditTargetType[];
const ACTIONS = Object.keys(AUDIT_ACTION_LABELS) as AuditAction[];

/** Singular names for one target. */
const TARGET_NAMES: Record<AuditTargetType, string> = {
  USER: "Account",
  SUBSCRIPTION_PLAN: "Plan",
  SUBSCRIPTION: "Subscription",
  REFERENCE_ITEM: "Reference row",
};

function targetHref(event: AdminAuditEvent): string | null {
  if (!UUID.test(event.target_id)) return null;
  if (event.target_type === "USER") return `/admin/users/${event.target_id}`;
  if (event.target_type === "SUBSCRIPTION") return `/admin/subscriptions/${event.target_id}`;
  if (event.target_type === "SUBSCRIPTION_PLAN") return `/admin/subscription-plans/${event.target_id}`;
  return null;
}

const valueText = (value: unknown) =>
  value === null || value === undefined ? "–" : typeof value === "object" ? JSON.stringify(value) : String(value);

/** One state (before or after) as a key/value list. */
function StateList({ title, state }: { title: string; state: Record<string, unknown> | null }) {
  if (!state || Object.keys(state).length === 0) return null;
  return (
    <div className="min-w-0">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h4>
      <dl className="mt-1 space-y-1 text-sm">
        {Object.entries(state).map(([key, value]) => (
          <div key={key} className="grid gap-x-3 sm:grid-cols-[10rem_1fr]">
            <dt className="text-muted">{titleFromCode(key)}</dt>
            <dd className="break-words text-ink">{valueText(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** One record of the administrators' audit trail. Also used on an account's page. */
export function AuditEntry({ event }: { event: AdminAuditEvent }) {
  const href = targetHref(event);
  const changed = Boolean((event.before && Object.keys(event.before).length) || (event.after && Object.keys(event.after).length));
  return (
    <article>
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-ink">{AUDIT_ACTION_LABELS[event.action] ?? titleFromCode(event.action)}</span>
        <Badge tone="neutral">{TARGET_NAMES[event.target_type] ?? titleFromCode(event.target_type)}</Badge>
      </p>
      <p className="mt-1 text-sm text-muted">
        <time dateTime={event.at}>{formatWhen(event.at)}</time> · by {event.actor_name || "the system"}
      </p>
      <p className="mt-1 text-sm text-ink">
        {href ? (
          <Link href={href} className="inline-flex min-h-11 items-center font-medium text-primary-ink hover:underline">
            {event.target_label || event.target_id}
          </Link>
        ) : (
          <span className="break-all">{event.target_label || event.target_id}</span>
        )}
      </p>
      {event.reason && <p className="mt-1 whitespace-pre-line text-sm text-ink">Reason: {event.reason}</p>}
      {changed && (
        <details className="mt-2 rounded-md border border-line p-3">
          <summary className="min-h-11 cursor-pointer content-center text-sm font-medium text-primary-ink">What changed</summary>
          <div className="mt-2 grid gap-4 md:grid-cols-2">
            <StateList title="Before" state={event.before} />
            <StateList title="After" state={event.after} />
          </div>
        </details>
      )}
    </article>
  );
}

type Filters = { targetType?: AuditTargetType; targetId?: string; action?: AuditAction; actor?: string };

function hrefFor(filters: Filters, page = 1) {
  const params = new URLSearchParams();
  if (filters.targetType) params.set("target_type", filters.targetType);
  if (filters.targetId) params.set("target_id", filters.targetId);
  if (filters.action) params.set("action", filters.action);
  if (filters.actor) params.set("actor_user_id", filters.actor);
  if (page > 1) params.set("page", String(page));
  const text = params.toString();
  return text ? `${PATH}?${text}` : PATH;
}

function Log() {
  const params = useSearchParams();
  const targetType = TARGET_TYPES.find((value) => value === params.get("target_type"));
  const rawTarget = (params.get("target_id") ?? "").trim();
  const targetId = rawTarget && rawTarget.length <= 200 ? rawTarget : undefined;
  const action = ACTIONS.find((value) => value === params.get("action"));
  const actor = UUID.test(params.get("actor_user_id") ?? "") ? params.get("actor_user_id")! : undefined;
  const page = pageFrom(params.get("page"));

  const load = useCallback(
    () => adminListAudit({ target_type: targetType, target_id: targetId, action, actor_user_id: actor, page }),
    [targetType, targetId, action, actor, page],
  );
  const { state, reload } = useApi(load);
  const filters: Filters = { targetType, targetId, action, actor };
  const data = state.status === "ready" ? state.data : state.status === "loading" ? state.previous : undefined;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / Math.max(1, data.page_size))) : 1;
  const filtered = Boolean(targetType || targetId || action || actor);

  return (
    <>
      <BackLink href="/admin">Administration</BackLink>
      <h1 className="mt-1 text-4xl">Audit log</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Every action taken in the administrators&apos; area, newest first. Records are never changed or removed.
      </p>

      {/* A plain GET form: the filters live in the address, so a view can be bookmarked or linked to. */}
      <form
        action={PATH}
        role="search"
        aria-label="Filter the audit log"
        className="mt-8 grid gap-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        {targetId && <input type="hidden" name="target_id" value={targetId} />}
        {actor && <input type="hidden" name="actor_user_id" value={actor} />}
        <Field id="audit-target-type" label="What was changed">
          <SearchableSelect
            id="audit-target-type"
            name="target_type"
            defaultValue={targetType ?? ""}
            options={[{ value: "", label: "Anything" }, ...TARGET_TYPES.map((value) => ({ value, label: AUDIT_TARGET_LABELS[value] }))]}
          />
        </Field>
        <Field id="audit-action" label="Action">
          <SearchableSelect
            id="audit-action"
            name="action"
            defaultValue={action ?? ""}
            options={[{ value: "", label: "Any action" }, ...ACTIONS.map((value) => ({ value, label: AUDIT_ACTION_LABELS[value] }))]}
          />
        </Field>
        <Button type="submit">
          <Filter className="size-4" aria-hidden="true" />
          Filter
        </Button>
      </form>

      {(targetId || actor) && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Other filters">
          {targetId && (
            <li>
              <Link
                href={hrefFor({ ...filters, targetId: undefined })}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-medium text-ink hover:bg-sunken"
              >
                Only one {targetType ? TARGET_NAMES[targetType].toLowerCase() : "item"}
                <X className="size-4" aria-hidden="true" />
                <span className="sr-only">Remove this filter</span>
              </Link>
            </li>
          )}
          {actor && (
            <li>
              <Link
                href={hrefFor({ ...filters, actor: undefined })}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-medium text-ink hover:bg-sunken"
              >
                Only one administrator
                <X className="size-4" aria-hidden="true" />
                <span className="sr-only">Remove this filter</span>
              </Link>
            </li>
          )}
        </ul>
      )}

      <div className="mt-6">
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "loading" && !data && <LoadingBlock label="Loading the audit log" rows={3} />}
        {data && (
          <p className="text-sm text-muted" role="status">
            {data.total === 1 ? "1 record" : `${data.total} records`}
            {totalPages > 1 && ` · page ${data.page} of ${totalPages}`}
          </p>
        )}
        {data && data.items.length === 0 && (
          <div className="mt-4">
            <EmptyState
              title={filtered ? "No records match those filters" : "Nothing has been recorded yet"}
              action={filtered ? <ButtonLink href={PATH} variant="secondary">Clear filters</ButtonLink> : undefined}
            />
          </div>
        )}
        {data && data.items.length > 0 && (
          <Card padded={false} className="mt-4">
            <ol className="divide-y divide-line" aria-busy={state.status === "loading" || undefined}>
              {data.items.map((event) => (
                <li key={event.id} className="px-5 py-4">
                  <AuditEntry event={event} />
                  {event.actor_user_id && event.actor_user_id !== actor && (
                    <Link
                      href={hrefFor({ actor: event.actor_user_id })}
                      className="inline-flex min-h-11 items-center text-sm text-primary-ink hover:underline"
                    >
                      More by {event.actor_name}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </Card>
        )}
        {data && <Pagination page={data.page} totalPages={totalPages} hrefFor={(value) => hrefFor(filters, value)} label="Audit log" className="mt-8" />}
      </div>
    </>
  );
}

/** `/admin/audit` (SUPER_ADMIN, PLATFORM_ADMIN). */
export function AuditLog() {
  return (
    <RoleGate roles={AUDIT_ROLES} what="the audit log">
      {() => <Log />}
    </RoleGate>
  );
}

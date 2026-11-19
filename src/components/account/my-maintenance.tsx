"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { ErrorSummary } from "@/components/agent/property/form-bits";
import { ProblemFields, summaryOf } from "@/components/agent/maintenance/request-new";
import {
  AddPhotos,
  CommentComposer,
  MaintenanceStatusBadge,
  PhotoGallery,
  PhotoPicker,
  PriorityBadge,
  RequestTimeline,
  sectionHeading,
  uploadChosen,
  useChosenPhotos,
  useMaintenanceOptions,
} from "@/components/agent/maintenance/shared";
import { formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ApiFailure } from "@/lib/api/http";
import { addMyComment, createMyRequest, getMyMaintenanceOptions, getMyRequest, listMyRequests, uploadMyRequestPhoto } from "@/lib/api/maintenance";
import {
  categoryLabel,
  createdRequestId,
  defaultPriority,
  emptyRequestForm,
  hasProblems,
  isMaintenanceStatus,
  requestApiProblems,
  requestBody,
  requestFormProblems,
  TENANT_STATUS_EXPLAINED,
  type MaintenanceOptions,
  type MaintenanceRequest,
  type RequestForm,
  type RequestProblems,
} from "@/lib/maintenance";
import type { Tenancy } from "@/lib/tenancies";

/*
 * The tenant's maintenance on `/account/tenancies/<id>` (API 0.36.2): "Report
 * a problem" (category, how urgent, a title, details and photos) on an
 * active tenancy, and every request linked to the tenancy, whoever raised it,
 * with its photos, timeline and comments. No status, assignment or cost
 * controls: those are the landlord's or agent's. The API never shows the
 * tenant internal notes, costs, ledger ids or the provider's enquiry.
 */

export function MyMaintenance({ tenancy }: { tenancy: Tenancy }) {
  const load = useCallback(() => listMyRequests(tenancy.id), [tenancy.id]);
  const { state, reload } = useApi(load);
  const options = useMaintenanceOptions(tenancy.id, getMyMaintenanceOptions);
  const [reporting, setReporting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const reportButton = useRef<HTMLButtonElement>(null);
  const manager = tenancy.managedBy?.name ?? "your landlord or agent";
  const active = tenancy.status === "ACTIVE";

  return (
    <Card>
      <section aria-labelledby="my-maintenance">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="my-maintenance" className={sectionHeading}>
            Maintenance
          </h2>
          {active && !reporting && (
            <Button
              ref={reportButton}
              variant="secondary"
              onClick={() => {
                setNotice(null);
                setReporting(true);
              }}
            >
              <Plus className="size-4" aria-hidden="true" />
              Report a problem
            </Button>
          )}
        </div>
        <p className="mt-1 text-sm text-muted">
          Tell {manager} about something that needs repairing, and follow its progress here. For an emergency (a gas leak, a fire,
          flooding), call the emergency services and {manager} first.
        </p>
        {!active && <p className="mt-1 text-sm text-muted">New problems can be reported while the tenancy is active.</p>}

        <div aria-live="polite">{notice && <Alert tone="success" className="mt-4" title={notice} />}</div>

        {reporting && (
          <ReportForm
            tenancy={tenancy}
            options={options}
            onCancel={() => {
              setReporting(false);
              reportButton.current?.focus();
            }}
            onReported={(id, failedPhotos) => {
              setReporting(false);
              setNotice(
                failedPhotos.length
                  ? `Your problem was reported to ${manager}, but these photos were not sent: ${failedPhotos.join(", ")}. Open the request to add them again.`
                  : `Your problem was reported to ${manager}. You will be told when its status changes.`,
              );
              if (id) setOpenId(id);
              reload();
            }}
          />
        )}

        <div className="mt-5">
          {state.status === "loading" && <LoadingBlock label="Loading your maintenance requests" rows={2} />}
          {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
          {state.status === "ready" && state.data.items.length === 0 && <p className="text-sm text-muted">No maintenance requests for this tenancy yet.</p>}
          {state.status === "ready" && state.data.items.length > 0 && (
            <ul className="space-y-3">
              {state.data.items.map((item) => (
                <li key={item.id}>
                  <RequestRow tenancyId={tenancy.id} request={item} rules={options} open={openId === item.id} onToggle={() => setOpenId(openId === item.id ? null : item.id)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </Card>
  );
}

function RequestRow({
  tenancyId,
  request,
  rules,
  open,
  onToggle,
}: {
  tenancyId: string;
  request: MaintenanceRequest;
  rules: MaintenanceOptions;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = `my-request-${request.id}`;
  return (
    <article className="rounded-md border border-line">
      <div className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <MaintenanceStatusBadge status={request.status} label={request.statusLabel} />
          <PriorityBadge priority={request.priority} label={request.priorityLabel} />
          {request.reference && <span className="text-xs text-muted">{request.reference}</span>}
        </div>
        <h3 className="mt-2 font-sans text-base font-semibold tracking-normal break-words">{request.title}</h3>
        <p className="text-sm text-muted">
          {categoryLabel(request.category, request.categoryLabel)}
          {request.createdAt && ` · reported ${formatWhen(request.createdAt)}`}
          {request.raisedBy && ` by ${request.raisedBy.you ? "you" : request.raisedBy.kind === "TENANT" ? "a tenant" : "your landlord or agent"}`}
        </p>
        {isMaintenanceStatus(request.status) && <p className="mt-1 text-sm text-ink">{TENANT_STATUS_EXPLAINED[request.status]}</p>}
        <Button variant="ghost" className="mt-2 -ml-3" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
          <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
          {open ? "Hide the details" : "Details, photos and comments"}
          <span className="sr-only"> for {request.title}</span>
        </Button>
      </div>
      <div id={panelId}>{open && <RequestPanel tenancyId={tenancyId} first={request} rules={rules} />}</div>
    </article>
  );
}

/** One request, read again when opened (and after a comment or photos) so its timeline is current. */
function RequestPanel({ tenancyId, first, rules }: { tenancyId: string; first: MaintenanceRequest; rules: MaintenanceOptions }) {
  const load = useCallback(() => getMyRequest(tenancyId, first.id), [tenancyId, first.id]);
  const { state, reload } = useApi(load);
  const request = state.status === "ready" ? state.data : state.status === "loading" ? (state.previous ?? first) : first;

  return (
    <div className="grid gap-5 border-t border-line p-3">
      {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
      <div>
        <h4 className="text-sm font-semibold text-ink">Details</h4>
        {request.description ? (
          <p className="mt-1 text-sm whitespace-pre-line break-words text-ink">{request.description}</p>
        ) : (
          <p className="mt-1 text-sm text-muted">No details were given.</p>
        )}
        <p className="mt-2 text-sm text-muted">
          {[request.property?.name, request.unit?.label].filter(Boolean).join(", ")}
          {request.provider && ` · being handled by ${request.provider.name}`}
        </p>
      </div>
      <PhotoGallery photos={request.photos}>
        {request.can?.addPhoto && (
          <AddPhotos
            id={`my-photos-${request.id}`}
            already={request.photos.length}
            rules={rules.photoRules}
            upload={(file, progress) => uploadMyRequestPhoto(tenancyId, request.id, file, progress)}
            onSent={reload}
          />
        )}
      </PhotoGallery>
      <RequestTimeline request={request} />
      {request.can?.comment ? (
        <CommentComposer
          id={`my-comment-${request.id}`}
          hint="Your landlord or agent sees your comment."
          send={(text) => addMyComment(tenancyId, request.id, text)}
          onSent={reload}
        />
      ) : (
        <p className="text-sm text-muted">This request is finished: comments are closed.</p>
      )}
    </div>
  );
}

function ReportForm({
  tenancy,
  options,
  onCancel,
  onReported,
}: {
  tenancy: Tenancy;
  options: MaintenanceOptions;
  onCancel: () => void;
  onReported: (id: string | null, failedPhotos: string[]) => void;
}) {
  const chosen = useChosenPhotos();
  const [draft, setDraft] = useState<RequestForm>(() => emptyRequestForm());
  const [problems, setProblems] = useState<RequestProblems & { other?: string[] }>({});
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [busy, setBusy] = useState(false);
  const form: RequestForm = options.priorities.some((item) => item.code === draft.priority) ? draft : { ...draft, priority: defaultPriority(options.priorities) };
  const set = (patch: Partial<RequestForm>) => setDraft({ ...form, ...patch });

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const found = requestFormProblems(form, { tenant: true });
    setProblems(found);
    setFailure(null);
    if (hasProblems(found)) return;
    setBusy(true);
    const answer = await createMyRequest(tenancy.id, requestBody(form, true));
    if (!answer.ok) {
      setBusy(false);
      setFailure(answer.failure);
      setProblems(requestApiProblems(answer.failure.fields));
      return;
    }
    const id = createdRequestId(answer.data);
    const failed = id ? await uploadChosen(chosen.photos, (file, progress) => uploadMyRequestPhoto(tenancy.id, id, file, progress), chosen.update) : [];
    setBusy(false);
    onReported(id, failed);
  }

  return (
    <form onSubmit={submit} noValidate className="mt-4 grid gap-5 rounded-md border border-line bg-sunken p-4" aria-labelledby="report-heading">
      <h3 id="report-heading" className="font-sans text-lg font-semibold tracking-normal">
        Report a problem
      </h3>
      <p className="-mt-3 text-sm text-muted">
        At {[tenancy.property?.name, tenancy.unit?.label].filter(Boolean).join(", ") || "your home"}. Your landlord or agent is told straight away.
      </p>
      <ErrorSummary items={summaryOf(problems, "my-problem")} />
      {failure && !failure.fields && <Alert title={failure.message} traceId={failure.traceId} />}
      <ProblemFields prefix="my-problem" form={form} set={set} problems={problems} categories={options.categories} priorities={options.priorities} priorityLabel="How urgent is it?" />
      <PhotoPicker id="my-problem-photos" photos={chosen.photos} onAdd={chosen.add} onRemove={chosen.remove} disabled={busy} rules={options.photoRules} />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy} aria-busy={busy}>
          {busy ? (chosen.photos.length ? "Sending the photos…" : "Sending…") : "Send the report"}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

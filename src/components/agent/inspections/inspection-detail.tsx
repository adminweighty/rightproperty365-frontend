"use client";

import { ArrowDown, ArrowUp, ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { ErrorSummary } from "@/components/agent/property/form-bits";
import { Linked, ManagementShell } from "@/components/agent/property/shared";
import { EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import { PrivateImage } from "@/components/ui/private-image";
import type { User } from "@/lib/api/auth";
import type { DashboardOrganisation } from "@/lib/api/dashboard";
import type { ApiFailure } from "@/lib/api/http";
import {
  cancelInspection,
  completeInspection,
  deleteInspectionPhoto,
  downloadInspectionReport,
  getInspection,
  inspectionPhotoSrc,
  saveChecklist,
  saveFindings,
  startInspection,
  uploadItemPhoto,
} from "@/lib/api/inspections";
import {
  addArea,
  addItem,
  adoptIds,
  areaNameProblem,
  cancelReasonProblem,
  changedFindings,
  checklistProblems,
  checklistSignature,
  completeProblems,
  completionReadiness,
  findingLabel,
  findingWords,
  FINDING_STATUSES,
  incompleteFromConflict,
  inspectionActions,
  inspectionPlace,
  inspectionsPath,
  inspectionTypeLabel,
  isCompleted,
  isInspectionStatus,
  itemLabelProblem,
  megabytes,
  moveArea,
  photoAccept,
  photoTypeWords,
  removeArea,
  removeItem,
  renameArea,
  sortInspectionPhotos,
  STATUS_EXPLAINED,
  structureSignature,
  updateItem,
  type Checklist,
  type ChecklistArea,
  type ChecklistItem,
  type CompleteForm,
  type CompleteProblems,
  type FindingStatus,
  type Inspection,
  type InspectionCan,
  type InspectionOptions,
  type ItemPhoto,
  type Missing,
} from "@/lib/inspections";
import { propertyHref, tenancyHref } from "@/lib/tenancies";
import {
  BaselineLine,
  CompletionSummary,
  InspectionStatusBadge,
  InspectionTypeBadge,
  ProgressMeter,
  ReadOnlyChecklist,
  ReportDownload,
  scheduledWords,
  sectionHeading,
  useInspectionOptions,
} from "./shared";

/** `/agent/inspections/<id>`: the checklist and findings while open; the frozen report once completed. */
export function InspectionDetail({ id }: { id: string }) {
  return (
    <ManagementShell area="inspections" path={`/${encodeURIComponent(id)}`} back={{ href: (org) => inspectionsPath("", org), label: "Inspections" }}>
      {(organisation, user) => <Detail id={id} organisation={organisation} user={user} />}
    </ManagementShell>
  );
}

function Detail({ id, organisation, user }: { id: string; organisation: DashboardOrganisation; user: User }) {
  const org = organisation.id;
  const load = useCallback(() => getInspection(org, id), [org, id]);
  const { state, reload, replace } = useApi(load);
  const options = useInspectionOptions(org);
  // Never the previous answer while reading again: "Reload the inspection" starts the editor afresh.
  const inspection = state.status === "ready" ? state.data : undefined;

  if (state.status === "error" && state.failure.status === 404) {
    return (
      <EmptyState
        title="We could not find that inspection"
        action={
          <ButtonLink href={inspectionsPath("", org)} variant="secondary">
            See all inspections
          </ButtonLink>
        }
      >
        It may belong to another organisation.
      </EmptyState>
    );
  }
  if (state.status === "error") return <LoadError failure={state.failure} onRetry={reload} />;
  if (!inspection) return <LoadingBlock label="Loading the inspection" rows={3} />;

  const actions = inspectionActions(inspection, organisation.role);
  const editing = actions.editChecklist || actions.recordFindings;
  const tenants = inspection.tenancy?.tenants.join(", ") ?? "";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <InspectionStatusBadge status={inspection.status} label={inspection.statusLabel} />
        <InspectionTypeBadge type={inspection.type} label={inspection.typeLabel} />
        {inspection.reference && <span className="text-sm text-muted">{inspection.reference}</span>}
      </div>
      <h1 className="mt-2 text-3xl break-words md:text-4xl">
        {inspectionTypeLabel(inspection.type, inspection.typeLabel)} inspection, {scheduledWords(inspection.scheduledFor)}
      </h1>
      <p className="mt-2 max-w-2xl break-words text-muted">
        {inspection.property?.id && !inspection.property.archived ? (
          <Linked href={propertyHref(inspection.property.id, org)}>{inspection.property.name}</Linked>
        ) : (
          (inspection.property?.name ?? "No property") + (inspection.property?.archived ? " (deleted)" : "")
        )}
        {inspection.unit ? ` · ${inspection.unit.label}${inspection.unit.archived ? " (removed)" : ""}` : " · the whole property"}
        {inspection.template && ` · ${inspection.template.label}`}
      </p>
      {inspection.tenancy && (
        <p className="mt-1 text-sm text-muted">
          Tenancy: <Linked href={tenancyHref(inspection.tenancy.id, org)}>{tenants || "Open the tenancy"}</Linked>
        </p>
      )}
      <p className="mt-1 text-sm text-muted">
        {inspection.inspector && `Inspector: ${inspection.inspector}`}
        {inspection.startedAt && ` · started ${formatWhen(inspection.startedAt)}`}
      </p>
      {isInspectionStatus(inspection.status) && <p className="mt-1 text-sm text-muted">{STATUS_EXPLAINED[inspection.status]}</p>}
      {inspection.baseline?.reference && (
        <p className="mt-1 text-sm text-muted">
          Compared with the move-in inspection {inspection.baseline.reference}
          {inspection.baseline.completedAt && ` (completed ${formatWhen(inspection.baseline.completedAt)})`}: each item shows what was found then.
        </p>
      )}

      <div className="mt-8">
        {editing ? (
          <Editor key={inspection.id} org={org} user={user} inspection={inspection} actions={actions} options={options} onReplace={replace} onReload={reload} />
        ) : (
          <ReadOnly org={org} inspection={inspection} staff={organisation.role === "STAFF"} />
        )}
      </div>
    </>
  );
}

// ---- Read only: completed, cancelled, or read by Agency Staff ------------------------------------------------

function ReadOnly({ org, inspection, staff }: { org: string; inspection: Inspection; staff: boolean }) {
  const completed = isCompleted(inspection.status);
  const progress = inspection.progress;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="grid min-w-0 content-start gap-6 lg:order-2">
        <Card>
          <h2 className={sectionHeading}>{completed ? "Report" : inspection.status === "CANCELLED" ? "Cancelled" : "Progress"}</h2>
          <div className="mt-3 grid gap-4">
            {completed && <CompletionSummary inspection={inspection} />}
            {inspection.status === "CANCELLED" && (
              <p className="text-sm break-words text-ink">
                Cancelled{inspection.cancelledAt && ` on ${formatWhen(inspection.cancelledAt)}`}
                {inspection.cancelledBy && ` by ${inspection.cancelledBy}`}
                {inspection.cancelReason && `: ${inspection.cancelReason}`}
              </p>
            )}
            {!completed && progress && <ProgressMeter id="inspection-progress" done={progress.done} total={progress.total} counts={progress.counts} />}
            {completed && <ReportDownload inspection={inspection} download={() => downloadInspectionReport(org, inspection.id)} variant="primary" />}
            {completed && <p className="text-xs text-muted">The inspection is completed and frozen: nothing on it can change.</p>}
            {staff && !completed && inspection.status !== "CANCELLED" && <p className="text-sm text-muted">You can read this inspection but not change it.</p>}
          </div>
        </Card>
      </div>
      <Card className="min-w-0">
        <h2 className={sectionHeading}>Checklist</h2>
        <div className="mt-4">
          <ReadOnlyChecklist checklist={inspection.checklist} />
        </div>
      </Card>
    </div>
  );
}

// ---- The editor ----------------------------------------------------------------------------------------

type SaveState =
  | { kind: "clean"; at: string | null }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "invalid"; problems: string[] }
  | { kind: "error"; failure: ApiFailure; fatal: boolean };

type Pending =
  | { kind: "area"; areaKey: string; name: string; items: number }
  | { kind: "item"; areaKey: string; itemKey: string; label: string }
  | { kind: "photo"; areaKey: string; itemKey: string; photoId: string; label: string };

const AUTOSAVE_MS = 1500;

/** Field errors of `PUT .../checklist` (`areas[1].items[0].label`) in words. */
function fieldWords(fields: Record<string, string> | undefined, list: Checklist): string[] {
  return Object.entries(fields ?? {}).map(([key, message]) => {
    const area = /areas\[(\d+)\]/.exec(key);
    const item = /items\[(\d+)\]/.exec(key);
    const areaRow = area ? list[Number(area[1])] : undefined;
    const itemRow = item && areaRow ? areaRow.items[Number(item[1])] : undefined;
    const where = [areaRow?.name, itemRow?.label].filter(Boolean).join(", ");
    return where ? `${where}: ${message}` : message;
  });
}

function Editor({
  org,
  user,
  inspection,
  actions,
  options,
  onReplace,
  onReload,
}: {
  org: string;
  user: User;
  inspection: Inspection;
  actions: InspectionCan;
  options: InspectionOptions;
  onReplace: (inspection: Inspection) => void;
  onReload: () => void;
}) {
  const [draft, setDraftState] = useState<Checklist>(inspection.checklist);
  const [save, setSave] = useState<SaveState>({ kind: "clean", at: null });
  /** What the API has, as last read (the ref keeps the same for the save in flight). */
  const [savedList, setSavedList] = useState<Checklist>(inspection.checklist);
  const [pending, setPending] = useState<Pending | null>(null);
  const [pendingBusy, setPendingBusy] = useState(false);
  const [pendingError, setPendingError] = useState<string | undefined>();
  const [announce, setAnnounce] = useState("");
  const [newArea, setNewArea] = useState("");
  const [newAreaProblem, setNewAreaProblem] = useState<string | undefined>();
  const session = useRef({
    draft: inspection.checklist,
    saved: inspection.checklist,
    inFlight: null as Promise<boolean> | null,
    timer: undefined as ReturnType<typeof setTimeout> | undefined,
    status: inspection.status,
  });
  const readiness = completionReadiness(draft);
  const dirty = checklistSignature(draft) !== checklistSignature(savedList);
  const limits = options.limits;
  const itemCount = draft.reduce((sum, area) => sum + area.items.length, 0);

  useEffect(() => {
    session.current.status = inspection.status;
  }, [inspection.status]);

  const setDraft = useCallback((next: Checklist) => {
    session.current.draft = next;
    setDraftState(next);
  }, []);

  /** Saves what changed: the structure first (new ids), then the findings that differ. True when all is saved. */
  const flush = useCallback(async (): Promise<boolean> => {
    const s = session.current;
    // One save at a time: a second waits for the first, then sends what is still unsaved.
    if (s.inFlight) {
      while (s.inFlight) await s.inFlight;
      if (checklistSignature(s.draft) === checklistSignature(s.saved)) return true;
    }
    clearTimeout(s.timer);
    const run = (async () => {
      const sending = s.draft;
      const problems = checklistProblems(sending);
      if (problems.length) {
        setSave({ kind: "invalid", problems });
        return false;
      }
      if (checklistSignature(sending) === checklistSignature(s.saved)) {
        setSave({ kind: "clean", at: null });
        return true;
      }
      setSave({ kind: "saving" });
      let server: Inspection | null = null;
      if (structureSignature(sending) !== structureSignature(s.saved)) {
        const answer = await saveChecklist(org, inspection.id, sending);
        if (!answer.ok) {
          const fatal = answer.failure.code === "INSPECTION_CLOSED";
          const words = fieldWords(answer.failure.fields, sending);
          setSave(words.length ? { kind: "invalid", problems: words } : { kind: "error", failure: answer.failure, fatal });
          return false;
        }
        server = answer.data ?? (await getInspection(org, inspection.id).then((next) => (next.ok ? next.data : null)));
        if (!server) {
          setSave({ kind: "error", failure: { code: "UNEXPECTED_ANSWER", status: 502, message: "The checklist was saved, but we could not read it back. Reload the page." }, fatal: true });
          return false;
        }
        s.saved = server.checklist;
        setSavedList(server.checklist);
      }
      const withIds = server ? adoptIds(sending, server.checklist) : sending;
      const lines = changedFindings(withIds, s.saved);
      if (lines.length) {
        const answer = await saveFindings(org, inspection.id, lines);
        if (!answer.ok) {
          if (server) {
            s.draft = adoptIds(s.draft, server.checklist);
            setDraftState(s.draft);
            onReplace(server);
          }
          const fatal = answer.failure.code === "INSPECTION_CLOSED";
          setSave({ kind: "error", failure: answer.failure, fatal });
          return false;
        }
        server = answer.data ?? (await getInspection(org, inspection.id).then((next) => (next.ok ? next.data : null))) ?? server;
      }
      if (server) {
        s.saved = server.checklist;
        setSavedList(server.checklist);
        s.draft = adoptIds(s.draft, server.checklist);
        setDraftState(s.draft);
        onReplace(server);
      }
      const clean = checklistSignature(s.draft) === checklistSignature(s.saved);
      setSave(clean ? { kind: "clean", at: new Date().toISOString() } : { kind: "dirty" });
      return clean;
    })();
    s.inFlight = run;
    try {
      return await run;
    } finally {
      s.inFlight = null;
    }
  }, [org, inspection.id, onReplace]);

  /** A change by the inspector: shown at once, saved shortly after (typing waits for a pause). */
  const change = useCallback(
    (next: Checklist) => {
      setDraft(next);
      const s = session.current;
      setSave((current) => (current.kind === "error" && current.fatal ? current : { kind: "dirty" }));
      clearTimeout(s.timer);
      s.timer = setTimeout(() => void flush(), AUTOSAVE_MS);
    },
    [flush, setDraft],
  );

  // Ask before leaving with changes that are not saved: closing the tab, and links within the site.
  useEffect(() => {
    const s = session.current;
    const unsaved = () => checklistSignature(s.draft) !== checklistSignature(s.saved) || s.inFlight !== null;
    const warn = (event: BeforeUnloadEvent) => {
      if (unsaved()) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const guard = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download") || link.origin !== window.location.origin) return;
      if (link.getAttribute("href")?.startsWith("#")) return;
      if (unsaved() && !window.confirm("Your latest changes to this inspection are not saved yet. Leave without them?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guard, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", guard, true);
      clearTimeout(s.timer);
    };
  }, []);

  // ---- Structure ----

  function submitArea(event?: FormEvent) {
    event?.preventDefault();
    const problem =
      draft.length >= limits.maxAreas
        ? `A checklist can have up to ${limits.maxAreas} areas.`
        : areaNameProblem(
            newArea,
            draft.map((area) => area.name),
          );
    setNewAreaProblem(problem ?? undefined);
    if (problem) return;
    change(addArea(draft, newArea));
    setAnnounce(`Area ${newArea.trim()} added. Add its items below it.`);
    setNewArea("");
  }

  async function confirmPending() {
    if (!pending) return;
    if (pending.kind === "area") {
      change(removeArea(draft, pending.areaKey));
      setAnnounce(`Area ${pending.name} removed.`);
      setPending(null);
      return;
    }
    if (pending.kind === "item") {
      change(removeItem(draft, pending.areaKey, pending.itemKey));
      setAnnounce(`${pending.label} removed.`);
      setPending(null);
      return;
    }
    setPendingBusy(true);
    setPendingError(undefined);
    const answer = await deleteInspectionPhoto(org, inspection.id, pending.photoId);
    setPendingBusy(false);
    if (!answer.ok && answer.failure.status !== 404) {
      setPendingError(answer.failure.message);
      return;
    }
    const drop = (list: Checklist) =>
      list.map((area) =>
        area.key === pending.areaKey
          ? { ...area, items: area.items.map((item) => (item.key === pending.itemKey ? { ...item, photos: item.photos.filter((photo) => photo.id !== pending.photoId) } : item)) }
          : area,
      );
    session.current.saved = drop(session.current.saved);
    setSavedList(session.current.saved);
    setDraft(drop(session.current.draft));
    setAnnounce("Photo deleted.");
    setPending(null);
  }

  const addPhoto = useCallback(
    (areaKey: string, itemKey: string, photo: ItemPhoto) => {
      const add = (list: Checklist) =>
        list.map((area) => (area.key === areaKey ? { ...area, items: area.items.map((item) => (item.key === itemKey ? { ...item, photos: [...item.photos, photo] } : item)) } : area));
      setDraft(add(session.current.draft));
    },
    [setDraft],
  );

  /** A photo moves a SCHEDULED inspection to IN_PROGRESS: read it again so the status shows. */
  const photosSent = useCallback(async () => {
    if (session.current.status !== "SCHEDULED") return;
    const next = await getInspection(org, inspection.id);
    if (next.ok) onReplace(next.data);
  }, [org, inspection.id, onReplace]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="grid min-w-0 content-start gap-6 lg:order-2">
        <Card>
          <h2 className={sectionHeading}>Progress</h2>
          <div className="mt-3">
            <ProgressMeter id="inspection-progress" done={readiness.done} total={readiness.total} counts={readiness.counts} />
          </div>
          <SaveStatus state={save} dirty={dirty} onSave={() => void flush()} onReload={onReload} />
        </Card>
        {actions.complete || inspection.status === "SCHEDULED" ? (
          <CompleteCard
            org={org}
            user={user}
            inspection={inspection}
            readiness={readiness}
            draft={draft}
            canStart={actions.start}
            limits={options.limits}
            flush={flush}
            onCompleted={onReplace}
          />
        ) : null}
        {actions.cancel && <CancelCard org={org} inspection={inspection} onCancelled={onReplace} />}
      </div>

      <div className="grid min-w-0 content-start gap-6">
        <p className="text-sm text-muted">
          Choose a finding for every item: OK, Attention (needs attention), Damaged or N/A (not applicable). Changes are saved as you go.
          {actions.editChecklist && " Add, rename or remove areas and items to fit the property."}
        </p>
        <p aria-live="polite" className="sr-only">
          {announce}
        </p>
        {draft.length === 0 && <EmptyState title="The checklist is empty">Add an area below, then its items.</EmptyState>}
        {draft.map((area, index) => (
          <AreaEditor
            key={area.key}
            area={area}
            index={index}
            count={draft.length}
            draft={draft}
            itemCount={itemCount}
            limits={limits}
            canStructure={actions.editChecklist}
            canFindings={actions.recordFindings}
            canPhoto={actions.addPhoto}
            photoRules={options.photoRules}
            upload={(itemId, file, progress) => uploadItemPhoto(org, inspection.id, itemId, file, progress)}
            onChange={change}
            onAnnounce={setAnnounce}
            onAskRemove={(next) => {
              setPendingError(undefined);
              setPending(next);
            }}
            onPhotoAdded={addPhoto}
            onPhotosSent={photosSent}
          />
        ))}
        {actions.editChecklist && (
          <Card>
            <form onSubmit={submitArea} noValidate className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <Field id="new-area" label="Add an area" hint="A room or part of the property, for example “Garage”." error={newAreaProblem}>
                <Input
                  id="new-area"
                  value={newArea}
                  maxLength={limits.maxLabel}
                  autoComplete="off"
                  onChange={(event) => setNewArea(event.target.value)}
                  aria-invalid={Boolean(newAreaProblem)}
                  aria-describedby={fieldDescribedBy("new-area", { hint: "A room or part of the property, for example “Garage”.", error: newAreaProblem })}
                />
              </Field>
              <Button type="submit" variant="secondary">
                <Plus className="size-4" aria-hidden="true" />
                Add area
              </Button>
            </form>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={
          pending?.kind === "area" ? `Remove ${pending.name || "this area"}?` : pending?.kind === "item" ? `Remove ${pending.label || "this item"}?` : "Delete this photo?"
        }
        confirmLabel={pending?.kind === "photo" ? "Yes, delete it" : "Yes, remove it"}
        busyLabel="Deleting…"
        cancelLabel="Keep it"
        busy={pendingBusy}
        error={pendingError}
        onConfirm={() => void confirmPending()}
        onCancel={() => setPending(null)}
      >
        {pending?.kind === "area" &&
          (pending.items > 0
            ? `Its ${pending.items === 1 ? "item" : `${pending.items} items`}, with their findings, notes and photos, are removed when the change is saved.`
            : "The area is removed when the change is saved.")}
        {pending?.kind === "item" && "Its finding, note and photos are removed when the change is saved."}
        {pending?.kind === "photo" && `The photo of ${pending.label} is deleted now. This cannot be undone.`}
      </ConfirmDialog>
    </div>
  );
}

function SaveStatus({ state, dirty, onSave, onReload }: { state: SaveState; dirty: boolean; onSave: () => void; onReload: () => void }) {
  return (
    <div className="mt-4 grid gap-3">
      <p role="status" className="text-sm text-muted">
        {state.kind === "saving" && "Saving…"}
        {state.kind === "clean" && !dirty && (state.at ? `All changes saved at ${formatWhen(state.at)}.` : "All changes saved.")}
        {(state.kind === "dirty" || (state.kind === "clean" && dirty)) && "Changes not saved yet."}
        {state.kind === "invalid" && "Changes not saved: fix the checklist first."}
        {state.kind === "error" && "Changes not saved."}
      </p>
      {state.kind === "invalid" && (
        <ul role="alert" className="list-disc space-y-1 pl-5 text-sm text-danger">
          {state.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      {state.kind === "error" && (
        <Alert
          title={
            state.failure.code === "INSPECTION_CHANGED"
              ? "Someone else changed this inspection meanwhile."
              : state.failure.code === "INSPECTION_CLOSED"
                ? "This inspection was completed or cancelled meanwhile."
                : state.failure.message
          }
          traceId={state.failure.traceId}
        >
          {state.fatal
            ? "Reload it to see the latest version. Changes not saved here will be lost."
            : state.failure.code === "INSPECTION_CHANGED"
              ? "Save again to keep your changes, or reload it to see the latest version (changes not saved here will be lost)."
              : "Try again."}
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        {state.kind === "error" && (state.fatal || state.failure.code === "INSPECTION_CHANGED") && (
          <Button variant={state.fatal ? "secondary" : "ghost"} onClick={onReload}>
            Reload the inspection
          </Button>
        )}
        {state.kind === "error" && state.fatal ? null : (
          (dirty || state.kind === "error") && (
            <Button variant="secondary" onClick={onSave} disabled={state.kind === "saving"} aria-busy={state.kind === "saving"}>
              {state.kind === "saving" ? "Saving…" : "Save now"}
            </Button>
          )
        )}
      </div>
    </div>
  );
}

// ---- An area ---------------------------------------------------------------------------------------------

type Upload = (itemId: string, file: File, onProgress: (fraction: number) => void) => ReturnType<typeof uploadItemPhoto>;

function AreaEditor({
  area,
  index,
  count,
  draft,
  itemCount,
  limits,
  canStructure,
  canFindings,
  canPhoto,
  photoRules,
  upload,
  onChange,
  onAnnounce,
  onAskRemove,
  onPhotoAdded,
  onPhotosSent,
}: {
  area: ChecklistArea;
  index: number;
  count: number;
  draft: Checklist;
  itemCount: number;
  limits: InspectionOptions["limits"];
  canStructure: boolean;
  canFindings: boolean;
  canPhoto: boolean;
  photoRules: InspectionOptions["photoRules"];
  upload: Upload;
  onChange: (next: Checklist) => void;
  onAnnounce: (text: string) => void;
  onAskRemove: (pending: Pending) => void;
  onPhotoAdded: (areaKey: string, itemKey: string, photo: ItemPhoto) => void;
  onPhotosSent: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(area.name);
  const [nameProblem, setNameProblem] = useState<string | undefined>();
  const [newItem, setNewItem] = useState("");
  const [itemProblem, setItemProblem] = useState<string | undefined>();
  const headingId = `area-${area.key}`;
  const done = area.items.filter((item) => item.status).length;
  const others = draft.filter((other) => other.key !== area.key).map((other) => other.name);

  function saveName(event: FormEvent) {
    event.preventDefault();
    const problem = areaNameProblem(name, others);
    setNameProblem(problem ?? undefined);
    if (problem) return;
    onChange(renameArea(draft, area.key, name.trim()));
    setRenaming(false);
    onAnnounce(`Area renamed to ${name.trim()}.`);
  }

  function submitItem(event?: FormEvent) {
    event?.preventDefault();
    const problem =
      area.items.length >= limits.maxItemsPerArea
        ? `An area can have up to ${limits.maxItemsPerArea} items.`
        : itemCount >= limits.maxItems
          ? `A checklist can have up to ${limits.maxItems} items.`
          : itemLabelProblem(
              newItem,
              area.items.map((item) => item.label),
            );
    setItemProblem(problem ?? undefined);
    if (problem) return;
    onChange(addItem(draft, area.key, newItem));
    onAnnounce(`${newItem.trim()} added to ${area.name}.`);
    setNewItem("");
  }

  const newItemId = `new-item-${area.key}`;
  return (
    <Card>
      <section aria-labelledby={headingId}>
        {renaming ? (
          <form onSubmit={saveName} noValidate className="grid gap-3">
            <Field id={`rename-${area.key}`} label="Area name" error={nameProblem}>
              <Input
                id={`rename-${area.key}`}
                value={name}
                maxLength={limits.maxLabel}
                autoFocus
                onChange={(event) => setName(event.target.value)}
                aria-invalid={Boolean(nameProblem)}
                aria-describedby={fieldDescribedBy(`rename-${area.key}`, { error: nameProblem })}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="secondary">
                Save the name
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setRenaming(false);
                  setName(area.name);
                  setNameProblem(undefined);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 id={headingId} className={`${sectionHeading} break-words`}>
                {area.name || "Unnamed area"}
              </h2>
              <p className="text-sm text-muted tabular-nums">
                {done} of {area.items.length} checked
              </p>
            </div>
            {canStructure && (
              <div className="flex flex-wrap gap-1">
                <Button variant="ghost" className="w-11 px-0" aria-label={`Rename ${area.name}`} onClick={() => setRenaming(true)}>
                  <Pencil className="size-4" aria-hidden="true" />
                </Button>
                <Button variant="ghost" className="w-11 px-0" aria-label={`Move ${area.name} up`} disabled={index === 0} onClick={() => onChange(moveArea(draft, area.key, -1))}>
                  <ArrowUp className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  className="w-11 px-0"
                  aria-label={`Move ${area.name} down`}
                  disabled={index === count - 1}
                  onClick={() => onChange(moveArea(draft, area.key, 1))}
                >
                  <ArrowDown className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  className="w-11 px-0"
                  aria-label={`Remove area ${area.name}`}
                  onClick={() => onAskRemove({ kind: "area", areaKey: area.key, name: area.name, items: area.items.length })}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            )}
          </div>
        )}

        {area.items.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No items yet.{canStructure && " Add one below."}</p>
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-md border border-line">
            {area.items.map((item) => (
              <li key={item.key} id={`item-${item.key}`} className="scroll-mt-24 p-3">
                <ItemEditor
                  area={area}
                  item={item}
                  draft={draft}
                  limits={limits}
                  canStructure={canStructure}
                  canFindings={canFindings}
                  canPhoto={canPhoto}
                  photoRules={photoRules}
                  upload={upload}
                  onChange={onChange}
                  onAnnounce={onAnnounce}
                  onAskRemove={onAskRemove}
                  onPhotoAdded={onPhotoAdded}
                  onPhotosSent={onPhotosSent}
                />
              </li>
            ))}
          </ul>
        )}

        {canStructure && (
          <form onSubmit={submitItem} noValidate className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <Field id={newItemId} label={`Add an item to ${area.name || "this area"}`} error={itemProblem}>
              <Input
                id={newItemId}
                value={newItem}
                maxLength={limits.maxLabel}
                autoComplete="off"
                placeholder="For example: Light fittings"
                onChange={(event) => setNewItem(event.target.value)}
                onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                  if (event.key === "Enter") submitItem(event);
                }}
                aria-invalid={Boolean(itemProblem)}
                aria-describedby={fieldDescribedBy(newItemId, { error: itemProblem })}
              />
            </Field>
            <Button type="submit" variant="secondary">
              <Plus className="size-4" aria-hidden="true" />
              Add item
            </Button>
          </form>
        )}
      </section>
    </Card>
  );
}

// ---- An item ---------------------------------------------------------------------------------------------

const segment =
  "flex min-h-11 cursor-pointer items-center justify-center rounded-md px-2 text-center text-sm font-semibold text-ink hover:bg-sunken has-[:checked]:bg-primary has-[:checked]:text-on-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60";

function ItemEditor({
  area,
  item,
  draft,
  limits,
  canStructure,
  canFindings,
  canPhoto,
  photoRules,
  upload,
  onChange,
  onAnnounce,
  onAskRemove,
  onPhotoAdded,
  onPhotosSent,
}: {
  area: ChecklistArea;
  item: ChecklistItem;
  draft: Checklist;
  limits: InspectionOptions["limits"];
  canStructure: boolean;
  canFindings: boolean;
  canPhoto: boolean;
  photoRules: InspectionOptions["photoRules"];
  upload: Upload;
  onChange: (next: Checklist) => void;
  onAnnounce: (text: string) => void;
  onAskRemove: (pending: Pending) => void;
  onPhotoAdded: (areaKey: string, itemKey: string, photo: ItemPhoto) => void;
  onPhotosSent: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [label, setLabel] = useState(item.label);
  const [labelProblem, setLabelProblem] = useState<string | undefined>();
  const name = item.label || "Unnamed item";
  const noteId = `note-${item.key}`;
  const others = area.items.filter((other) => other.key !== item.key).map((other) => other.label);

  function saveLabel(event: FormEvent) {
    event.preventDefault();
    const problem = itemLabelProblem(label, others);
    setLabelProblem(problem ?? undefined);
    if (problem) return;
    onChange(updateItem(draft, area.key, item.key, { label: label.trim() }));
    setRenaming(false);
    onAnnounce(`Item renamed to ${label.trim()}.`);
  }

  function choose(status: FindingStatus | "") {
    onChange(updateItem(draft, area.key, item.key, { status }));
  }

  const noteHint = item.status === "ATTENTION" || item.status === "DAMAGED" ? "What is wrong, and where." : undefined;

  return (
    <div className="grid gap-3">
      {renaming ? (
        <form onSubmit={saveLabel} noValidate className="grid gap-2">
          <Field id={`rename-${item.key}`} label="Item name" error={labelProblem}>
            <Input
              id={`rename-${item.key}`}
              value={label}
              maxLength={limits.maxLabel}
              autoFocus
              onChange={(event) => setLabel(event.target.value)}
              aria-invalid={Boolean(labelProblem)}
              aria-describedby={fieldDescribedBy(`rename-${item.key}`, { error: labelProblem })}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="secondary">
              Save the name
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setRenaming(false);
                setLabel(item.label);
                setLabelProblem(undefined);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 pt-2 font-sans text-base font-semibold tracking-normal break-words text-ink">{name}</h3>
          {canStructure && (
            <div className="flex shrink-0 gap-1">
              <Button variant="ghost" className="w-11 px-0" aria-label={`Rename ${name}`} onClick={() => setRenaming(true)}>
                <Pencil className="size-4" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                className="w-11 px-0"
                aria-label={`Remove ${name} from ${area.name}`}
                onClick={() => onAskRemove({ kind: "item", areaKey: area.key, itemKey: item.key, label: name })}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>
      )}

      <BaselineLine baseline={item.baseline} />

      <fieldset className="min-w-0">
        <legend className="sr-only">
          Finding for {name}, {area.name}
        </legend>
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-line-strong bg-surface p-1 sm:grid-cols-4">
          {FINDING_STATUSES.map((status) => (
            <label key={status} className={segment} title={findingWords(status)}>
              <input
                type="radio"
                className="sr-only"
                name={`finding-${item.key}`}
                value={status}
                checked={item.status === status}
                disabled={!canFindings}
                onChange={() => choose(status)}
              />
              <span aria-hidden="true">{findingLabel(status)}</span>
              <span className="sr-only">{findingWords(status)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{item.status ? `Finding: ${findingWords(item.status)}` : "Not checked yet"}</p>
        {item.status && canFindings && (
          <Button variant="ghost" size="sm" onClick={() => choose("")}>
            Clear the finding
          </Button>
        )}
      </div>

      <Field id={noteId} label="Note" optional hint={noteHint}>
        <Textarea
          id={noteId}
          rows={2}
          value={item.note}
          maxLength={limits.maxNote}
          disabled={!canFindings}
          onChange={(event) => onChange(updateItem(draft, area.key, item.key, { note: event.target.value }))}
          aria-describedby={fieldDescribedBy(noteId, { hint: noteHint })}
        />
      </Field>

      <ItemPhotosEditor
        area={area}
        item={item}
        canPhoto={canPhoto}
        rules={photoRules}
        upload={upload}
        onAskRemove={onAskRemove}
        onPhotoAdded={onPhotoAdded}
        onPhotosSent={onPhotosSent}
      />
    </div>
  );
}

type Sending = { key: string; file: File; preview: string; progress: number; error: string | null };

/**
 * The item's photos, each with "Delete" (behind a confirmation), and "Add
 * photos": images only, previews made in the browser, each uploaded with
 * its progress, type and size problems in words. A new item gets photos
 * once it is saved (it needs its id).
 */
function ItemPhotosEditor({
  area,
  item,
  canPhoto,
  rules,
  upload,
  onAskRemove,
  onPhotoAdded,
  onPhotosSent,
}: {
  area: ChecklistArea;
  item: ChecklistItem;
  canPhoto: boolean;
  rules: InspectionOptions["photoRules"];
  upload: Upload;
  onAskRemove: (pending: Pending) => void;
  onPhotoAdded: (areaKey: string, itemKey: string, photo: ItemPhoto) => void;
  onPhotosSent: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [waiting, setWaiting] = useState<Sending[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const previews = useRef(new Set<string>());
  const next = useRef(0);
  const name = `${area.name} – ${item.label}`;
  const count = item.photos.length + waiting.length;
  const full = count >= rules.maxPhotos;
  const inputId = `photos-${item.key}`;

  // The previews' object URLs are released when the item goes away.
  useEffect(() => {
    const live = previews.current;
    return () => {
      for (const url of live) URL.revokeObjectURL(url);
      live.clear();
    };
  }, []);

  const forget = (key: string) =>
    setWaiting((current) => {
      const gone = current.find((photo) => photo.key === key);
      if (gone) {
        URL.revokeObjectURL(gone.preview);
        previews.current.delete(gone.preview);
      }
      return current.filter((photo) => photo.key !== key);
    });

  /** Checks the files, shows their previews, then sends them one after the other with their progress. */
  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    const itemId = item.id;
    if (files.length === 0 || !itemId) return;
    const sorted = sortInspectionPhotos(files, count, rules);
    setProblems(sorted.problems);
    if (sorted.accepted.length === 0) return;
    const made: Sending[] = sorted.accepted.map((file) => {
      const preview = URL.createObjectURL(file);
      previews.current.add(preview);
      next.current += 1;
      return { key: `${item.key}-photo-${next.current}`, file, preview, progress: 0, error: null };
    });
    setWaiting((current) => [...current, ...made]);
    setBusy(true);
    let sent = 0;
    for (const photo of made) {
      const answer = await upload(itemId, photo.file, (fraction) =>
        setWaiting((current) => current.map((other) => (other.key === photo.key ? { ...other, progress: fraction } : other))),
      );
      if (answer.ok) {
        sent += 1;
        if (answer.data) onPhotoAdded(area.key, item.key, answer.data);
        forget(photo.key);
      } else {
        setWaiting((current) => current.map((other) => (other.key === photo.key ? { ...other, error: answer.failure.message } : other)));
      }
    }
    setBusy(false);
    if (sent > 0) onPhotosSent();
  }

  if (item.photos.length === 0 && !canPhoto) return null;

  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-ink">
        Photos <span className="font-normal text-muted tabular-nums">({item.photos.length} of {rules.maxPhotos})</span>
      </p>
      {item.photos.length > 0 && (
        <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label={`Photos of ${name}`}>
          {item.photos.map((photo, index) => {
            const src = inspectionPhotoSrc(photo.url);
            return (
              <li key={photo.id} className="min-w-0 rounded-md border border-line bg-sunken p-1">
                {src ? <PrivateImage src={src} alt={`Photo ${index + 1} of ${name}`} className="aspect-[4/3] w-full" /> : <span className="block p-2 text-xs text-muted">Photo {index + 1}</span>}
                {canPhoto && photo.canDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 w-full"
                    aria-label={`Delete photo ${index + 1} of ${name}`}
                    onClick={() => onAskRemove({ kind: "photo", areaKey: area.key, itemKey: item.key, photoId: photo.id, label: name })}
                  >
                    <X className="size-4" aria-hidden="true" />
                    Delete
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {waiting.length > 0 && (
        <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label={`Photos being added to ${name}`}>
          {waiting.map((photo) => (
            <li key={photo.key} className="min-w-0 rounded-md border border-line bg-sunken p-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- a preview of a file on this device: there is nothing for next/image to optimise */}
              <img src={photo.preview} alt={`Preview of ${photo.file.name}`} className="aspect-[4/3] w-full rounded object-cover" />
              <p className="mt-1 text-xs break-all text-ink">{photo.file.name}</p>
              {!photo.error && (
                <>
                  <progress className="mt-1 h-2 w-full accent-primary" max={1} value={photo.progress} aria-label={`Uploading ${photo.file.name}`} />
                  <p className="text-xs text-muted tabular-nums">{Math.round(photo.progress * 100)}%</p>
                </>
              )}
              {photo.error && (
                <>
                  <p className="mt-1 text-xs text-danger">{photo.error}</p>
                  <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={() => forget(photo.key)} aria-label={`Remove ${photo.file.name}`}>
                    Remove
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {problems.length > 0 && (
        <ul role="alert" className="mt-2 list-disc space-y-1 pl-5 text-sm text-danger">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      {canPhoto &&
        (item.id ? (
          <>
            <input ref={input} id={inputId} type="file" accept={photoAccept(rules)} multiple className="sr-only" tabIndex={-1} onChange={(event) => void choose(event)} />
            <Button variant="secondary" size="sm" className="mt-2" onClick={() => input.current?.click()} disabled={full || busy} aria-busy={busy}>
              <ImagePlus className="size-4" aria-hidden="true" />
              {busy ? "Uploading…" : full ? "Photo limit reached" : "Add photos"}
              <span className="sr-only"> of {name}</span>
            </Button>
            <p className="mt-1 text-xs text-muted">
              {photoTypeWords(rules)}, up to {megabytes(rules.maxBytes)} each. Kept private; location and camera details are removed.
            </p>
          </>
        ) : (
          <p className="mt-1 text-xs text-muted">Photos can be added once this new item is saved (in a moment).</p>
        ))}
    </div>
  );
}

// ---- Complete ------------------------------------------------------------------------------------------

function CompleteCard({
  org,
  user,
  inspection,
  readiness,
  draft,
  canStart,
  limits,
  flush,
  onCompleted,
}: {
  org: string;
  user: User;
  inspection: Inspection;
  readiness: ReturnType<typeof completionReadiness>;
  draft: Checklist;
  canStart: boolean;
  limits: InspectionOptions["limits"];
  flush: () => Promise<boolean>;
  onCompleted: (inspection: Inspection) => void;
}) {
  const [form, setForm] = useState<CompleteForm>({ summary: "", agent: user.name, tenant: "" });
  const [problems, setProblems] = useState<CompleteProblems>({});
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [serverMissing, setServerMissing] = useState<Missing[] | null>(null);
  const missingRef = useRef<HTMLDivElement>(null);
  const set = (patch: Partial<CompleteForm>) => setForm((current) => ({ ...current, ...patch }));
  const missing = serverMissing ?? readiness.missing;
  const tenantLinked = Boolean(inspection.tenancy);

  async function ask(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    setServerMissing(null);
    const found = completeProblems(form);
    setProblems(found);
    if (found.summary || found.agent || found.tenant) return;
    if (!readiness.ready) {
      missingRef.current?.focus();
      return;
    }
    setBusy(true);
    const saved = await flush();
    setBusy(false);
    if (!saved) {
      setFailure({ code: "NOT_SAVED", status: 0, message: "The latest changes could not be saved. Save them first (see Progress)." });
      return;
    }
    setError(undefined);
    setOpen(true);
  }

  async function complete() {
    setBusy(true);
    setError(undefined);
    if (inspection.status === "SCHEDULED") {
      const started = await startInspection(org, inspection.id);
      if (!started.ok && started.failure.code !== "INSPECTION_INVALID_TRANSITION") {
        setBusy(false);
        setError(started.failure.message);
        return;
      }
    }
    const answer = await completeInspection(org, inspection.id, form);
    setBusy(false);
    if (!answer.ok) {
      if (answer.failure.code === "INSPECTION_INCOMPLETE") {
        const details = incompleteFromConflict(answer.failure.body);
        const ids = new Set(details?.itemIds ?? []);
        const named: Missing[] = [];
        for (const area of draft) for (const item of area.items) if (item.id && ids.has(item.id)) named.push({ areaKey: area.key, area: area.name, itemKey: item.key, item: item.label });
        setServerMissing(named.length ? named : null);
        setOpen(false);
        setFailure(answer.failure);
        return;
      }
      const fields = answer.failure.fields ?? {};
      if (fields.summary || fields.tenant_sign_off_name || fields.agent_sign_off_name) {
        setProblems({ summary: fields.summary, tenant: fields.tenant_sign_off_name, agent: fields.agent_sign_off_name });
        setOpen(false);
        return;
      }
      setError(answer.failure.message);
      return;
    }
    setOpen(false);
    const next = answer.data ?? (await getInspection(org, inspection.id).then((read) => (read.ok ? read.data : null)));
    if (next) onCompleted(next);
  }

  const summaryHint = `Optional. The overall condition, and anything agreed. ${form.summary.length} of ${limits.maxSummary} characters.`;
  const tenantHint = "Optional. The tenant types or says their name if they took part.";
  const agentHint = "The name of whoever inspected for the manager.";
  const errorItems = [
    problems.summary && { id: "complete-summary", text: `Summary: ${problems.summary}` },
    problems.agent && { id: "complete-agent", text: `Signed off for the manager by: ${problems.agent}` },
    problems.tenant && { id: "complete-tenant", text: `Tenant's name: ${problems.tenant}` },
  ].filter((item): item is { id: string; text: string } => Boolean(item));

  return (
    <Card>
      <h2 className={sectionHeading}>Complete inspection</h2>
      <p className="mt-2 text-sm text-muted">
        Completing <strong className="text-ink">freezes the inspection</strong>: the checklist, findings, notes and photos can no longer be changed.
        The report (PDF) is then ready to download{tenantLinked ? ", and the tenant can read it from their account and is told it is ready" : ""}.
      </p>

      <div ref={missingRef} tabIndex={-1} className="mt-3 outline-none" aria-live="polite">
        {missing.length > 0 ? (
          <Alert tone="warning" title={`${missing.length === 1 ? "1 item still needs" : `${missing.length} items still need`} a finding`}>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {missing.slice(0, 10).map((item) => (
                <li key={item.itemKey}>
                  <a href={`#item-${item.itemKey}`} className="font-medium text-primary-ink underline">
                    {item.area || "Unnamed area"}: {item.item || "Unnamed item"}
                  </a>
                </li>
              ))}
            </ul>
            {missing.length > 10 && <p className="mt-1">and {missing.length - 10} more.</p>}
          </Alert>
        ) : readiness.total === 0 ? (
          <Alert tone="warning" title="Add at least one item to the checklist first." />
        ) : (
          <p className="text-sm font-medium text-success">Every item has a finding.</p>
        )}
        {readiness.emptyAreas.length > 0 && (
          <p className="mt-2 text-xs text-muted">Areas with no items do not appear in the report: {readiness.emptyAreas.join(", ")}.</p>
        )}
      </div>

      <form onSubmit={ask} noValidate className="mt-4 grid gap-4">
        <ErrorSummary items={errorItems} />
        <Field id="complete-summary" label="Summary" hint={summaryHint} error={problems.summary}>
          <Textarea
            id="complete-summary"
            rows={4}
            value={form.summary}
            maxLength={limits.maxSummary}
            onChange={(event) => set({ summary: event.target.value })}
            aria-invalid={Boolean(problems.summary)}
            aria-describedby={fieldDescribedBy("complete-summary", { hint: summaryHint, error: problems.summary })}
          />
        </Field>
        <Field id="complete-agent" label="Signed off for the manager by" optional hint={agentHint} error={problems.agent}>
          <Input
            id="complete-agent"
            value={form.agent}
            maxLength={limits.maxSignOff}
            autoComplete="name"
            onChange={(event) => set({ agent: event.target.value })}
            aria-invalid={Boolean(problems.agent)}
            aria-describedby={fieldDescribedBy("complete-agent", { hint: agentHint, error: problems.agent })}
          />
        </Field>
        <Field id="complete-tenant" label="Tenant's name" optional hint={tenantHint} error={problems.tenant}>
          <Input
            id="complete-tenant"
            value={form.tenant}
            maxLength={limits.maxSignOff}
            autoComplete="off"
            onChange={(event) => set({ tenant: event.target.value })}
            aria-invalid={Boolean(problems.tenant)}
            aria-describedby={fieldDescribedBy("complete-tenant", { hint: tenantHint, error: problems.tenant })}
          />
        </Field>
        <Button type="submit" disabled={busy} aria-busy={busy && !open}>
          {busy && !open ? "Saving…" : "Complete inspection"}
        </Button>
        <div aria-live="polite">{failure && <Alert title={failure.message} traceId={failure.traceId} />}</div>
        {!canStart && inspection.status === "SCHEDULED" && <p className="text-xs text-muted">It starts when the first finding or photo is saved.</p>}
      </form>

      <ConfirmDialog
        open={open}
        tone="primary"
        title="Complete and freeze this inspection?"
        confirmLabel="Yes, complete it"
        busyLabel="Completing…"
        cancelLabel="Not yet"
        busy={busy}
        error={error}
        onConfirm={() => void complete()}
        onCancel={() => setOpen(false)}
      >
        {readiness.total} items at {inspectionPlace(inspection)}: {FINDING_STATUSES.map((status) => `${readiness.counts[status]} ${findingWords(status).toLowerCase()}`).join(", ")}. After this
        nothing on it can change.
      </ConfirmDialog>
    </Card>
  );
}

// ---- Cancel --------------------------------------------------------------------------------------------

function CancelCard({ org, inspection, onCancelled }: { org: string; inspection: Inspection; onCancelled: (inspection: Inspection) => void }) {
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | undefined>();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  function ask(event: FormEvent) {
    event.preventDefault();
    const found = cancelReasonProblem(reason);
    setProblem(found ?? undefined);
    if (found) return;
    setError(undefined);
    setOpen(true);
  }

  async function cancel() {
    setBusy(true);
    setError(undefined);
    const answer = await cancelInspection(org, inspection.id, reason);
    setBusy(false);
    if (!answer.ok) {
      if (answer.failure.fields?.reason) {
        setProblem(answer.failure.fields.reason);
        setOpen(false);
      }
      setError(answer.failure.message);
      return;
    }
    setOpen(false);
    const next = answer.data ?? (await getInspection(org, inspection.id).then((read) => (read.ok ? read.data : null)));
    if (next) onCancelled(next);
  }

  return (
    <Card>
      <h2 className={sectionHeading}>Cancel the inspection</h2>
      <form onSubmit={ask} noValidate className="mt-4 grid gap-4">
        <Field id="cancel-reason" label="Why is it cancelled?" error={problem}>
          <Textarea
            id="cancel-reason"
            rows={2}
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            aria-invalid={Boolean(problem)}
            aria-describedby={fieldDescribedBy("cancel-reason", { error: problem })}
          />
        </Field>
        <Button type="submit" variant="danger">
          Cancel the inspection
        </Button>
        {error && !open && <Alert title={error} />}
      </form>
      <ConfirmDialog
        open={open}
        title="Cancel this inspection?"
        confirmLabel="Yes, cancel it"
        busyLabel="Cancelling…"
        cancelLabel="Keep it"
        busy={busy}
        error={error}
        onConfirm={() => void cancel()}
        onCancel={() => setOpen(false)}
      >
        A cancelled inspection is frozen: its findings stay as they are and it cannot be completed. Schedule a new one if it is still needed.
      </ConfirmDialog>
    </Card>
  );
}

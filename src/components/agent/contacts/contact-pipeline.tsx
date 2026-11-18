"use client";

import { GripVertical } from "lucide-react";
import Link from "next/link";
import { useCallback, useState, type DragEvent } from "react";
import { ContactsShell, typeLabel, type ContactLabels } from "@/components/agent/contacts/shared";
import { LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { User } from "@/lib/api/auth";
import { listContacts, moveContactStage, type ContactSummary } from "@/lib/api/contacts";
import type { DashboardOrganisation } from "@/lib/api/dashboard";
import type { ApiResult } from "@/lib/api/http";
import { cn } from "@/lib/cn";
import {
  canWriteContacts,
  CONTACT_STAGES,
  contactFiltersSearch,
  contactHref,
  stageLabel,
  stageOptions,
  stageTone,
} from "@/lib/contacts";

/** How many cards each column shows; the rest are in the list. */
const COLUMN_SIZE = 50;

type Column = { stage: string; label: string; items: ContactSummary[]; total: number };
type Board = Column[];

function boardLoader(org: string, labels: ContactLabels) {
  return async (): Promise<ApiResult<Board>> => {
    const answers = await Promise.all(
      CONTACT_STAGES.map((stage) => listContacts(org, `?stage=${stage}&page=1&page_size=${COLUMN_SIZE}`)),
    );
    const failed = answers.find((answer) => !answer.ok);
    if (failed && !failed.ok) return failed;
    return {
      ok: true,
      status: 200,
      data: CONTACT_STAGES.map((stage, index) => {
        const answer = answers[index];
        const page = answer.ok ? answer.data : { items: [], total: 0 };
        return { stage, label: stageLabel(stage, labels.stages), items: page.items, total: page.total };
      }),
    };
  };
}

/** The board with one card moved to another column (the API has accepted the move). */
function moved(board: Board, id: string, to: string): Board {
  const card = board.flatMap((column) => column.items).find((item) => item.id === id);
  if (!card) return board;
  return board.map((column) => {
    const without = column.items.filter((item) => item.id !== id);
    const lost = without.length !== column.items.length;
    if (column.stage === to) return { ...column, items: [{ ...card, stage: to, stage_label: null }, ...without], total: column.total + (lost ? 0 : 1) };
    return lost ? { ...column, items: without, total: Math.max(0, column.total - 1) } : column;
  });
}

function Card({
  item,
  org,
  labels,
  user,
  writer,
  busy,
  onMove,
}: {
  item: ContactSummary;
  org: string;
  labels: ContactLabels;
  user: User;
  writer: boolean;
  busy: boolean;
  onMove: (item: ContactSummary, stage: string) => void;
}) {
  const selectId = `move-${item.id}`;
  return (
    <div
      draggable={writer && !busy}
      onDragStart={(event: DragEvent<HTMLDivElement>) => {
        event.dataTransfer.setData("text/plain", item.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      className={cn("rounded-md border border-line bg-surface p-3 shadow-xs", writer && "cursor-grab active:cursor-grabbing", busy && "opacity-60")}
      aria-busy={busy || undefined}
    >
      <div className="flex items-start gap-2">
        {writer && <GripVertical className="mt-0.5 hidden size-4 shrink-0 text-subtle md:block" aria-hidden="true" />}
        <div className="min-w-0 flex-1">
          <Link href={contactHref(item.id, org)} className="break-words font-medium text-primary-ink hover:underline">
            {item.name}
          </Link>
          <p className="mt-1 flex flex-wrap gap-1.5 text-sm text-muted">
            {item.type && <Badge>{typeLabel(labels, item.type, item.type_label)}</Badge>}
            {item.owner && <span>{item.owner.user_id === user.id ? "Yours" : item.owner.name}</span>}
          </p>
        </div>
      </div>
      {writer && (
        <div className="mt-2">
          <label htmlFor={selectId} className="text-sm font-medium text-ink">
            Move to…<span className="sr-only"> (stage for {item.name})</span>
          </label>
          {/* key: after a move the picker starts empty again. */}
          <SearchableSelect
            key={item.stage}
            id={selectId}
            className="mt-1"
            options={[{ value: "", label: "Choose a stage" }, ...stageOptions(labels.stages).filter((option) => option.value !== item.stage)]}
            value=""
            onValueChange={(stage) => stage && onMove(item, stage)}
            disabled={busy}
          />
        </div>
      )}
    </div>
  );
}

function PipelineBoard({ organisation, labels, user }: { organisation: DashboardOrganisation; labels: ContactLabels; user: User }) {
  const org = organisation.id;
  const writer = canWriteContacts(organisation.role);
  const load = useCallback(() => boardLoader(org, labels)(), [org, labels]);
  const { state, reload, replace } = useApi(load);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string; traceId?: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);

  if (state.status === "loading" && !state.previous) return <LoadingBlock label="Loading the pipeline" rows={3} />;
  if (state.status === "error") return <LoadError failure={state.failure} onRetry={reload} />;
  const board = state.status === "ready" ? state.data : state.previous!;

  async function move(item: ContactSummary, stage: string) {
    if (stage === item.stage || busy) return;
    setBusy(item.id);
    setMessage(null);
    const answer = await moveContactStage(org, item.id, stage);
    setBusy(null);
    const label = stageLabel(stage, labels.stages);
    if (answer.ok) {
      replace(moved(board, item.id, stage));
      setMessage({ tone: "success", text: `${item.name} moved to ${label}.` });
    } else {
      setMessage({ tone: "danger", text: `${item.name} could not be moved: ${answer.failure.message}`, traceId: answer.failure.traceId });
      if (answer.failure.status === 404 || answer.failure.status === 409) reload();
    }
  }

  function drop(event: DragEvent<HTMLElement>, stage: string) {
    event.preventDefault();
    setOver(null);
    const id = event.dataTransfer.getData("text/plain");
    const item = board.flatMap((column) => column.items).find((card) => card.id === id);
    if (item) move(item, stage);
  }

  return (
    <>
      <div aria-live="polite" className="mb-4 min-h-0">
        {message && <Alert tone={message.tone} title={message.text} traceId={message.traceId} />}
      </div>
      {writer && (
        <p className="mb-4 text-sm text-muted">
          Use “Move to…” on a card, or drag it to another column. The list has the same contacts with every filter.
        </p>
      )}
      <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {board.map((column) => (
          <li
            key={column.stage}
            aria-labelledby={`column-${column.stage}`}
            onDragOver={(event) => {
              if (!writer) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              if (over !== column.stage) setOver(column.stage);
            }}
            onDragLeave={() => setOver((current) => (current === column.stage ? null : current))}
            onDrop={(event) => writer && drop(event, column.stage)}
            className={cn(
              "flex min-w-0 flex-col rounded-lg border border-line bg-sunken p-3",
              over === column.stage && "border-primary bg-tint",
            )}
          >
            <h2 id={`column-${column.stage}`} className="flex items-center gap-2 font-sans text-base font-semibold tracking-normal">
              <Badge tone={stageTone(column.stage)}>{column.label}</Badge>
              <span className="text-sm font-normal tabular-nums text-muted">
                {column.total} <span className="sr-only">{column.total === 1 ? "contact" : "contacts"}</span>
              </span>
            </h2>
            {column.items.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Nobody at this stage.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {column.items.map((item) => (
                  <li key={item.id}>
                    <Card item={item} org={org} labels={labels} user={user} writer={writer} busy={busy === item.id} onMove={move} />
                  </li>
                ))}
              </ul>
            )}
            {column.total > column.items.length && (
              <Link
                href={`/agent/contacts${contactFiltersSearch({ stage: column.stage, page: 1 }, org)}`}
                className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-primary-ink hover:underline"
              >
                See all {column.total} in the list<span className="sr-only"> at {column.label}</span>
              </Link>
            )}
          </li>
        ))}
      </ol>
    </>
  );
}

/** `/agent/contacts/pipeline`: the contacts by stage. The list stays the primary accessible view. */
export function ContactPipeline({ labels }: { labels: ContactLabels }) {
  return (
    <ContactsShell
      path="/pipeline"
      section="pipeline"
      title="Pipeline"
      back={{ href: (org) => `/agent/contacts?org=${encodeURIComponent(org)}`, label: "Contacts" }}
      intro={<p>Every contact by lead stage. Each move is kept in the contact’s timeline.</p>}
    >
      {(organisation, user) => <PipelineBoard organisation={organisation} labels={labels} user={user} />}
    </ContactsShell>
  );
}

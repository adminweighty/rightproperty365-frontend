"use client";

import { Copy, Eye, Pencil, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import { RoleGate } from "@/components/admin/admin-gate";
import { LegalSourceNote } from "@/components/admin/legal-list";
import { DraftNotice, VersionBody } from "@/components/legal/version-body";
import { BackLink, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldDescribedBy, Input, Textarea } from "@/components/ui/field";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import { LEGAL_ADMIN_ROLES, type User } from "@/lib/api/auth";
import type { ApiFailure, ApiResult } from "@/lib/api/http";
import {
  adminCreateLegalVersion,
  adminDeleteLegalVersion,
  adminGetLegalVersion,
  adminPublishLegalVersion,
  adminRetireLegalVersion,
  adminUpdateLegalVersion,
  type AdminLegalVersion,
} from "@/lib/api/legal";
import { cn } from "@/lib/cn";
import {
  BODY_MAX,
  canEditVersion,
  canRetireVersion,
  formatUtc,
  LEGAL_KINDS,
  legalKindLabel,
  legalMarketScope,
  marketLabel,
  SUMMARY_MAX,
  toUtcInput,
  validateLegalDraft,
  versionStatusLabel,
  type LegalDraft,
  type LegalDraftErrors,
} from "@/lib/legal-versions";

const PATH = "/admin/legal";

type Props = {
  /** Absent for a new draft. */
  versionId?: string;
  /** Every country, by name (`GET /v1/countries`). Empty when it could not be loaded. */
  markets: SelectOption[];
};

type Loaded = { version: AdminLegalVersion | null; from: AdminLegalVersion | null };

const KIND_OPTIONS: SelectOption[] = LEGAL_KINDS.map((kind) => ({ value: kind, label: legalKindLabel(kind) }));

function toDraft(version: AdminLegalVersion | null, from: AdminLegalVersion | null, kind: string, market: string): LegalDraft {
  const source = version ?? from;
  return {
    kind: source?.kind ?? (LEGAL_KINDS.find((item) => item === kind) || "TERMS"),
    market: source?.market_code ?? market,
    // A copy gets a new version and date: those are unique and say when it takes effect.
    version: version?.version ?? "",
    effectiveFrom: version ? toUtcInput(version.effective_from) : "",
    body: source?.body_markdown ?? "",
    summary: version?.summary_of_changes ?? "",
    requiresReacceptance: version?.requires_reacceptance ?? false,
    // Defaults to true, as the API does: an administrator turns it off deliberately for a reviewed text.
    draftNotice: version?.draft_notice ?? true,
  };
}

/** The API's field errors under the form's names, and the message for the rest. */
function fromFailure(failure: ApiFailure): { errors: LegalDraftErrors; message: string | null } {
  if (failure.code === "LEGAL_VERSION_EXISTS") {
    return { errors: { version: "This document already has this version for this market. Use another." }, message: null };
  }
  const errors: LegalDraftErrors = {};
  for (const [key, text] of Object.entries(failure.fields ?? {})) {
    if (key in { kind: 1, market_code: 1, version: 1, effective_from: 1, body_markdown: 1, summary_of_changes: 1 }) {
      errors[key as keyof LegalDraftErrors] = text;
    }
  }
  return { errors, message: Object.keys(errors).length > 0 ? null : failure.message };
}

function Meta({ version, names }: { version: AdminLegalVersion; names: Record<string, string> }) {
  const label = versionStatusLabel(version);
  return (
    <div className="mt-3 space-y-2">
      <p className="flex flex-wrap items-center gap-2">
        <Badge tone={label.tone}>{label.label}</Badge>
        {version.draft_notice && <Badge tone="warning">DRAFT notice</Badge>}
        {version.requires_reacceptance && <Badge tone="info">Asks to accept again</Badge>}
      </p>
      {label.hint && <p className="text-sm text-muted">{label.hint}</p>}
      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
        <dt className="text-muted">Market</dt>
        <dd className="text-ink">{marketLabel(version.market_code, names)}</dd>
        <dt className="text-muted">Version</dt>
        <dd className="break-all font-mono text-ink">{version.version}</dd>
        <dt className="text-muted">Takes effect</dt>
        <dd className="text-ink">{formatUtc(version.effective_from)}</dd>
        <dt className="text-muted">Created</dt>
        <dd className="text-ink">
          {formatWhen(version.created_at)} by {version.created_by.name}
        </dd>
        {version.published_at && (
          <>
            <dt className="text-muted">Published</dt>
            <dd className="text-ink">
              {formatWhen(version.published_at)}
              {version.published_by && ` by ${version.published_by.name}`}
            </dd>
          </>
        )}
        {version.retired_at && (
          <>
            <dt className="text-muted">Retired</dt>
            <dd className="text-ink">{formatWhen(version.retired_at)}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

/** A PUBLISHED or RETIRED version, which never changes: its text, Retire, and "start a new version from this". */
function ReadOnly({
  version,
  mayChange,
  onChanged,
}: {
  version: AdminLegalVersion;
  mayChange: boolean;
  onChanged: (version: AdminLegalVersion) => void;
}) {
  const [retiring, setRetiring] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function retire() {
    setBusy(true);
    setError(undefined);
    const result = await adminRetireLegalVersion(version.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.failure.message);
      return;
    }
    setRetiring(false);
    onChanged(result.data.version);
  }

  return (
    <>
      {version.summary_of_changes && (
        <Card className="mt-6">
          <h2 className="font-sans text-base font-semibold tracking-normal">Summary of changes</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{version.summary_of_changes}</p>
        </Card>
      )}
      <Card className="mt-6">
        <h2 className="font-sans text-base font-semibold tracking-normal">Text</h2>
        {version.draft_notice && <DraftNotice className="mt-3" admin />}
        <VersionBody markdown={version.body_markdown ?? ""} className="mt-4" />
      </Card>
      {mayChange && (
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href={`${PATH}/new?from=${version.id}`} variant="secondary">
            <Copy className="size-4" aria-hidden="true" />
            Start a new version from this text
          </ButtonLink>
          {canRetireVersion(version.status) && (
            <Button variant="danger" onClick={() => setRetiring(true)}>
              Retire this version
            </Button>
          )}
        </div>
      )}
      <ConfirmDialog
        open={retiring}
        title={`Retire version ${version.version}?`}
        confirmLabel="Retire"
        busyLabel="Retiring…"
        busy={busy}
        error={error}
        onConfirm={retire}
        onCancel={() => setRetiring(false)}
      >
        <p>
          It stops being the current version. The newest other published version for this market takes its place, or the
          GLOBAL one if there is none. It stays in the history and cannot be published again.
        </p>
      </ConfirmDialog>
    </>
  );
}

function Form({
  user,
  initial,
  version,
  markets,
  onSaved,
}: {
  user: User;
  initial: LegalDraft;
  version: AdminLegalVersion | null;
  markets: SelectOption[];
  onSaved: (version: AdminLegalVersion) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [errors, setErrors] = useState<LegalDraftErrors>({});
  const [message, setMessage] = useState<{ text: string; traceId?: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<"publish" | "delete" | null>(null);
  const [dialogError, setDialogError] = useState<string | undefined>();

  const scope = legalMarketScope(user.platform_roles);
  const names = Object.fromEntries(markets.map((option) => [option.value, option.label]));
  const marketOptions: SelectOption[] = scope
    ? scope.map((code) => ({ value: code, label: names[code] ?? code, secondary: code }))
    : [{ value: "GLOBAL", label: "Every country (GLOBAL)" }, ...markets];
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const set = <K extends keyof LegalDraft>(key: K, value: LegalDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  /** Creates or saves the draft. The saved version, or null with the problems shown. */
  async function save(): Promise<AdminLegalVersion | null> {
    setMessage(null);
    setNotice(null);
    const { input, errors: found } = validateLegalDraft(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setTab("write");
      return null;
    }
    const result: ApiResult<{ version: AdminLegalVersion }> = version
      ? await adminUpdateLegalVersion(version.id, {
          version: input.version,
          effective_from: input.effective_from,
          body_markdown: input.body_markdown,
          summary_of_changes: input.summary_of_changes,
          requires_reacceptance: input.requires_reacceptance,
          draft_notice: input.draft_notice,
        })
      : await adminCreateLegalVersion(input);
    if (!result.ok) {
      const { errors: apiErrors, message: text } = fromFailure(result.failure);
      setErrors(apiErrors);
      if (text) setMessage({ text, traceId: result.failure.traceId });
      setTab("write");
      return null;
    }
    setSaved(draft);
    return result.data.version;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const result = await save();
    setBusy(false);
    if (!result) return;
    if (!version) {
      router.replace(`${PATH}/${result.id}`);
      return;
    }
    setNotice("Draft saved.");
    onSaved(result);
  }

  async function publish() {
    if (!version) return;
    setBusy(true);
    setDialogError(undefined);
    // Unsaved changes (the re-acceptance tick among them) are saved first: what is published is what is on screen.
    if (dirty) {
      const result = await save();
      if (!result) {
        setBusy(false);
        setDialog(null);
        return;
      }
    }
    const result = await adminPublishLegalVersion(version.id);
    setBusy(false);
    if (!result.ok) {
      setDialogError(result.failure.message);
      return;
    }
    setDialog(null);
    onSaved(result.data.version);
  }

  async function remove() {
    if (!version) return;
    setBusy(true);
    setDialogError(undefined);
    const result = await adminDeleteLegalVersion(version.id);
    setBusy(false);
    if (!result.ok) {
      setDialogError(result.failure.message);
      return;
    }
    router.push(PATH);
  }

  const tabClass = (active: boolean) =>
    cn(
      "inline-flex min-h-11 items-center gap-2 rounded-t-md border-b-2 px-4 text-sm font-semibold",
      active ? "border-primary text-primary-ink" : "border-transparent text-muted hover:text-ink",
    );

  return (
    <form noValidate onSubmit={submit} className="mt-8 space-y-6">
      {draft.draftNotice && <DraftNotice admin />}
      {message && <Alert title={message.text} traceId={message.traceId} />}
      {notice && <Alert tone="success" title={notice} />}

      <Card className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="legal-kind" label="Document" error={errors.kind} hint={version ? "Fixed once the draft exists." : undefined}>
            <SearchableSelect
              id="legal-kind"
              options={KIND_OPTIONS}
              value={draft.kind}
              disabled={Boolean(version)}
              onValueChange={(value) => set("kind", value)}
              aria-invalid={Boolean(errors.kind)}
              aria-describedby={fieldDescribedBy("legal-kind", { error: errors.kind, hint: version ? "x" : undefined })}
            />
          </Field>
          <Field
            id="legal-market"
            label="Market"
            error={errors.market_code}
            hint={version ? "Fixed once the draft exists." : "GLOBAL applies wherever a country has no version of its own."}
          >
            {marketOptions.length > 0 ? (
              <SearchableSelect
                id="legal-market"
                options={marketOptions}
                value={draft.market}
                disabled={Boolean(version)}
                onValueChange={(value) => set("market", value)}
                aria-invalid={Boolean(errors.market_code)}
                aria-describedby={fieldDescribedBy("legal-market", { error: errors.market_code, hint: "x" })}
              />
            ) : (
              <Input
                id="legal-market"
                value={draft.market}
                disabled={Boolean(version)}
                onChange={(event) => set("market", event.target.value.toUpperCase())}
                placeholder="GLOBAL or ZW"
                maxLength={6}
                autoComplete="off"
                aria-invalid={Boolean(errors.market_code)}
                aria-describedby={fieldDescribedBy("legal-market", { error: errors.market_code, hint: "x" })}
              />
            )}
          </Field>
          <Field id="legal-version" label="Version" error={errors.version} hint="Up to 32 characters, unique for this document and market. The date it takes effect works well: 2027-01-01.">
            <Input
              id="legal-version"
              value={draft.version}
              onChange={(event) => set("version", event.target.value)}
              maxLength={32}
              autoComplete="off"
              className="font-mono"
              aria-invalid={Boolean(errors.version)}
              aria-describedby={fieldDescribedBy("legal-version", { error: errors.version, hint: "x" })}
            />
          </Field>
          <Field id="legal-effective" label="Takes effect (UTC)" error={errors.effective_from} hint="May be in the future: it becomes current then.">
            <Input
              id="legal-effective"
              type="datetime-local"
              value={draft.effectiveFrom}
              onChange={(event) => set("effectiveFrom", event.target.value)}
              aria-invalid={Boolean(errors.effective_from)}
              aria-describedby={fieldDescribedBy("legal-effective", { error: errors.effective_from, hint: "x" })}
            />
          </Field>
        </div>
        <p className="text-sm text-muted">Language: English (en), the only language the API has today.</p>
      </Card>

      <Card padded={false}>
        <div role="tablist" aria-label="Text of the document" className="flex gap-1 border-b border-line px-3 pt-2">
          <button type="button" role="tab" id="legal-tab-write" aria-selected={tab === "write"} aria-controls="legal-panel" className={tabClass(tab === "write")} onClick={() => setTab("write")}>
            <Pencil className="size-4" aria-hidden="true" />
            Write
          </button>
          <button type="button" role="tab" id="legal-tab-preview" aria-selected={tab === "preview"} aria-controls="legal-panel" className={tabClass(tab === "preview")} onClick={() => setTab("preview")}>
            <Eye className="size-4" aria-hidden="true" />
            Preview
          </button>
        </div>
        <div id="legal-panel" role="tabpanel" aria-labelledby={tab === "write" ? "legal-tab-write" : "legal-tab-preview"} className="p-5">
          {tab === "write" ? (
            <Field
              id="legal-body"
              label="Text (Markdown)"
              error={errors.body_markdown}
              hint={`Markdown, no HTML. Leave a blank line between paragraphs. Up to ${BODY_MAX.toLocaleString("en-GB")} characters.`}
            >
              <Textarea
                id="legal-body"
                rows={18}
                value={draft.body}
                onChange={(event) => set("body", event.target.value)}
                className="font-mono text-sm"
                spellCheck
                aria-invalid={Boolean(errors.body_markdown)}
                aria-describedby={fieldDescribedBy("legal-body", { error: errors.body_markdown, hint: "x" })}
              />
            </Field>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted">
                Shown as plain text with its paragraphs: Markdown marks such as # and ** appear as typed.
              </p>
              {draft.draftNotice && <DraftNotice className="mb-4" />}
              <VersionBody markdown={draft.body} />
            </>
          )}
        </div>
      </Card>

      <Card className="space-y-5">
        <Field id="legal-summary" label="Summary of changes" optional error={errors.summary_of_changes} hint={`What changed since the last version, in plain words. People asked to accept again read it first. Up to ${SUMMARY_MAX} characters.`}>
          <Textarea
            id="legal-summary"
            rows={3}
            value={draft.summary}
            onChange={(event) => set("summary", event.target.value)}
            maxLength={SUMMARY_MAX}
            aria-invalid={Boolean(errors.summary_of_changes)}
            aria-describedby={fieldDescribedBy("legal-summary", { error: errors.summary_of_changes, hint: "x" })}
          />
        </Field>
        <ReacceptanceCheckbox id="legal-reaccept" checked={draft.requiresReacceptance} onChange={(value) => set("requiresReacceptance", value)} />
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 size-5 shrink-0 accent-primary"
            checked={draft.draftNotice}
            onChange={(event) => set("draftNotice", event.target.checked)}
            aria-describedby="legal-notice-hint"
          />
          <span>
            <span className="font-medium text-ink">Show the DRAFT notice with this text</span>
            <span id="legal-notice-hint" className="block text-sm text-muted">
              Leave this ticked for a placeholder or a text your lawyers have not reviewed. Untick it only for a reviewed text.
            </span>
          </span>
        </label>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy} aria-busy={busy || undefined}>
          {busy ? "Saving…" : version ? "Save the draft" : "Create the draft"}
        </Button>
        {version && (
          <>
            <Button variant="secondary" disabled={busy} onClick={() => setDialog("publish")}>
              Publish…
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setDialog("delete")}>
              <Trash2 className="size-4" aria-hidden="true" />
              Delete the draft
            </Button>
          </>
        )}
      </div>
      {version && dirty && <p className="text-sm text-muted">You have changes that are not saved. Publishing saves them first.</p>}

      <ConfirmDialog
        open={dialog === "publish"}
        title={`Publish ${legalKindLabel(draft.kind)} version ${draft.version || version?.version}?`}
        confirmLabel="Publish"
        busyLabel="Publishing…"
        tone="primary"
        busy={busy}
        error={dialogError}
        onConfirm={publish}
        onCancel={() => setDialog(null)}
      >
        <p>
          <strong className="text-ink">Once published, this version can never be changed or deleted.</strong> To change
          it later you publish a new version. It becomes current for {marketLabel(draft.market, names)} from{" "}
          {draft.effectiveFrom ? `${draft.effectiveFrom.replace("T", " ")} UTC` : "its effective date"}.
        </p>
        <div className="mt-4">
          <ReacceptanceCheckbox id="legal-reaccept-dialog" checked={draft.requiresReacceptance} onChange={(value) => set("requiresReacceptance", value)} />
        </div>
        {draft.draftNotice && <p className="mt-3 text-sm">It will be shown with the DRAFT notice.</p>}
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === "delete"}
        title="Delete this draft?"
        confirmLabel="Delete"
        busyLabel="Deleting…"
        busy={busy}
        error={dialogError}
        onConfirm={remove}
        onCancel={() => setDialog(null)}
      >
        <p>The draft and its text are removed. This cannot be undone.</p>
      </ConfirmDialog>
    </form>
  );
}

function ReacceptanceCheckbox({ id, checked, onChange }: { id: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        className="mt-1 size-5 shrink-0 accent-primary"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-describedby={`${id}-hint`}
      />
      <span>
        <span className="font-medium text-ink">Ask people to accept this version again</span>
        <span id={`${id}-hint`} className="block text-sm text-muted">
          When it becomes current, everyone signed in sees a note at the top of the site asking them to read and accept
          it. Nothing is blocked if they do not. Tick it for a significant change; leave it for corrections and wording.
        </span>
      </span>
    </label>
  );
}

function Editor({ user, versionId, markets }: Props & { user: User }) {
  const params = useSearchParams();
  const fromId = versionId ? null : params.get("from");
  const kind = (params.get("kind") ?? "").toUpperCase();
  const market = (params.get("market") ?? "").toUpperCase();
  const scope = legalMarketScope(user.platform_roles);
  const names = Object.fromEntries(markets.map((option) => [option.value, option.label]));

  const load = useCallback(async (): Promise<ApiResult<Loaded>> => {
    const id = versionId ?? fromId;
    if (!id) return { ok: true, status: 200, data: { version: null, from: null } };
    const result = await adminGetLegalVersion(id);
    if (!result.ok) return result;
    return { ok: true, status: 200, data: versionId ? { version: result.data.version, from: null } : { version: null, from: result.data.version } };
  }, [versionId, fromId]);
  const { state, reload, replace } = useApi(load);

  const version = state.status === "ready" ? state.data.version : null;
  const title = version ? `${version.title || legalKindLabel(version.kind)} ${version.version}` : "New draft";
  // A MARKET_ADMIN sees GLOBAL and other markets' versions but cannot change them.
  const mayChange = !version || !scope || scope.includes(version.market_code);
  const startMarket = market || (scope ? (scope[0] ?? "") : "GLOBAL");

  return (
    <>
      <BackLink href={PATH}>Legal documents</BackLink>
      <h1 className="mt-1 break-words text-4xl">{title}</h1>
      <LegalSourceNote />
      {state.status === "loading" && <div className="mt-8"><LoadingBlock label="Loading the version" rows={3} /></div>}
      {state.status === "error" && <div className="mt-8"><LoadError failure={state.failure} onRetry={reload} /></div>}
      {state.status === "ready" && (
        <>
          {version && <Meta version={version} names={names} />}
          {state.data.from && (
            <p className="mt-3 text-sm text-muted">
              Starts from the text of version <span className="font-mono">{state.data.from.version}</span> ({marketLabel(state.data.from.market_code, names)}).
              Give it a new version and date.
            </p>
          )}
          {version && !mayChange && (
            <Alert tone="info" title="You can read this version but not change it." className="mt-4">
              It belongs to {marketLabel(version.market_code, names)}; you manage {scope?.join(", ") || "no countries"}.
            </Alert>
          )}
          {version && (!canEditVersion(version.status) || !mayChange) ? (
            <ReadOnly
              version={version}
              mayChange={mayChange}
              onChanged={(next) => replace({ version: next, from: null })}
            />
          ) : (
            <Form
              key={version ? version.id : `new-${fromId ?? ""}`}
              user={user}
              version={version}
              markets={markets}
              initial={toDraft(version, state.data.from, kind, startMarket)}
              onSaved={(next) => replace({ version: next, from: null })}
            />
          )}
        </>
      )}
    </>
  );
}

/** `/admin/legal/new` and `/admin/legal/[id]`. */
export function LegalEditor(props: Props) {
  return (
    <RoleGate roles={LEGAL_ADMIN_ROLES} what="the legal documents">
      {(user) => <Editor user={user} {...props} />}
    </RoleGate>
  );
}

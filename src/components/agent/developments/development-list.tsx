"use client";

import { Building2, Camera, Layers, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback } from "react";
import { DeveloperShell, withOrg } from "@/components/agent/developments/developer-shell";
import { EmptyState, formatWhen, LoadError, LoadingBlock } from "@/components/portal/portal-ui";
import { useApi } from "@/components/portal/use-api";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import type { Membership } from "@/lib/api/auth";
import { listDevelopments } from "@/lib/api/developments";
import {
  developmentPlace,
  developmentStatusLabel,
  developmentStatusTone,
  moderationStatusLabel,
  moderationStatusTone,
} from "@/lib/developments";

function Projects({ membership }: { membership: Membership }) {
  const organisationId = membership.organisation_id;
  const load = useCallback(() => listDevelopments(organisationId), [organisationId]);
  const { state, reload } = useApi(load);
  const canCreate = membership.role !== "STAFF";

  return (
    <>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl">Development projects</h1>
          <p className="mt-2 max-w-2xl text-muted">
            The estates, cluster homes and apartment blocks {membership.organisation_name} is building or selling. A
            project is public once our team approves it, on its own page and on your developer profile.
          </p>
        </div>
        {canCreate && (
          <ButtonLink href={withOrg("/agent/developments/new", organisationId)}>
            <Plus className="size-4" aria-hidden="true" />
            New project
          </ButtonLink>
        )}
      </div>

      <div className="mt-8">
        {state.status === "loading" && <LoadingBlock label="Loading your projects" rows={3} />}
        {state.status === "error" && <LoadError failure={state.failure} onRetry={reload} />}
        {state.status === "ready" && state.data.items.length === 0 && (
          <EmptyState
            title="No projects yet"
            action={
              canCreate ? (
                <ButtonLink href={withOrg("/agent/developments/new", organisationId)}>Start your first project</ButtonLink>
              ) : undefined
            }
          >
            Add a project with its phases, unit types and prices, photos and a video, then submit it for review.
          </EmptyState>
        )}
        {state.status === "ready" && state.data.items.length > 0 && (
          <>
            <p className="text-sm text-muted" role="status">
              {state.data.items.length === 1 ? "1 project" : `${state.data.items.length} projects`}
            </p>
            <ul className="mt-4 space-y-3">
              {state.data.items.map((item) => {
                const unitTypes = item.phases.reduce((count, phase) => count + phase.unit_types.length, 0);
                const place = developmentPlace(item.location) || item.city_name || item.market.name;
                return (
                  <li key={item.id}>
                    <article className="group frame-brand relative rounded-lg border border-line bg-surface p-4 shadow-xs transition-shadow hover:shadow-md focus-within:shadow-md sm:p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={moderationStatusTone(item.moderation_status)}>{moderationStatusLabel(item.moderation_status)}</Badge>
                        <Badge tone={developmentStatusTone(item.status.code)}>{developmentStatusLabel(item.status)}</Badge>
                        <span className="ml-auto text-sm text-muted">Updated {formatWhen(item.updated_at)}</span>
                      </div>
                      <h2 className="mt-3 font-sans text-lg font-semibold tracking-normal">
                        <Link
                          href={withOrg(`/agent/developments/${item.id}`, organisationId)}
                          className="outline-none after:absolute after:inset-0 after:rounded-lg group-hover:underline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus"
                        >
                          {item.name || "Untitled project"}
                        </Link>
                      </h2>
                      <p className="mt-1 text-sm text-muted">{place}</p>
                      <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted">
                        <span className="flex items-center gap-1.5">
                          <Layers className="size-4" aria-hidden="true" />
                          {item.phases.length === 1 ? "1 phase" : `${item.phases.length} phases`},{" "}
                          {unitTypes === 1 ? "1 unit type" : `${unitTypes} unit types`}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Camera className="size-4" aria-hidden="true" />
                          {item.photos.length === 1 ? "1 photo" : `${item.photos.length} photos`}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Building2 className="size-4" aria-hidden="true" />
                          {item.linked_listings.length === 1 ? "1 linked listing" : `${item.linked_listings.length} linked listings`}
                        </span>
                      </p>
                      {item.moderation_status === "REJECTED" && item.review_reason && (
                        <p className="mt-3 rounded-md bg-danger-soft p-3 text-sm text-ink">
                          <span className="font-semibold text-danger">Not approved: </span>
                          {item.review_reason}
                        </p>
                      )}
                    </article>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </>
  );
}

/** `/agent/developments`: the organisation's projects. */
export function DevelopmentList() {
  return <DeveloperShell>{(membership) => <Projects key={membership.organisation_id} membership={membership} />}</DeveloperShell>;
}

"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { fieldSpec } from "@/components/onboarding/fields";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ApiFailure } from "@/lib/api/http";
import {
  listMyApplications,
  onboardingStatusLabel,
  onboardingStatusTones,
  roleToSlug,
  type OnboardingApplication,
  type OnboardingRequirements,
} from "@/lib/api/onboarding";

type Props = {
  /** What each role has to provide, from the API; used to name what is still missing. */
  requirements: OnboardingRequirements[];
};

type State =
  | { status: "loading" }
  | { status: "error"; failure: ApiFailure }
  | { status: "ready"; applications: OnboardingApplication[] };

/** A draft nobody has touched yet reads "Start"; one with anything in it reads "Continue". */
function isUntouched({ details, documents }: OnboardingApplication) {
  return documents.length === 0 && Object.values(details).every((value) => value === null || value.length === 0);
}

function actionFor(application: OnboardingApplication): { label: string; primary: boolean } {
  switch (application.status) {
    case "DRAFT":
      return { label: isUntouched(application) ? "Start" : "Continue", primary: true };
    case "CHANGES_REQUESTED":
      return { label: "Fix and resubmit", primary: true };
    case "REJECTED":
      return { label: "Apply again", primary: true };
    default:
      return { label: "View", primary: false };
  }
}

const listOf = (items: string[]) =>
  items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

function ApplicationCard({ application, requirement }: { application: OnboardingApplication; requirement?: OnboardingRequirements }) {
  const action = actionFor(application);
  const href = `/onboarding/${roleToSlug(application.role)}`;
  const missingFields = application.missing.fields.map((name) => fieldSpec(name).label.toLowerCase());
  const missingDocuments = application.missing.documents.map(
    (code) => requirement?.documents.find((item) => item.code === code)?.label.toLowerCase() ?? code,
  );
  const headingId = `application-${application.role}`;

  return (
    <li>
      <Card aria-labelledby={headingId} role="group">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={headingId} className="text-2xl">
            {application.role_label}
          </h2>
          <Badge tone={onboardingStatusTones[application.status]}>
            {onboardingStatusLabel(application)}
          </Badge>
        </div>

        <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
          {application.status === "DRAFT" && application.can_submit && (
            <p>Everything needed is there. Check it and submit it for review.</p>
          )}
          {application.can_edit && missingFields.length > 0 && (
            <p>
              <span className="font-medium text-ink">Details still needed:</span> {listOf(missingFields)}.
            </p>
          )}
          {application.can_edit && missingDocuments.length > 0 && (
            <p>
              <span className="font-medium text-ink">Documents still needed:</span> {listOf(missingDocuments)}.
            </p>
          )}
          {application.status === "SUBMITTED" && (
            <p>Our team is checking this application. We will email you the result. The role is not active yet.</p>
          )}
          {application.status === "APPROVED" && (
            <p>
              This role is active on your account.
              {application.profile && " Your public profile is live with a Verified badge."}
            </p>
          )}
          {(application.status === "CHANGES_REQUESTED" || application.status === "REJECTED") &&
            application.decision.reason && (
              <p>
                <span className="font-medium text-ink">
                  {application.status === "REJECTED" ? "Why it was not approved:" : "What our team asked for:"}
                </span>{" "}
                {application.decision.reason}
              </p>
            )}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <ButtonLink href={href} variant={action.primary ? "primary" : "secondary"}>
            {action.label}
            <span className="sr-only">: {application.role_label}</span>
          </ButtonLink>
          {application.status === "APPROVED" && application.profile && (
            <ButtonLink
              href={`/directory/${application.profile.kind}/${application.profile.slug}`}
              variant="secondary"
            >
              View your public profile
            </ButtonLink>
          )}
        </div>
      </Card>
    </li>
  );
}

function Applications({ requirements }: Props) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const welcome = useSearchParams().get("welcome") === "1";

  useEffect(() => {
    let cancelled = false;
    listMyApplications().then((result) => {
      if (cancelled) return;
      setState(
        result.ok
          ? { status: "ready", applications: result.data.applications }
          : { status: "error", failure: result.failure },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return (
    <>
      <h1 className="text-4xl">Complete your profile</h1>
      {welcome && (
        <Alert tone="success" title="Your email address is confirmed. You are signed in." className="mt-6" />
      )}
      <p className="mt-4 max-w-2xl leading-relaxed text-muted">
        Roles for listing or managing property, and for working at an agency, are confirmed after
        RightProperty365 has checked who you are. For each role, give us your details and attach
        the documents we ask for, then submit it for review. Until a role is approved it gives no
        extra access, and you can use your account to search and enquire as usual.
      </p>

      {state.status === "loading" && (
        <div aria-busy="true" aria-label="Loading your applications" className="mt-8 space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-40 rounded-lg bg-sunken" />
          ))}
        </div>
      )}

      {state.status === "error" && (
        <div className="mt-8">
          <Alert title={state.failure.message} traceId={state.failure.traceId} />
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => {
              setState({ status: "loading" });
              setAttempt((value) => value + 1);
            }}
          >
            Try again
          </Button>
        </div>
      )}

      {state.status === "ready" && state.applications.length === 0 && (
        <div className="mt-8 rounded-lg border border-dashed border-line-strong p-10 text-center">
          <h2 className="text-2xl">Nothing to complete</h2>
          <p className="mx-auto mt-2 max-w-md text-muted">
            Your account has no role that needs verification. You can search, save and enquire
            straight away.
          </p>
          <ButtonLink href="/account" variant="secondary" className="mt-6">
            Go to your account
          </ButtonLink>
        </div>
      )}

      {state.status === "ready" && state.applications.length > 0 && (
        <ul className="mt-8 space-y-5">
          {state.applications.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              requirement={requirements.find((item) => item.role === application.role)}
            />
          ))}
        </ul>
      )}
    </>
  );
}

/** The signed-in person's onboarding applications, one card per role. */
export function OnboardingHub(props: Props) {
  return <RequireAuth>{() => <Applications {...props} />}</RequireAuth>;
}

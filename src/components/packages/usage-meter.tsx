import { useId } from "react";
import { Badge } from "@/components/ui/badge";
import type { MarketUsage } from "@/lib/api/packages";
import { cn } from "@/lib/cn";
import { assignmentDates, formatUtcDay, usageBasisText, usageMeter } from "@/lib/packages";

const barTone = { success: "bg-success", warning: "bg-warning", danger: "bg-danger", neutral: "bg-line-strong" } as const;

/**
 * One market's package and usage: the package name, a used/limit meter with
 * its meaning as text (never the bar alone), what is left and, when the
 * account is at or over its limit, what that means in plain words.
 * `audience` changes "you" into "the advertiser" for administrators.
 */
export function UsageMeterView({
  usage,
  audience = "advertiser",
  headingLevel = 3,
  className,
}: {
  usage: MarketUsage;
  audience?: "advertiser" | "admin";
  headingLevel?: 2 | 3 | 4;
  className?: string;
}) {
  const meter = usageMeter(usage, audience);
  const explanation = meter.explanation;
  const Heading = `h${headingLevel}` as const;
  const id = useId();

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <Heading id={id} className="font-sans text-base font-semibold tracking-normal text-ink">
          {usage.market.name}
          <span className="font-normal text-muted">
            {" · "}
            {usage.package ? `${usage.package.name} package` : "No package"}
          </span>
        </Heading>
        <Badge tone={usage.basis === "ASSIGNED" ? "primary" : "neutral"}>
          {audience === "admin" && usage.basis === "ASSIGNED" ? "Assigned" : usageBasisText(usage.basis)}
        </Badge>
      </div>

      {meter.state === "unlimited" ? (
        <p className="mt-2 text-sm text-ink">{meter.usedText}. No listing limit applies in this country.</p>
      ) : (
        <>
          <div
            role="meter"
            aria-labelledby={id}
            aria-valuemin={0}
            aria-valuemax={usage.limit ?? 0}
            aria-valuenow={Math.min(usage.used, usage.limit ?? usage.used)}
            aria-valuetext={meter.accessibleText}
            className="mt-3 h-2.5 overflow-hidden rounded-full bg-sunken"
          >
            <div className={cn("h-full rounded-full", barTone[meter.tone])} style={{ width: `${meter.percent}%` }} />
          </div>
          <p className="mt-2 flex flex-wrap justify-between gap-x-3 text-sm">
            <span className="text-ink">{meter.usedText}</span>
            <span className={cn("font-medium", meter.tone === "danger" ? "text-danger" : meter.tone === "warning" ? "text-warning" : "text-muted")}>
              {meter.remainingText}
            </span>
          </p>
          {explanation && <p className="mt-2 text-sm leading-relaxed text-muted">{explanation}</p>}
        </>
      )}

      {usage.assignment && (
        <p className="mt-2 text-xs text-subtle">{assignmentDates(usage.assignment.starts_on, usage.assignment.ends_on)}</p>
      )}
      {usage.scheduled && (
        <p className="mt-1 text-xs text-subtle">
          From {formatUtcDay(usage.scheduled.starts_on)}: {usage.scheduled.package.name} ({usage.scheduled.package.listing_limit} active
          listings).
        </p>
      )}
    </div>
  );
}

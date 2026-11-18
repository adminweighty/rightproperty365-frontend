"use client";

import { Info } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { EmptyState, formatWhen } from "@/components/portal/portal-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, fieldDescribedBy, Input } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  breakdown,
  checkDates,
  columnLayout,
  dayLong,
  dayShort,
  DEVICE_LABELS,
  fillDays,
  formatCount,
  formatRate,
  funnel,
  niceScale,
  PERIOD_LABELS,
  PERIODS,
  seriesSummary,
  SOURCE_LABELS,
  yFor,
  type Period,
  type PeriodChoice,
  type PeriodErrors,
} from "@/lib/analytics/report";
import type { AnalyticsDay, AnalyticsReport, TopListing } from "@/lib/api/analytics";
import { cn } from "@/lib/cn";

/*
 * The pieces of the analytics pages (API 0.30.0), shared by the professional
 * pages and the administrators' page. Every figure comes from the API; the
 * page adds only rates it can name and the zero days the API left out.
 */

export const DEFINITIONS_PATH = "/analytics-definitions";

/** The viewer's local day, YYYY-MM-DD. Called in the browser only. */
export function localToday(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// ---- Period picker ---------------------------------------------------------------

/**
 * "Period" (a SearchableSelect of 24 hours, 7 days, 30 days or chosen
 * dates) and, for chosen dates, "First day" and "Last day". "Show" puts the
 * choice in the address, so it can be shared and survives a reload.
 */
export function PeriodPicker({
  choice,
  errors: urlErrors,
  onChoose,
  extra,
  idPrefix = "analytics",
}: {
  choice: PeriodChoice;
  errors?: PeriodErrors;
  onChoose: (choice: PeriodChoice) => void;
  /** More fields in the same form (the administrators' country). */
  extra?: ReactNode;
  idPrefix?: string;
}) {
  const [period, setPeriod] = useState<Period>(choice.period);
  const [errors, setErrors] = useState<PeriodErrors>({});
  const today = localToday();
  const shown = { ...urlErrors, ...errors };
  const fromId = `${idPrefix}-from`;
  const toId = `${idPrefix}-to`;

  // The address changed (back button): follow it.
  const [shownFor, setShownFor] = useState(choice.period);
  if (shownFor !== choice.period) {
    setShownFor(choice.period);
    setPeriod(choice.period);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (period !== "custom") {
      setErrors({});
      onChoose({ period });
      return;
    }
    const from = String(form.get("from") ?? "") || undefined;
    const to = String(form.get("to") ?? "") || undefined;
    const next = checkDates(from, to, today);
    setErrors(next);
    if (next.from || next.to) {
      document.getElementById(next.from ? fromId : toId)?.focus();
      return;
    }
    onChoose({ period, from, to });
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label="Period"
      className="grid gap-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1fr)_1fr_1fr_auto] lg:items-end"
    >
      <Field id={`${idPrefix}-period`} label="Period">
        <SearchableSelect
          id={`${idPrefix}-period`}
          name="period"
          options={PERIODS.map((value) => ({ value, label: PERIOD_LABELS[value] }))}
          value={period}
          onValueChange={(value) => setPeriod((PERIODS as readonly string[]).includes(value) ? (value as Period) : "30d")}
        />
      </Field>
      {period === "custom" && (
        <>
          <Field id={fromId} label="First day" error={shown.from}>
            <Input
              id={fromId}
              name="from"
              type="date"
              defaultValue={choice.from}
              max={today}
              aria-invalid={Boolean(shown.from)}
              aria-describedby={fieldDescribedBy(fromId, { error: shown.from })}
            />
          </Field>
          <Field id={toId} label="Last day" error={shown.to}>
            <Input
              id={toId}
              name="to"
              type="date"
              defaultValue={choice.to}
              max={today}
              aria-invalid={Boolean(shown.to)}
              aria-describedby={fieldDescribedBy(toId, { error: shown.to })}
            />
          </Field>
        </>
      )}
      {extra}
      <Button type="submit" className={period === "custom" || extra ? undefined : "lg:col-start-4"}>
        Show
      </Button>
    </form>
  );
}

// ---- Totals -----------------------------------------------------------------------

function Tile({ label, value, note }: { label: string; value: string | null; note?: string }) {
  return (
    <div className="flex h-full flex-col justify-between gap-2 rounded-lg border border-line bg-surface p-4 shadow-xs">
      <dt className="text-sm leading-snug text-muted">{label}</dt>
      <dd>
        {value === null ? (
          <span className="block text-base font-medium text-muted">No views yet</span>
        ) : (
          <span className="block text-3xl font-bold tabular-nums text-ink">{value}</span>
        )}
        {note && <span className="mt-1 block text-xs text-subtle">{note}</span>}
      </dd>
    </div>
  );
}

/** The totals of the period as tiles. Rates say "No views yet" rather than a number when there were no views. */
export function TotalsTiles({ report }: { report: AnalyticsReport }) {
  const { totals } = report;
  return (
    <dl aria-label="Totals" className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Tile label="Listing views" value={formatCount(totals.views)} />
      <Tile label="Unique views" value={formatCount(totals.unique_views)} note="Different visitors per listing per day" />
      <Tile label="Seen in lists" value={formatCount(totals.impressions)} note="Card impressions" />
      <Tile label="Contact clicks" value={formatCount(totals.contact_clicks)} />
      <Tile label="Saves" value={formatCount(totals.saves)} />
      <Tile label="Enquiries" value={formatCount(totals.enquiries)} />
      <Tile label="Enquiry conversion" value={formatRate(report.conversion)} note="Enquiries ÷ listing views" />
      <Tile label="Contact rate" value={formatRate(report.ctr)} note="Contact clicks ÷ listing views" />
      <Tile label="Video plays" value={formatCount(totals.video_plays)} />
      <Tile label="Viewing requests" value={formatCount(totals.viewing_requests)} />
      <Tile label="Viewings confirmed" value={formatCount(totals.appointments_confirmed)} />
      <Tile label="Relisted" value={formatCount(totals.relists)} />
    </dl>
  );
}

// ---- Daily views chart -------------------------------------------------------------

const CHART_HEIGHT = 200;
const AXIS_WIDTH = 40;
const AXIS_BOTTOM = 28;

/** The plot's width in CSS pixels, so text in the SVG is never stretched or shrunk. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

const views = (day: AnalyticsDay) => day.views ?? 0;
const unique = (day: AnalyticsDay) => day.unique_views ?? 0;

/**
 * Listing views per day as columns, one series in the primary colour, with a
 * one-line summary above it, a tooltip on hover and the same figures as a
 * table under it. The SVG is an image to assistive technology (its name is
 * the summary); the table is the accessible version.
 */
export function DailyViewsChart({ report }: { report: AnalyticsReport }) {
  const titleId = useId();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const days = fillDays(report.daily, report.from, report.to, (date) => ({ date }));
  const summary = seriesSummary(
    days.map((day) => ({ date: day.date, value: views(day) })),
    { one: "listing view", many: "listing views" },
  );
  const scale = niceScale(Math.max(0, ...days.map(views)));
  const plotWidth = Math.max(0, width - AXIS_WIDTH);
  const bars = columnLayout(days.map(views), { width: plotWidth, height: CHART_HEIGHT, max: scale.max, gap: days.length > 20 ? 2 : 6 });
  // Three day labels at most, so they never collide at 320px: first, middle, last.
  const labelled = new Set(days.length <= 3 ? days.map((_, index) => index) : [0, Math.floor((days.length - 1) / 2), days.length - 1]);
  const hovered = hover !== null ? days[hover] : null;

  return (
    <section aria-labelledby={titleId}>
      <Card>
        <h2 id={titleId} className="text-2xl">
          Listing views per day
        </h2>
        <p className="mt-1 text-ink">{summary}</p>
        {report.near_real_time && <p className="mt-1 text-sm text-muted">Near real time: these figures may still change.</p>}
        {days.length > 0 && (
          <figure className="mt-4">
            <div ref={ref} className="relative w-full">
              <p aria-hidden="true" className="h-5 text-sm text-muted">
                {hovered ? `${dayLong(hovered.date)}: ${formatCount(views(hovered))} views, ${formatCount(unique(hovered))} unique` : ""}
              </p>
              {width > 0 && (
                <svg
                  role="img"
                  aria-label={summary}
                  width={width}
                  height={CHART_HEIGHT + AXIS_BOTTOM + 8}
                  className="block overflow-visible"
                  onPointerLeave={() => setHover(null)}
                >
                  <g transform="translate(0 8)">
                    {scale.ticks.map((tick) => {
                      const y = yFor(tick, scale.max, CHART_HEIGHT);
                      return (
                        <g key={tick}>
                          <line x1={AXIS_WIDTH} x2={width} y1={y} y2={y} className="stroke-line" strokeWidth={1} />
                          <text x={AXIS_WIDTH - 8} y={y} dy="0.32em" textAnchor="end" className="fill-muted text-xs tabular-nums">
                            {formatCount(tick)}
                          </text>
                        </g>
                      );
                    })}
                    <g transform={`translate(${AXIS_WIDTH} 0)`}>
                      {bars.map((bar, index) => {
                        const slot = plotWidth / days.length;
                        return (
                          <g key={days[index].date}>
                            {bar.height > 0 && (
                              <path
                                d={roundedTop(bar.x, bar.y, bar.width, bar.height, Math.min(4, bar.width / 2))}
                                className={cn("fill-primary transition-opacity", hover !== null && hover !== index && "opacity-60")}
                              />
                            )}
                            {/* A hit area the full height of the plot, wider than thin bars. */}
                            <rect
                              x={index * slot}
                              y={0}
                              width={slot}
                              height={CHART_HEIGHT}
                              fill="transparent"
                              onPointerEnter={() => setHover(index)}
                              onPointerDown={() => setHover(index)}
                            />
                            {labelled.has(index) && (
                              <text
                                x={index * slot + slot / 2}
                                y={CHART_HEIGHT + 18}
                                textAnchor={index === 0 && days.length > 3 ? "start" : index === days.length - 1 && days.length > 3 ? "end" : "middle"}
                                className="fill-muted text-xs"
                              >
                                {dayShort(days[index].date)}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </g>
                    <line x1={AXIS_WIDTH} x2={width} y1={CHART_HEIGHT} y2={CHART_HEIGHT} className="stroke-line-strong" strokeWidth={1} />
                  </g>
                </svg>
              )}
            </div>
            <figcaption className="sr-only">{summary} The figures are in the table that follows.</figcaption>
          </figure>
        )}
        {days.length > 0 && (
          <details className="mt-4">
            <summary className="min-h-11 cursor-pointer content-center font-medium text-primary-ink">Show the figures as a table</summary>
            <div className="mt-2 max-h-96 overflow-auto">
              <table className="w-full min-w-72 text-left text-sm">
                <caption className="sr-only">Listing views and unique views per day</caption>
                <thead className="sticky top-0 border-b border-line bg-surface text-muted">
                  <tr>
                    <th scope="col" className="py-2 pr-4 font-medium">Day</th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">Views</th>
                    <th scope="col" className="py-2 text-right font-medium">Unique views</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {days.map((day) => (
                    <tr key={day.date}>
                      <th scope="row" className="py-2 pr-4 font-normal text-ink">{dayLong(day.date)}</th>
                      <td className="py-2 pr-4 text-right tabular-nums text-ink">{formatCount(views(day))}</td>
                      <td className="py-2 text-right tabular-nums text-muted">{formatCount(unique(day))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </Card>
    </section>
  );
}

/** A column with its top corners rounded and its foot square on the baseline. */
function roundedTop(x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.max(0, Math.min(radius, height));
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}

// ---- Funnel, sources and devices -------------------------------------------------

/** A labelled horizontal bar: the label and number are text, the bar only shows the size. */
function BarRow({ label, value, share, note }: { label: string; value: string; share: number; note?: string }) {
  return (
    <li>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <span className="text-ink">{label}</span>
        <span className="font-semibold tabular-nums text-ink">
          {value}
          {note && <span className="ml-2 text-sm font-normal text-muted">{note}</span>}
        </span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-sunken" aria-hidden="true">
        <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(share > 0 ? 1 : 0, Math.round(share * 100))}%` }} />
      </div>
    </li>
  );
}

/** Seen in lists, then listing views, contact clicks and enquiries, each with its rate from the step before. */
export function FunnelCard({ report }: { report: AnalyticsReport }) {
  const steps = funnel(report.totals);
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <Card className="h-full">
        <h2 id={id} className="text-2xl">
          From list to enquiry
        </h2>
        <p className="mt-1 text-sm text-muted">Each step&rsquo;s share is of the step before it. Steps are counted separately, not by following one visitor.</p>
        <ol className="mt-4 space-y-4">
          {steps.map((step, index) => {
            const share = formatRate(step.fromPrevious);
            return (
              <BarRow
                key={step.key}
                label={step.label}
                value={formatCount(step.value)}
                share={step.share}
                note={index === 0 ? undefined : share ? `${share} of ${steps[index - 1].label.toLowerCase()}` : undefined}
              />
            );
          })}
        </ol>
      </Card>
    </section>
  );
}

export function BreakdownCard({ title, intro, rows, labels }: { title: string; intro: string; rows: AnalyticsReport["sources"]; labels: Record<string, string> }) {
  const id = useId();
  const items = breakdown(rows, labels);
  return (
    <section aria-labelledby={id}>
      <Card className="h-full">
        <h2 id={id} className="text-2xl">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted">{intro}</p>
        {items.length === 0 ? (
          <p className="mt-4 text-muted">No listing views in this period.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {items.map((item) => (
              <BarRow key={item.key} label={item.label} value={formatCount(item.count)} share={item.share} note={formatRate(item.share) ?? undefined} />
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}

// ---- Top listings ----------------------------------------------------------------

export function TopListingsTable({ rows, hrefFor, showMarket }: { rows: TopListing[]; hrefFor?: (row: TopListing) => string | null; showMarket?: boolean }) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <Card>
        <h2 id={id} className="text-2xl">
          Top listings
        </h2>
        <p className="mt-1 text-sm text-muted">By listing views in this period.</p>
        {rows.length === 0 ? (
          <p className="mt-4 text-muted">No listing had a view in this period.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <caption className="sr-only">Top listings by listing views</caption>
              <thead className="border-b border-line text-muted">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">Listing</th>
                  {showMarket && <th scope="col" className="py-2 pr-4 font-medium">Country</th>}
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Views</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Unique</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Contact clicks</th>
                  <th scope="col" className="py-2 text-right font-medium">Enquiries</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((row) => {
                  const href = hrefFor?.(row) ?? null;
                  const name = row.title || (row.reference ? `Listing ${row.reference}` : "Untitled listing");
                  return (
                    <tr key={row.listing_id}>
                      <th scope="row" className="py-2 pr-4 font-normal">
                        {href ? (
                          <Link href={href} className="inline-flex min-h-11 items-center font-medium text-primary-ink hover:underline">
                            {name}
                          </Link>
                        ) : (
                          <span className="text-ink">{name}</span>
                        )}
                        {row.reference && <span className="block text-xs text-subtle">Reference {row.reference}</span>}
                      </th>
                      {showMarket && <td className="py-2 pr-4 text-muted">{row.market_code ?? ""}</td>}
                      <td className="py-2 pr-4 text-right font-semibold tabular-nums text-ink">{formatCount(row.views)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-muted">{formatCount(row.unique_views)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-muted">{formatCount(row.contact_clicks)}</td>
                      <td className="py-2 text-right tabular-nums text-muted">{formatCount(row.enquiries)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  );
}

// ---- About the figures -----------------------------------------------------------

/** When the figures were brought up to date, what was left out, and the link to how we count. */
export function ReportFooter({ report }: { report: AnalyticsReport }) {
  return (
    <div className="flex gap-3 rounded-lg border border-line bg-soft p-4 text-sm text-muted">
      <Info className="mt-0.5 size-4 shrink-0 text-primary-ink" aria-hidden="true" />
      <div className="space-y-1">
        <p>
          {report.refreshed_at ? <>Figures up to date at {formatWhen(report.refreshed_at)}.</> : "We could not tell when these figures were last brought up to date."}{" "}
          {report.near_real_time ? "The last 24 hours are counted as events arrive and may still change." : "Totals are brought up to date every 15 minutes; the last 3 days may still change."}
        </p>
        <p>
          Left out: {formatCount(report.filtered_bot_events)} {report.filtered_bot_events === 1 ? "event" : "events"} from bots and automated tools, and{" "}
          {formatCount(report.late_events_dropped)} {report.late_events_dropped === 1 ? "event" : "events"} that arrived more than 3 days late. Days are each
          country&rsquo;s local days. These are our own counts, not Google Analytics figures.
        </p>
        <p>
          <Link href={DEFINITIONS_PATH} className="font-medium text-primary-ink underline underline-offset-2 hover:no-underline">
            How we count
          </Link>
        </p>
      </div>
    </div>
  );
}

/** True when the period had nothing at all to show. */
export const isEmptyReport = (report: AnalyticsReport) =>
  Object.values(report.totals).every((value) => value === 0) && report.daily.every((day) => !day.views && !day.impressions);

export function NoViewsYet({ children }: { children?: ReactNode }) {
  return (
    <EmptyState title="No views yet" action={<Link href={DEFINITIONS_PATH} className="font-medium text-primary-ink underline underline-offset-2 hover:no-underline">How we count</Link>}>
      {children ?? "Nothing was counted in this period. Figures appear here once a published listing is seen in lists or opened."}
    </EmptyState>
  );
}

/** The whole report: totals, chart, funnel, sources and devices, and what is left out. */
export function ReportBody({ report, children }: { report: AnalyticsReport; children?: ReactNode }) {
  return (
    <div className="space-y-8">
      {report.from && report.to && (
        <p className="text-lg text-ink">
          {report.from === report.to ? dayLong(report.from) : `${dayLong(report.from)} to ${dayLong(report.to)}`}
        </p>
      )}
      {isEmptyReport(report) ? (
        <NoViewsYet />
      ) : (
        <>
          <TotalsTiles report={report} />
          <DailyViewsChart report={report} />
          <div className="grid gap-6 lg:grid-cols-2">
            <FunnelCard report={report} />
            <BreakdownCard
              title="Where views came from"
              intro="The kind of site a visitor arrived from. We keep only the kind, never the address."
              rows={report.sources}
              labels={SOURCE_LABELS}
            />
          </div>
          <BreakdownCard title="Devices" intro="Worked out from the width of the visitor's screen." rows={report.devices} labels={DEVICE_LABELS} />
          {children}
        </>
      )}
      <ReportFooter report={report} />
    </div>
  );
}

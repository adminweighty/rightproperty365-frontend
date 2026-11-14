import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type Props = {
  title: string;
  /** One sentence under the title. */
  note?: string;
  /** Where "View all" goes. Give `linkLabel` with it. */
  href?: string;
  linkLabel?: string;
  className?: string;
};

/**
 * The heading of a landing-page row: a short logo-colour rule, an `h2`, an
 * optional sentence, and an optional "View all" link at the right.
 */
export function SectionHeading({ title, note, href, linkLabel, className }: Props) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <span aria-hidden="true" className="rule-brand block w-12" />
        <h2 className="mt-4 text-2xl md:text-3xl">{title}</h2>
        {note && <p className="mt-2 max-w-xl text-muted">{note}</p>}
      </div>
      {href && linkLabel && (
        <Link
          href={href}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-semibold text-primary-ink hover:underline"
        >
          {linkLabel}
          <ArrowRight className="hidden size-4 sm:block" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

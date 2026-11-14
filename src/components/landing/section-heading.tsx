import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/cn";

type Props = {
  /** An id for the `h2`, when a section is labelled by it. */
  id?: string;
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
 * optional sentence, and an optional "View all" link at the right. It rises
 * in when it is scrolled to, and its rule is drawn from left to right.
 */
export function SectionHeading({ id, title, note, href, linkLabel, className }: Props) {
  return (
    <Reveal className={cn("flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <span aria-hidden="true" data-draw className="rule-brand block w-12" />
        <h2 id={id} className="mt-4 text-2xl md:text-3xl">
          {title}
        </h2>
        {note && <p className="mt-2 max-w-xl text-muted">{note}</p>}
      </div>
      {href && linkLabel && (
        <Link
          href={href}
          className="group inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-semibold text-primary-ink"
        >
          <span className="link-sweep pb-0.5">{linkLabel}</span>
          <ArrowRight
            className="hidden size-4 transition-transform duration-200 ease-standard motion-safe:group-hover:translate-x-1 sm:block"
            aria-hidden="true"
          />
        </Link>
      )}
    </Reveal>
  );
}

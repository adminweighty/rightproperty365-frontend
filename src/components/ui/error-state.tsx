import type { ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Props = {
  /** What could not be loaded, as a full sentence: "We could not load the listings." */
  title: string;
  /** The address to load again, normally the page the visitor is on. */
  retryHref: string;
  /** Extra detail under the title. A sensible default is shown without it. */
  children?: ReactNode;
  className?: string;
};

/**
 * Shown in place of content when the RightProperty365 API cannot be reached
 * or returns an error. It never shows old or sample content in its place.
 * "Try again" is a plain link, so it works without JavaScript and makes a
 * fresh request to the server.
 */
export function ErrorState({ title, retryHref, children, className }: Props) {
  return (
    <div className={cn("rounded-lg border border-line bg-surface p-6", className)}>
      <Alert title={title}>
        {children ?? "Our service did not respond. Nothing is wrong on your side. Please try again in a moment."}
      </Alert>
      <a href={retryHref} className={buttonClasses("secondary", "md", "mt-4")}>
        Try again
      </a>
    </div>
  );
}

import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import { bodyParagraphs } from "@/lib/legal-versions";

/**
 * A legal version's `body_markdown`, shown as the text it is: paragraphs
 * split on blank lines, line breaks kept. The site has no Markdown renderer
 * and adds none, so headings and emphasis show as their Markdown marks.
 * React escapes every character, so nothing in the body is ever read as HTML.
 */
export function VersionBody({ markdown, className }: { markdown: string; className?: string }) {
  const paragraphs = bodyParagraphs(markdown);
  if (paragraphs.length === 0) return <p className={cn("text-muted", className)}>This version has no text yet.</p>;
  return (
    <div className={cn("space-y-4 break-words font-mono text-sm leading-relaxed text-ink", className)}>
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="whitespace-pre-wrap">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

/** The visible DRAFT notice a version with `draft_notice: true` must carry. */
export function DraftNotice({ className, admin = false }: { className?: string; admin?: boolean }) {
  return (
    <div role="note" className={cn("flex items-start gap-3 rounded-md border border-warning bg-warning-soft p-3 text-sm", className)}>
      <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
      <p className="leading-relaxed text-ink">
        <strong className="font-semibold text-warning">DRAFT — not reviewed.</strong>{" "}
        {admin
          ? "This version is marked as a placeholder or unreviewed text, and is shown with a DRAFT notice wherever it appears. Untick “Show the DRAFT notice” only for a text your lawyers have reviewed."
          : "This text is a placeholder awaiting legal review and is not legal advice."}
      </p>
    </div>
  );
}

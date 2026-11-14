import Link from "next/link";
import type { ReactNode } from "react";
import { legalDocument, type LegalDocumentKey } from "@/lib/legal";

/**
 * A link to a legal document from inside a form or a consent line. It opens
 * in a new tab, so what has been typed into the form is not lost, and says so
 * to screen readers.
 */
export function LegalLink({ to, children }: { to: LegalDocumentKey; children?: ReactNode }) {
  const document = legalDocument(to);
  return (
    <Link
      href={document.path}
      target="_blank"
      rel="noopener"
      className="font-medium text-primary-ink underline underline-offset-2 hover:no-underline"
    >
      {children ?? document.title}
      <span className="sr-only"> (opens in a new tab)</span>
    </Link>
  );
}

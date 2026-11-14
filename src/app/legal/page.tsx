import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { LEGAL_INDEX_PATH, formatLegalDate, legal, legalDocuments } from "@/lib/legal";

const title = "Legal";
const description =
  "The RightProperty365 Privacy Policy, Terms and Conditions, Refund Policy and End User Licence Agreement, in plain English.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: LEGAL_INDEX_PATH },
  openGraph: { type: "website", title, description, url: LEGAL_INDEX_PATH, images: ["/opengraph-image"] },
};

/** The four legal documents, each with one sentence on what it covers. */
export default function LegalIndexPage() {
  return (
    <Container className="py-10 md:py-14">
      <div className="rule-brand w-12" aria-hidden="true" />
      <h1 className="mt-4 text-3xl md:text-4xl">Legal</h1>
      <p className="mt-3 max-w-prose leading-relaxed text-muted">
        These documents set out how {legal.tradingName} works, what we ask of the people who use it, and how we
        look after personal information. Each starts with a short summary.
      </p>

      <ul className="mt-8 grid gap-5 sm:grid-cols-2">
        {legalDocuments.map((document) => (
          <li key={document.key}>
            <Link
              href={document.path}
              className="group frame-brand flex h-full flex-col rounded-lg border border-line bg-surface p-6 shadow-xs transition-shadow hover:shadow-md"
            >
              <h2 className="text-xl group-hover:underline">{document.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{document.description}</p>
              <p className="mt-3 text-sm text-subtle">
                Last updated <time dateTime={document.effectiveDate}>{formatLegalDate(document.effectiveDate)}</time>
              </p>
              <span className="mt-auto flex items-center gap-1.5 pt-4 text-sm font-semibold text-primary-ink">
                Read
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-8 max-w-prose leading-relaxed text-muted">
        Questions about any of them can be sent to{" "}
        <a href={`mailto:${legal.emails.legal}`} className="font-medium text-primary-ink underline underline-offset-2 hover:no-underline">
          {legal.emails.legal}
        </a>
        .
      </p>
    </Container>
  );
}

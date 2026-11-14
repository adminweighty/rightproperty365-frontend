import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import {
  LEGAL_INDEX_PATH,
  formatLegalDate,
  legal,
  legalDocument,
  legalDocuments,
  type LegalDocumentKey,
} from "@/lib/legal";

export type LegalSection = {
  /** The anchor of the section. Stable: other pages and the mobile apps may link to it. */
  id: string;
  /** Sentence case, without its number. */
  title: string;
  body: ReactNode;
};

export type LegalContent = {
  /** Two to five plain sentences: what the document says, for someone who reads nothing else. */
  summary: ReactNode[];
  sections: LegalSection[];
};

type EmailKey = keyof typeof legal.emails;

/** A contact address from the config, as a mail link. */
export function Email({ to }: { to: EmailKey }) {
  const address = legal.emails[to];
  return <a href={`mailto:${address}`}>{address}</a>;
}

/** A link to another legal document by its title, or to one of its sections. */
export function DocLink({ to, section, children }: { to: LegalDocumentKey; section?: string; children?: ReactNode }) {
  const document = legalDocument(to);
  return <Link href={section ? `${document.path}#${section}` : document.path}>{children ?? document.title}</Link>;
}

// Typography of the running text. Links are underlined, so they are not shown by colour alone.
const prose =
  "text-base leading-relaxed text-ink [&_p]:mt-4 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-6 " +
  "[&_li]:mt-2 [&_li]:pl-1 [&_h3]:mt-8 [&_h3]:font-sans [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:tracking-normal " +
  "[&_a]:font-medium [&_a]:text-primary-ink [&_a]:underline [&_a]:underline-offset-2 [&_a]:wrap-anywhere hover:[&_a]:no-underline";

type Props = { document: LegalDocumentKey; content: LegalContent };

/**
 * The layout of a legal document: breadcrumb, title, when it was last
 * updated, an "In short" summary, a table of contents, numbered sections
 * with stable anchors, how to reach us, and the other documents.
 *
 * It renders on the server from `src/lib/legal.ts` and the document's
 * content, with no API call and no client code, so the whole text is in the
 * HTML. Specification: design/components/README.md, "LegalDocument".
 */
export function LegalDocument({ document: key, content }: Props) {
  const info = legalDocument(key);
  const others = legalDocuments.filter((item) => item.key !== key);
  const contacts: { label: string; to: EmailKey }[] = [
    { label: "Privacy and your personal information", to: "privacy" },
    { label: "These documents and legal notices", to: "legal" },
    { label: "Invoices, payments and refunds", to: "billing" },
    { label: "Help with your account or the service", to: "support" },
  ];
  const sections = [
    ...content.sections,
    {
      id: "questions",
      title: "Questions",
      body: (
        <>
          <p>
            If anything in this document is unclear, or you want to use a right it gives you, write to us. Tell us
            the email address of your account so we can find it.
          </p>
          <ul>
            {contacts.map((contact) => (
              <li key={contact.to}>
                {contact.label}: <Email to={contact.to} />
              </li>
            ))}
          </ul>
          {(legal.legalEntity || legal.registeredAddress) && (
            <p>
              {legal.legalEntity ?? legal.tradingName}
              {legal.registrationNumber && `, registration number ${legal.registrationNumber}`}
              {legal.registeredAddress && `, ${legal.registeredAddress}`}.
            </p>
          )}
        </>
      ),
    },
  ];

  return (
    <Container className="py-10 md:py-14 print:py-0">
      <nav aria-label="Breadcrumb" className="print:hidden">
        <ol className="flex flex-wrap items-center gap-x-1 text-sm text-muted">
          <li className="flex items-center gap-1">
            <Link href="/" className="flex min-h-11 items-center hover:text-primary-ink hover:underline">
              Home
            </Link>
            <ChevronRight className="size-4" aria-hidden="true" />
          </li>
          <li className="flex items-center gap-1">
            <Link href={LEGAL_INDEX_PATH} className="flex min-h-11 items-center hover:text-primary-ink hover:underline">
              Legal
            </Link>
            <ChevronRight className="size-4" aria-hidden="true" />
          </li>
          <li aria-current="page" className="text-ink">
            {info.title}
          </li>
        </ol>
      </nav>

      <div className="mt-4 grid gap-x-12 gap-y-8 lg:grid-cols-[17rem_minmax(0,1fr)] print:block">
        <header className="lg:col-span-2">
          <div className="rule-brand w-12" aria-hidden="true" />
          <h1 className="mt-4 text-3xl md:text-4xl">{info.title}</h1>
          <p className="mt-3 text-sm text-muted">
            Last updated <time dateTime={info.effectiveDate}>{formatLegalDate(info.effectiveDate)}</time>
            <span aria-hidden="true"> · </span>
            <span>Version {info.version}</span>
          </p>
        </header>

        <nav
          aria-label="Contents"
          className="self-start rounded-lg border border-line bg-surface p-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto print:hidden"
        >
          <h2 className="font-sans text-sm font-semibold tracking-normal text-ink">Contents</h2>
          <ol className="mt-1">
            {sections.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="flex min-h-11 items-center gap-2 text-sm text-muted hover:text-primary-ink hover:underline lg:min-h-9"
                >
                  <span className="w-5 shrink-0 tabular-nums text-subtle">{index + 1}.</span>
                  <span>{section.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="min-w-0 max-w-prose [&>section+section]:mt-2">
          <section aria-labelledby="in-short" className="rounded-lg border border-line bg-soft p-5 print:border-0 print:p-0">
            <h2 id="in-short" className="font-sans text-lg font-semibold tracking-normal text-ink">
              In short
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-relaxed text-ink">
              {content.summary.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-muted">This summary is a guide. The full text below is what applies.</p>
          </section>

          {sections.map((section, index) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-2 pt-8 print:pt-6">
              <h2 id={`${section.id}-title`} className="text-2xl print:break-after-avoid">
                <span className="tabular-nums">{index + 1}.</span> {section.title}
              </h2>
              <div className={prose}>{section.body}</div>
            </section>
          ))}

          <nav aria-label="Other legal documents" className="mt-12 border-t border-line pt-6 print:hidden">
            <h2 className="font-sans text-lg font-semibold tracking-normal text-ink">Other documents</h2>
            <ul className="mt-2">
              {others.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.path}
                    className="flex min-h-11 items-center font-medium text-primary-ink underline underline-offset-2 hover:no-underline"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </article>
      </div>
    </Container>
  );
}

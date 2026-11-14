import type { Metadata } from "next";
import { Reveal } from "@/components/motion/reveal";
import { FaqList } from "@/components/faq/faq-list";
import { JsonLd } from "@/components/seo/json-ld";
import { Container } from "@/components/ui/container";
import { faqCategories } from "@/lib/faq";
import { legal } from "@/lib/legal";
import { faqJsonLd } from "@/lib/seo";

const title = "Frequently asked questions";
const description =
  "How RightProperty365 works: searching for property, contacting agents and owners, viewings and short stays, accounts, joining as a professional, safety and privacy.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/faq" },
  openGraph: { type: "website", title, description, url: "/faq", images: ["/opengraph-image"] },
};

/** The questions people ask about the site and its services. Static: the content is `src/lib/faq.ts`. */
export default function FaqPage() {
  const support = legal.emails.support;
  return (
    <Container className="py-10 md:py-14">
      <JsonLd data={faqJsonLd(faqCategories)} />
      <div className="enter-rise">
      <div className="rule-brand w-12" aria-hidden="true" />
      <h1 className="mt-4 text-3xl md:text-4xl">Frequently asked questions</h1>
      <p className="mt-3 max-w-prose leading-relaxed text-muted">
        What {legal.tradingName} is, how to find a property, how to reach an agent, an owner or a business, and
        how to join as a professional.
      </p>
      </div>

      <div className="mt-8 grid gap-x-12 gap-y-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <nav
          aria-label="Question topics"
          className="self-start rounded-lg border border-line bg-surface p-4 lg:sticky lg:top-24 print:hidden"
        >
          <h2 className="font-sans text-sm font-semibold tracking-normal text-ink">Topics</h2>
          <ul className="mt-1">
            {faqCategories.map((category) => (
              <li key={category.id}>
                <a
                  href={`#${category.id}`}
                  className="flex min-h-11 items-center justify-between gap-3 text-sm text-muted hover:text-primary-ink hover:underline lg:min-h-9"
                >
                  <span>{category.title}</span>
                  <span className="tabular-nums text-subtle">
                    {category.questions.length}
                    <span className="sr-only"> {category.questions.length === 1 ? "question" : "questions"}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0">
          <FaqList categories={faqCategories} supportEmail={support} />

          <Reveal as="section" aria-labelledby="still-need-help" className="mt-12 rounded-lg border border-line bg-soft p-6">
            <h2 id="still-need-help" className="text-xl">
              Still need help?
            </h2>
            <p className="mt-2 max-w-prose leading-relaxed text-ink">
              Write to{" "}
              <a href={`mailto:${support}`} className="font-medium text-primary-ink underline underline-offset-2 hover:no-underline">
                {support}
              </a>
              . Tell us the email address of your account and any reference you were given, and we will get back to
              you.
            </p>
          </Reveal>
        </div>
      </div>
    </Container>
  );
}

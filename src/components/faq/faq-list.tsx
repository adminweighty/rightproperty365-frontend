"use client";

import { ChevronDown, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import { AppLinks } from "@/components/layout/app-links";
import { Input } from "@/components/ui/field";
import { faqAnswerText, type FaqBlock, type FaqCategory, type FaqInline } from "@/lib/faq";
import { normalise } from "@/lib/searchable-select";

type Props = {
  categories: FaqCategory[];
  /** Where "No questions match" sends people. */
  supportEmail: string;
};

const noop = () => () => {};
const linkClass = "font-medium text-primary-ink underline underline-offset-2 hover:no-underline wrap-anywhere";

function Inline({ content }: { content: FaqInline[] }) {
  return content.map((part, index) => {
    if (typeof part === "string") return part;
    if (part.href.startsWith("/")) {
      return (
        <Link key={index} href={part.href} className={linkClass}>
          {part.text}
        </Link>
      );
    }
    // Same-page anchors and mail links are ordinary links.
    return (
      <a key={index} href={part.href} className={linkClass}>
        {part.text}
      </a>
    );
  });
}

/** An answer's blocks as elements. */
export function FaqAnswer({ answer }: { answer: FaqBlock[] }) {
  return answer.map((block, index) => {
    if (block.type === "paragraph") {
      return (
        <p key={index} className="mt-3 first:mt-0">
          <Inline content={block.content} />
        </p>
      );
    }
    if (block.type === "list") {
      return (
        <ul key={index} className="mt-3 list-disc space-y-1.5 pl-5 first:mt-0">
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>
              <Inline content={item} />
            </li>
          ))}
        </ul>
      );
    }
    // The "being prepared" sentence is already in the answer's text.
    return <AppLinks key={index} note={false} className="mt-3" />;
  });
}

/** Open the question the address points at (`/faq#cookies`) and bring it into view. */
function openFromHash() {
  const id = decodeURIComponent(window.location.hash.slice(1));
  if (!id) return;
  const target = document.getElementById(id);
  if (target instanceof HTMLDetailsElement) {
    target.open = true;
    // After the browser and the router have settled their own scrolling for this navigation.
    window.setTimeout(() => target.scrollIntoView({ block: "start", behavior: "instant" }), 50);
  }
}

/**
 * The questions, grouped by category, each a native `<details>`: they open
 * and close without JavaScript and every answer is in the HTML.
 *
 * With JavaScript: a box that filters the questions by their text, and the
 * question named in the address (`/faq#why-no-phone-numbers`) opens when the
 * page loads or the hash changes.
 *
 * Specification: design/components/README.md, "FaqList".
 */
export function FaqList({ categories, supportEmail }: Props) {
  const enhanced = useSyncExternalStore(noop, () => true, () => false);
  const [query, setQuery] = useState("");
  const searchId = useId();

  // What each question is found by: its words and its answer's, without case or accents.
  const haystacks = useMemo(
    () =>
      new Map(
        categories.flatMap((category) =>
          category.questions.map((faq) => [faq.id, normalise(`${faq.question} ${faqAnswerText(faq.answer)} ${category.title}`)]),
        ),
      ),
    [categories],
  );
  const words = normalise(query).split(" ").filter(Boolean);
  const matches = (id: string) => words.every((word) => haystacks.get(id)?.includes(word));
  const shown = categories.reduce((sum, category) => sum + category.questions.filter((faq) => matches(faq.id)).length, 0);
  const filtering = words.length > 0;

  useEffect(() => {
    openFromHash();
    // A link to a question shows it even if the filter had hidden it.
    const onHashChange = () => {
      setQuery("");
      openFromHash();
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <div>
      {/* The box needs JavaScript, so it is only drawn once the page is interactive. Its space is kept. */}
      <div className="min-h-[4.75rem] print:hidden">
        {enhanced && (
          <div role="search" aria-label="Questions">
            <label htmlFor={searchId} className="text-sm font-medium text-ink">
              Search the questions
            </label>
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <Input
                id={searchId}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="For example: deposit, password, viewing"
                autoComplete="off"
                className="pl-9"
              />
            </div>
          </div>
        )}
      </div>
      <p role="status" className={filtering && shown > 0 ? "mt-3 text-sm text-muted" : "sr-only"}>
        {filtering ? (shown === 0 ? "No questions match." : shown === 1 ? "1 question matches." : `${shown} questions match.`) : ""}
      </p>

      {filtering && shown === 0 && (
        <div className="mt-4 rounded-lg border border-dashed border-line-strong p-6 text-center">
          <p className="font-semibold text-ink">No questions match</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Try other words, or write to{" "}
            <a href={`mailto:${supportEmail}`} className={linkClass}>
              {supportEmail}
            </a>{" "}
            and we will help.
          </p>
        </div>
      )}

      {categories.map((category) => {
        const visible = category.questions.some((faq) => matches(faq.id));
        return (
          <section key={category.id} id={category.id} aria-labelledby={`${category.id}-title`} hidden={!visible} className="scroll-mt-2 pt-10">
            <h2 id={`${category.id}-title`} className="text-2xl">
              {category.title}
            </h2>
            <div className="mt-3 border-t border-line">
              {category.questions.map((faq) => (
                <details key={faq.id} id={faq.id} hidden={!matches(faq.id)} className="group scroll-mt-2 border-b border-line">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-md py-3 text-ink hover:text-primary-ink [&::-webkit-details-marker]:hidden">
                    <h3 className="font-sans text-base font-semibold tracking-normal">{faq.question}</h3>
                    <ChevronDown
                      className="size-5 shrink-0 text-muted transition-transform duration-150 group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </summary>
                  <div className="max-w-prose pb-5 text-base leading-relaxed text-ink">
                    <FaqAnswer answer={faq.answer} />
                  </div>
                </details>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";

const title = "How we count listing views and enquiries";
const description =
  "What each RightProperty365 listing figure means, how bots and late events are handled, how long events are kept, and why the numbers differ from Google Analytics.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/analytics-definitions" },
  openGraph: { type: "website", title, description, url: "/analytics-definitions", images: ["/opengraph-image"] },
};

type Metric = { id: string; name: string; definition: ReactNode };

const METRICS: Metric[] = [
  {
    id: "impressions",
    name: "Seen in lists (card impressions)",
    definition: (
      <>
        A listing&rsquo;s card was at least half on screen for at least one second, in search results, a row on the home page, the
        featured listings, &ldquo;Similar properties&rdquo; or a visitor&rsquo;s saved properties. Each card counts once per page view, however
        long it stays on screen. Cards on a professional&rsquo;s profile are not counted.
      </>
    ),
  },
  {
    id: "views",
    name: "Listing views",
    definition: (
      <>
        A listing&rsquo;s page was opened by a person. Each opening counts once; the page redrawing itself does not count again, and the same
        visitor opening the same listing again within 30 minutes is counted once.
      </>
    ),
  },
  {
    id: "unique-views",
    name: "Unique views",
    definition: (
      <>
        Different visitors who opened a listing, counted per listing per day. Days are the local days of the listing&rsquo;s country. A view
        that comes without a visit pseudonym (see &ldquo;What we collect&rdquo;) cannot be matched to others, so each such view counts as one
        unique view: unique views can be slightly higher than the true number of people.
      </>
    ),
  },
  {
    id: "contact-clicks",
    name: "Contact clicks",
    definition: (
      <>
        A visitor pressed &ldquo;Send request&rdquo; (or &ldquo;Send request to stay&rdquo;) on a listing&rsquo;s request form. It counts once per listing
        per page view, whether or not the request was then sent. Listings show no phone numbers or email addresses, so this is the one
        contact action.
      </>
    ),
  },
  {
    id: "enquiries",
    name: "Enquiries",
    definition: <>Requests about a listing that our servers received and saved. Counted by our servers, not by the visitor&rsquo;s browser.</>,
  },
  {
    id: "contact-rate",
    name: "Contact rate",
    definition: <>Contact clicks divided by listing views, for the same listings and days. Shown as &ldquo;No views yet&rdquo; when there were no views.</>,
  },
  {
    id: "conversion",
    name: "Enquiry conversion",
    definition: <>Enquiries divided by listing views, for the same listings and days.</>,
  },
  {
    id: "saves",
    name: "Saves",
    definition: <>A signed-in visitor saved the listing. Counted by our servers.</>,
  },
  {
    id: "video-plays",
    name: "Video plays",
    definition: (
      <>
        A visitor pressed play on a listing&rsquo;s video tour. We count the press, not how much was watched: YouTube plays the video and we
        do not read anything back from it.
      </>
    ),
  },
  {
    id: "viewing-requests",
    name: "Viewing requests and viewings confirmed",
    definition: <>A visitor asked for a viewing of the listing, and the advertiser accepted one. Counted by our servers.</>,
  },
  {
    id: "relists",
    name: "Relisted",
    definition: <>The listing was published again after it ended. Counted by our servers.</>,
  },
  {
    id: "funnel",
    name: "From list to enquiry",
    definition: (
      <>
        Seen in lists, listing views, contact clicks and enquiries side by side, each with its share of the step before. Each step is
        counted on its own; we do not follow one visitor through the steps.
      </>
    ),
  },
  {
    id: "sources",
    name: "Where views came from",
    definition: (
      <>
        The kind of site a visitor arrived from: search engines, social media, email, other websites, RightProperty365 itself, or direct
        (typed, bookmarked, or the browser did not say). The browser works out the kind; we never receive or keep the address of the page
        they came from.
      </>
    ),
  },
  {
    id: "devices",
    name: "Devices",
    definition: <>Phones, tablets or computers, judged from the width of the visitor&rsquo;s screen: under 768 pixels, under 1,024 pixels, or wider.</>,
  },
];

function Section({ id, heading, children }: { id: string; heading: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-12">
      <h2 id={id} className="scroll-mt-24 text-2xl">
        {heading}
      </h2>
      <div className="mt-3 max-w-prose space-y-3 leading-relaxed text-muted [&_strong]:text-ink">{children}</div>
    </section>
  );
}

/** Public and static: what every analytics figure means (FR-034, FR-036). Linked from each analytics page and the footer. */
export default function AnalyticsDefinitionsPage() {
  return (
    <Container className="py-10 md:py-14">
      <div className="enter-rise max-w-prose">
        <div className="rule-brand w-12" aria-hidden="true" />
        <h1 className="mt-4 text-3xl md:text-4xl">{title}</h1>
        <p className="mt-3 leading-relaxed text-muted">
          The figures advertisers see on RightProperty365 are our own counts of what happens on this site. This page says what each one means
          and what is left out.
        </p>
        <p className="mt-4 rounded-lg border border-line bg-soft p-4 leading-relaxed text-ink">
          <strong>These are not Google Analytics figures.</strong> We do not use Google Analytics or any other third-party measurement. Our
          numbers will differ from those of third-party tools, which count sessions, visitors, bots and time zones in their own ways.
        </p>
      </div>

      <Section id="metrics" heading="What each figure means">
        <dl className="space-y-5">
          {METRICS.map((metric) => (
            <div key={metric.id} id={metric.id} className="scroll-mt-24">
              <dt className="font-semibold text-ink">{metric.name}</dt>
              <dd className="mt-1">{metric.definition}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="days" heading="Days and time zones">
        <p>
          A day is the local calendar day of the listing&rsquo;s country, so a view at 23:30 in Harare counts on that day in Zimbabwe. Figures for
          several countries add up each country&rsquo;s own days. &ldquo;Last 24 hours&rdquo; is counted as events arrive, is near real time and may still
          change; longer periods are brought up to date every 15 minutes, and each page says when they last were.
        </p>
      </Section>

      <Section id="bots" heading="Bots and automated traffic">
        <p>
          Events from search engine crawlers, other bots, headless browsers and monitoring tools are recognised from the software that sent
          them and left out of every figure. So is a burst of events from one visit or one network far beyond what a person could do (for
          example more than 300 in 10 minutes). Left-out events are counted, and each analytics page says how many there were.
        </p>
        <p>Recognising bots is never perfect: a few may still be counted, and a few people may be left out.</p>
      </Section>

      <Section id="late" heading="Late events">
        <p>
          A browser sometimes sends events later, for example after being offline. We bring the last 3 local days up to date every time, so
          an event that arrives within 3 days counts on the day it happened. An event that arrives more than 3 days late is not counted; how
          many were dropped is shown on each analytics page. An event claiming a time more than 24 hours before we received it, or more than
          5 minutes after, is not counted either.
        </p>
        <p>A browser that sends the same event twice is counted once: every event carries its own random identifier.</p>
      </Section>

      <Section id="collected" heading="What we collect">
        <p>When a visitor browses listings, their browser sends us, for each event:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>what happened (a card seen, a listing opened, a contact click or a press of play) and when;</li>
          <li>which listing, and for a card where it was shown and in which position;</li>
          <li>the kind of site the visit came from, never the address;</li>
          <li>phone, tablet or computer, from the screen width;</li>
          <li>
            a visit pseudonym: a random code made in the browser, kept for that tab and in a first-party cookie named <code>rp_as</code>. It
            changes at local midnight and at least every 24 hours, is not linked to an account, and is never shared with another site.
          </li>
        </ul>
        <p>
          Our servers also keep a shortened form of the network address (the first three parts of an IPv4 address, or the first 48 bits of an
          IPv6 address), only to recognise bots and bursts. The full address is never stored. Saves, enquiries, viewing requests and relists
          are recorded by our servers when they happen, without a visit pseudonym.
        </p>
        <p>
          Advertisers and administrators only ever see totals. No page shows individual events or visitors. Details are in our{" "}
          <Link href="/legal/privacy-policy#measurement" className="font-medium text-primary-ink underline underline-offset-2 hover:no-underline">
            Privacy Policy
          </Link>
          .
        </p>
      </Section>

      <Section id="do-not-track" heading="Do Not Track and Global Privacy Control">
        <p>
          If your browser sends a Do Not Track or Global Privacy Control signal, it sends us no events at all and keeps no visit pseudonym.
          Your visits are then not part of views, impressions, contact clicks or video plays. Enquiries and saves you make are still counted,
          because our servers record them as part of providing the service, without a pseudonym. Sessions of RightProperty365&rsquo;s own
          administrators are never counted.
        </p>
      </Section>

      <Section id="retention" heading="How long events are kept">
        <p>
          Individual events are kept for 90 days and then deleted. The daily totals made from them are kept, so an advertiser&rsquo;s history
          of a listing stays after its events are gone.
        </p>
      </Section>
    </Container>
  );
}

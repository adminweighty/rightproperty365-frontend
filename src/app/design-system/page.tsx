import type { Metadata } from "next";
import { Suspense } from "react";
import cityArtwork from "@/assets/images/city-harare.jpg";
import { PhotoTile, PhotoTileRow } from "@/components/landing/photo-tile";
import { SectionHeading } from "@/components/landing/section-heading";
import { ListingCard } from "@/components/listings/listing-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ErrorState } from "@/components/ui/error-state";
import { Pagination } from "@/components/ui/pagination";
import { listListings } from "@/lib/api/server/listings";
import { load } from "@/lib/api/server/load";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

const swatches = [
  ["page", "bg-page"],
  ["surface", "bg-surface"],
  ["soft", "bg-soft"],
  ["tint", "bg-tint"],
  ["sunken", "bg-sunken"],
  ["line", "bg-line"],
  ["line-accent", "bg-line-accent"],
  ["ink", "bg-ink"],
  ["primary", "bg-primary"],
  ["primary-soft", "bg-primary-soft"],
  ["brand-accent", "bg-brand-accent"],
  ["accent-soft", "bg-accent-soft"],
  ["success", "bg-success"],
  ["warning", "bg-warning"],
  ["danger", "bg-danger"],
  ["info", "bg-info"],
] as const;

const typeScale = [
  ["text-5xl", "Home hero", "font-display text-5xl font-bold tracking-tight"],
  ["text-4xl", "Page title", "font-display text-4xl font-bold tracking-tight"],
  ["text-3xl", "Section title", "font-display text-3xl font-bold tracking-tight"],
  ["text-2xl", "Sub-section, card price", "font-display text-2xl font-bold tracking-tight"],
  ["text-lg", "Lead paragraph", "text-lg"],
  ["text-base", "Body copy", "text-base"],
  ["text-sm", "Supporting text", "text-sm text-muted"],
  ["text-xs", "Labels and badges", "text-xs text-muted"],
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-10">
      <h2 className="text-2xl">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** A real listing from the API, so the card is shown with live data. */
async function ListingCardExample() {
  const loaded = await load(() => listListings({ page_size: 1 }));
  const listing = loaded.ok ? loaded.data?.items[0] : undefined;
  if (!loaded.ok) {
    return <ErrorState title="We could not load a listing for this example." retryHref="/design-system" />;
  }
  return listing ? <ListingCard listing={listing} /> : <p className="text-muted">No listings are published.</p>;
}

/** Living reference for the tokens and components documented in /design. */
export default function DesignSystemPage() {
  return (
    <Container className="py-12">
      <h1 className="text-4xl">Design system</h1>
      <p className="mt-3 max-w-2xl text-muted">
        A live view of the tokens and components. The written guidelines are in the{" "}
        <code className="font-mono text-sm">design/</code> folder of the repository. The site is
        white for everyone and does not follow the device&apos;s dark mode; the dark tokens apply
        only with <code className="font-mono text-sm">data-theme=&quot;dark&quot;</code> on the{" "}
        <code className="font-mono text-sm">html</code> element.
      </p>

      <div className="mt-10">
        <Section title="Colour">
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {swatches.map(([name, className]) => (
              <li key={name}>
                <div className={`h-16 rounded-md border border-line ${className}`} />
                <p className="mt-2 font-mono text-xs text-muted">{name}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Brand accents">
          <p className="max-w-2xl text-muted">
            The logo colours appear as thin lines, never as filled areas. Hover or focus the card
            to see its outline.
          </p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <span aria-hidden="true" className="rule-brand block w-12" />
              <p className="mt-3 font-mono text-xs text-muted">rule-brand</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                The <span className="mark-brand">right property</span>
              </p>
              <p className="mt-3 font-mono text-xs text-muted">mark-brand</p>
            </div>
            <div>
              <a
                href="#brand-accents"
                id="brand-accents"
                className="frame-brand block rounded-lg border border-line bg-surface p-4 text-sm font-semibold text-ink shadow-xs"
              >
                Interactive card
              </a>
              <p className="mt-3 font-mono text-xs text-muted">frame-brand</p>
            </div>
            <div>
              <div className="frame-brand-on rounded-lg border border-line bg-surface p-4 text-sm font-semibold text-ink shadow-xs">
                Sponsored profile
              </div>
              <p className="mt-3 font-mono text-xs text-muted">frame-brand-on</p>
            </div>
          </div>
        </Section>

        <Section title="Typography">
          <ul className="space-y-4">
            {typeScale.map(([token, label, className]) => (
              <li key={token} className="grid items-baseline gap-2 sm:grid-cols-[7rem_1fr]">
                <span className="font-mono text-xs text-muted">{token}</span>
                <span className={className}>{label}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>
        </Section>

        <Section title="Badges">
          <div className="flex flex-wrap gap-2">
            <Badge>Neutral</Badge>
            <Badge tone="primary">Primary</Badge>
            <Badge tone="accent">Accent</Badge>
            <Badge tone="success">Success</Badge>
            <Badge tone="warning">Warning</Badge>
            <Badge tone="danger">Danger</Badge>
            <Badge tone="info">Info</Badge>
          </div>
        </Section>

        <Section title="Form fields">
          <div className="grid max-w-2xl gap-5 sm:grid-cols-2">
            <Field id="ds-text" label="Text input" hint="Hint text sits under the control.">
              <Input id="ds-text" placeholder="Placeholder" aria-describedby="ds-text-hint" />
            </Field>
            <Field id="ds-error" label="With an error" error="Enter a valid email address.">
              <Input id="ds-error" defaultValue="not-an-email" aria-invalid aria-describedby="ds-error-error" />
            </Field>
            <Field id="ds-select" label="Select">
              <Select id="ds-select" defaultValue="rent">
                <option value="sale">For sale</option>
                <option value="rent">To rent</option>
              </Select>
            </Field>
            <Field id="ds-disabled" label="Disabled" optional>
              <Input id="ds-disabled" disabled defaultValue="Read only" />
            </Field>
            <Field id="ds-textarea" label="Textarea" className="sm:col-span-2">
              <Textarea id="ds-textarea" defaultValue="Longer answers go here." />
            </Field>
          </div>
        </Section>

        <Section title="Cards">
          <div className="grid gap-6 md:grid-cols-[1fr_22rem]">
            <Card>
              <h3 className="text-xl">Card</h3>
              <p className="mt-2 text-muted">
                A surface with a hairline border and the lightest shadow. Use it to group related
                content, not to decorate.
              </p>
            </Card>
            <Suspense fallback={<div aria-busy="true" className="h-80 rounded-lg bg-sunken" />}>
              <ListingCardExample />
            </Suspense>
          </div>
        </Section>

        <Section title="Section heading and photo tiles">
          <SectionHeading
            title="Explore by city"
            note="A short rule in the logo colours, the title, one sentence and an optional link."
            href="/listings"
            linkLabel="View all"
          />
          <PhotoTileRow className="mt-8">
            <PhotoTile
              href="/listings"
              title="Photo tile"
              count="12 properties"
              photo={{ src: cityArtwork, bundled: true }}
            />
            <PhotoTile href="/listings" title="Without a photo" count="1 property" />
          </PhotoTileRow>
        </Section>

        <Section title="Pagination">
          <Pagination page={3} totalPages={8} hrefFor={(page) => `/design-system?page=${page}`} label="Example" />
        </Section>

        <Section title="Error state">
          <div className="max-w-xl">
            <ErrorState title="We could not load the listings." retryHref="/design-system" />
          </div>
        </Section>
      </div>
    </Container>
  );
}

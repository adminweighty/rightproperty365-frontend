import type { Metadata } from "next";
import { ListingCard } from "@/components/listings/listing-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { listings } from "@/lib/data/listings";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

const swatches = [
  ["page", "bg-page"],
  ["surface", "bg-surface"],
  ["sunken", "bg-sunken"],
  ["inverse", "bg-inverse"],
  ["brand", "bg-brand"],
  ["brand-accent", "bg-brand-accent"],
  ["primary", "bg-primary"],
  ["primary-soft", "bg-primary-soft"],
  ["accent", "bg-accent"],
  ["accent-soft", "bg-accent-soft"],
  ["success", "bg-success"],
  ["warning", "bg-warning"],
  ["danger", "bg-danger"],
  ["info", "bg-info"],
] as const;

const typeScale = [
  ["text-6xl", "Display", "font-display text-6xl"],
  ["text-4xl", "Page title", "font-display text-4xl"],
  ["text-3xl", "Section title", "font-display text-3xl"],
  ["text-2xl", "Sub-section", "font-display text-2xl"],
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

/** Living reference for the tokens and components documented in /design. */
export default function DesignSystemPage() {
  return (
    <Container className="py-12">
      <h1 className="text-4xl">Design system</h1>
      <p className="mt-3 max-w-2xl text-muted">
        A live view of the tokens and components. The written guidelines are in the{" "}
        <code className="font-mono text-sm">design/</code> folder of the repository. Switch your
        device between light and dark to check both themes.
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
            <ListingCard listing={listings[0]} />
          </div>
        </Section>
      </div>
    </Container>
  );
}

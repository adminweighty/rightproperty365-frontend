import { ChipNav } from "@/components/portal/portal-ui";

export type ActivityTab = "requests" | "appointments" | "saved";

const TABS: { key: ActivityTab; href: string; label: string }[] = [
  { key: "requests", href: "/account/requests", label: "Requests" },
  { key: "appointments", href: "/account/appointments", label: "Appointments" },
  { key: "saved", href: "/account/saved", label: "Saved" },
];

/**
 * The customer's activity pages, one row of links at the top of each: what
 * they asked about, the viewings they arranged and the properties they saved.
 * Each page says which one it is, so nothing here reads the address.
 */
export function ActivityNav({ current, className }: { current: ActivityTab; className?: string }) {
  return (
    <div className={className}>
      <ChipNav
        label="Your activity"
        items={TABS.map((tab) => ({ key: tab.key, href: tab.href, label: tab.label, current: tab.key === current }))}
      />
    </div>
  );
}

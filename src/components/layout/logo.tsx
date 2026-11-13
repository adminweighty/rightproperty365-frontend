import { cn } from "@/lib/cn";

/**
 * PROVISIONAL wordmark. Replace with the official logo files once they are
 * added to design/assets/logo (see the README there).
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden="true">
        <rect width="32" height="32" rx="8" className="fill-primary" />
        <path
          d="M8 16.5 16 9l8 7.5M11 14.5V23h10v-8.5"
          fill="none"
          className="stroke-on-primary"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="font-display text-xl font-medium tracking-tight text-ink">
        RightProperty<span className="text-accent-ink">365</span>
      </span>
    </span>
  );
}

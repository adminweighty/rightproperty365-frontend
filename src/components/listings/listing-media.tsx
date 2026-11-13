import { cn } from "@/lib/cn";
import type { Listing } from "@/lib/data/listings";

const tones: Record<Listing["tone"], string> = {
  evergreen: "bg-primary-soft text-primary-ink",
  ochre: "bg-accent-soft text-accent-ink",
  stone: "bg-sunken text-subtle",
};

/**
 * Placeholder artwork shown until real listing photos come from object
 * storage. Decorative only, so it is hidden from assistive technology.
 */
export function ListingMedia({ tone, className }: { tone: Listing["tone"]; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("relative flex items-end justify-center overflow-hidden", tones[tone], className)}
    >
      <svg viewBox="0 0 320 180" className="h-full w-full" preserveAspectRatio="xMidYMax slice">
        <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" opacity="0.55">
          <path d="M0 150h320" />
          <path d="M70 150V96l50-36 50 36v54" />
          <path d="M170 150v-70h78v70" />
          <path d="M104 150v-30h32v30M186 98h18v18h-18zM216 98h18v18h-18zM186 124h18v26h-18z" />
          <path d="M268 150v-26m0 0c-12 0-18-10-18-20s8-20 18-20 18 10 18 20-6 20-18 20z" />
        </g>
      </svg>
    </div>
  );
}

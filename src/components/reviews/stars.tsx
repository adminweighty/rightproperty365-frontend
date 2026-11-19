import { Star, StarHalf } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatAverage, ratingWords, RATING_MAX, starFills, starsWords } from "@/lib/reviews";

/*
 * Stars for reviews of service providers. Drawn stars are decoration: the
 * words ("4.5 out of 5 from 12 reviews", "4 out of 5 stars") are always
 * there for screen readers, and visible where the figure matters.
 */

const sizes = { sm: "size-4", md: "size-5", lg: "size-6" } as const;

/** Five stars for a value (an average or one rating), hidden from screen readers. */
export function StarRow({ value, size = "sm", className }: { value: number; size?: keyof typeof sizes; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("inline-flex shrink-0 items-center gap-0.5", className)}>
      {starFills(value).map((fill, index) =>
        fill === "half" ? (
          <span key={index} className={cn("relative inline-block", sizes[size])}>
            <Star className={cn("absolute inset-0 text-line-strong", sizes[size])} />
            <StarHalf className={cn("absolute inset-0 fill-warning text-warning", sizes[size])} />
          </span>
        ) : (
          <Star key={index} className={cn(sizes[size], fill === "full" ? "fill-warning text-warning" : "text-line-strong")} />
        ),
      )}
    </span>
  );
}

/** One review's rating: stars, with "4 out of 5 stars" for screen readers. */
export function ReviewStars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center", className)}>
      <StarRow value={rating} />
      <span className="sr-only">{starsWords(rating)}</span>
    </span>
  );
}

/**
 * The profile's average and count: "★★★★½ 4.5 (12 reviews)", read as "4.5 out
 * of 5 from 12 reviews". Nothing at all without a published review.
 */
export function RatingSummaryLine({
  average,
  count,
  href,
  size = "md",
  className,
}: {
  average: number | null;
  count: number;
  /** The reviews section, when the line should jump to it. */
  href?: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const words = ratingWords(average, count);
  if (!words || average === null) return null;
  const body = (
    <>
      <StarRow value={average} size={size} />
      <span aria-hidden="true" className="font-semibold text-ink tabular-nums">
        {formatAverage(average)}
      </span>
      <span aria-hidden="true" className="text-muted">
        ({count === 1 ? "1 review" : `${count} reviews`})
      </span>
      <span className="sr-only">{words}</span>
    </>
  );
  return href ? (
    <a href={href} className={cn("inline-flex min-h-11 flex-wrap items-center gap-2 text-sm hover:underline", className)}>
      {body}
    </a>
  ) : (
    <p className={cn("inline-flex flex-wrap items-center gap-2 text-sm", className)}>{body}</p>
  );
}

/**
 * The rating input: a group of five native radio buttons drawn as stars.
 * Arrow keys move between them and choose, as any radio group does; each
 * star is a 44px target, and the chosen value is said in words.
 */
export function StarRatingInput({
  id,
  value,
  onChange,
  error,
  disabled,
  legend = "Your rating",
}: {
  id: string;
  value: number | null;
  onChange: (value: number) => void;
  error?: string;
  disabled?: boolean;
  legend?: string;
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <fieldset aria-describedby={error ? errorId : hintId} className="min-w-0">
      <legend id={`${id}-legend`} className="text-sm font-medium text-ink">{legend}</legend>
      <div role="radiogroup" aria-labelledby={`${id}-legend`} aria-invalid={Boolean(error) || undefined} className="mt-1 flex flex-wrap items-center">
        {Array.from({ length: RATING_MAX }, (_, index) => {
          const n = index + 1;
          const filled = value !== null && n <= value;
          return (
            <label
              key={n}
              className={cn(
                "relative flex size-11 cursor-pointer items-center justify-center rounded-md",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-focus",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                type="radio"
                name={id}
                value={n}
                checked={value === n}
                disabled={disabled}
                onChange={() => onChange(n)}
                className="peer sr-only"
                id={n === 1 ? id : undefined}
              />
              <Star aria-hidden="true" className={cn("size-7 transition-colors", filled ? "fill-warning text-warning" : "text-line-strong")} />
              <span className="sr-only">{n === 1 ? "1 star" : `${n} stars`}</span>
            </label>
          );
        })}
        <span id={hintId} aria-live="polite" className="ml-2 text-sm text-muted">
          {value ? starsWords(value) : "Not chosen yet"}
        </span>
      </div>
      {error && (
        <p id={errorId} className="mt-1 text-sm text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}

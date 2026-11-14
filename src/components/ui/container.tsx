import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** The page width, for an element that is its own wrapper (a motion component standing in for a `Container`). */
export const containerClass = "mx-auto w-full max-w-[75rem] px-4 md:px-8";

/** Page-width wrapper: 1200px max, 16px gutter on phones, 32px from tablet up. */
export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(containerClass, className)} {...props} />;
}

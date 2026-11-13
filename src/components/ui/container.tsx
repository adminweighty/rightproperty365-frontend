import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Page-width wrapper: 1200px max, 16px gutter on phones, 32px from tablet up. */
export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-[75rem] px-4 md:px-8", className)} {...props} />;
}

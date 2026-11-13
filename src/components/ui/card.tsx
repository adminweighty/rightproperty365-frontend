import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type CardProps = ComponentProps<"div"> & { padded?: boolean };

export function Card({ padded = true, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-line bg-surface shadow-xs",
        padded && "p-6",
        className,
      )}
      {...props}
    />
  );
}

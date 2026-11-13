import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "danger" | "success" | "info" | "warning";

const tones: Record<Tone, string> = {
  danger: "bg-danger-soft text-danger",
  success: "bg-success-soft text-success",
  info: "bg-info-soft text-info",
  warning: "bg-warning-soft text-warning",
};

type AlertProps = {
  tone?: Tone;
  title: string;
  /** Shown under the message when the API supplies one. */
  traceId?: string;
  className?: string;
  children?: ReactNode;
};

/** Inline message about the result of an action. Danger alerts interrupt screen readers. */
export function Alert({ tone = "danger", title, traceId, className, children }: AlertProps) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("rounded-md p-3 text-sm", tones[tone], className)}
    >
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 text-ink">{children}</div>}
      {traceId && <p className="mt-1 text-xs">Support reference: {traceId}</p>}
    </div>
  );
}

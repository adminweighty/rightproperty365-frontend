import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** The look of every form control: border, text, hover, focus, invalid and disabled. */
export const controlClass =
  "w-full rounded-md border border-control bg-surface px-3 text-base text-ink " +
  "placeholder:text-subtle transition-colors duration-150 " +
  "hover:border-ink focus-visible:border-focus " +
  "aria-invalid:border-danger disabled:cursor-not-allowed disabled:bg-sunken disabled:opacity-60";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlClass, "h-11", className)} {...props} />;
}

export function Textarea({ className, rows = 4, ...props }: ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cn(controlClass, "py-2.5 leading-relaxed", className)} {...props} />;
}

type FieldProps = {
  /** id of the control inside; used for the label and the hint/error ids. */
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * Label + control + hint/error. The control must set `id={id}` and
 * `aria-describedby={fieldDescribedBy(id, { hint, error })}`.
 */
export function Field({ id, label, hint, error, optional, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {optional && <span className="ml-1 font-normal text-subtle">(optional)</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function fieldDescribedBy(id: string, { hint, error }: { hint?: string; error?: string }) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

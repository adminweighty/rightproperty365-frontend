"use client";

import { useEffect, useRef } from "react";

/**
 * The danger summary at the top of a form that could not be sent: a 4px
 * bar, `role="alert"`, focused, with a link to each control that needs a
 * change (as the books' entry form).
 */
export function ErrorSummary({ items, title = "Check the form" }: { items: { id: string; text: string }[]; title?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const signature = items.map((item) => `${item.id}:${item.text}`).join("|");
  useEffect(() => {
    if (signature) ref.current?.focus();
  }, [signature]);
  if (items.length === 0) return null;
  return (
    <div ref={ref} tabIndex={-1} role="alert" className="rounded-md border-l-4 border-danger bg-danger-soft p-4 text-sm">
      <p className="font-medium text-danger">{title}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-ink">
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`} className="font-medium text-primary-ink underline">
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

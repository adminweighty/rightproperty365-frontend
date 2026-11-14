"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { firstProblem, type Problems } from "@/lib/auth-validation";

/**
 * The inline errors of an account form, whether they come from the checks in
 * the browser or from the API's `fields`.
 *
 * `selectors` maps each field, in the order of the form, to the control that
 * takes focus when that field is the first with an error. It must be a
 * constant. `aliases` maps the `name` of a control to its field where the two
 * differ.
 *
 * - `show(problems)` displays them and moves focus to the first invalid field
 *   once its message is on the page, so a screen reader reads the message.
 * - `onChange` goes on the `<form>`: changing a control clears its error.
 */
export function useFieldErrors(selectors: Record<string, string>, aliases: Record<string, string> = {}) {
  const form = useRef<HTMLFormElement>(null);
  const focusNext = useRef<string | null>(null);
  const [errors, setErrors] = useState<Problems>({});

  useEffect(() => {
    if (!focusNext.current) return;
    form.current?.querySelector<HTMLElement>(focusNext.current)?.focus();
    focusNext.current = null;
  });

  const show = useCallback(
    (problems: Problems) => {
      const first = firstProblem(Object.keys(selectors), problems);
      focusNext.current = first ? selectors[first] : null;
      setErrors(problems);
    },
    [selectors],
  );

  const clear = useCallback((field: string) => {
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  }, []);

  const onChange = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      const name = (event.target as HTMLInputElement).name;
      if (name) clear(aliases[name] ?? name);
    },
    [aliases, clear],
  );

  return { form, errors, show, clear, onChange };
}

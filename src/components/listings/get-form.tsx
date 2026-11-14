"use client";

import type { ComponentProps } from "react";

/**
 * A GET form that leaves empty fields out of the address it submits to, so a
 * search for rentals in Harare is `/listings?deal=rent&city=harare` rather
 * than a row of empty parameters. It is an ordinary form: without JavaScript
 * it still submits, only with the empty parameters included (the page
 * ignores them and the canonical address drops them).
 */
export function GetForm(props: ComponentProps<"form">) {
  return (
    <form
      {...props}
      method="get"
      onSubmit={(event) => {
        const empty = [...event.currentTarget.elements].filter(
          (control): control is HTMLInputElement | HTMLSelectElement =>
            (control instanceof HTMLInputElement || control instanceof HTMLSelectElement) &&
            control.name !== "" &&
            control.value === "" &&
            !control.disabled,
        );
        // Disabled controls are not submitted. Re-enable them straight after
        // the browser has read the form, so "back" shows a working form.
        empty.forEach((control) => (control.disabled = true));
        window.setTimeout(() => empty.forEach((control) => (control.disabled = false)), 0);
      }}
    />
  );
}

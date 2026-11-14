import { FlaskConical } from "lucide-react";
import { env } from "@/lib/env";

/**
 * Disclaimer shown at the top of every page on a test copy of the site
 * (staging). It renders nothing on the live site. It is plain HTML with no
 * dismiss button: the notice must stay true for everyone who arrives on any
 * page, including people who follow a link from an email.
 */
export function TestSiteBanner() {
  if (!env.testSite) return null;

  return (
    <aside
      aria-label="Test site notice"
      className="border-b border-line bg-warning-soft text-ink"
    >
      <div className="mx-auto flex w-full max-w-[75rem] items-start gap-3 px-3 py-2.5 sm:px-4 md:px-8">
        <FlaskConical className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
        <p className="text-sm leading-relaxed">
          <strong className="font-semibold text-warning">This is a test site.</strong>{" "}
          The properties, businesses and accounts shown here are sample data, not real offers.{" "}
          {/* The middle sentence is dropped on phones to keep the band short. */}
          <span className="hidden sm:inline">
            Enquiries and bookings made here are not sent to real agents or owners.{" "}
          </span>
          Do not enter real personal or payment details.
        </p>
      </div>
    </aside>
  );
}

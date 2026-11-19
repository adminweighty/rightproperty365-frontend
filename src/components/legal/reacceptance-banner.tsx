"use client";

import { FileText } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { LEGAL_UPDATES_PATH, reacceptanceHeadline, showReacceptanceBanner } from "@/lib/legal-versions";

/**
 * "We've updated our Terms — review and accept", under the header for a
 * signed-in person when `GET /v1/me` lists `pending_legal_acceptances`
 * (API 0.43.0). It blocks nothing: every page keeps working. The list is
 * normally empty, and then this renders nothing.
 */
export function ReacceptanceBanner() {
  const auth = useAuth();
  const pathname = usePathname();
  const pending = auth.status === "authenticated" ? auth.pendingLegalAcceptances : null;
  if (!pending || !showReacceptanceBanner({ status: auth.status, pending, pathname })) return null;

  return (
    <aside aria-label="Updated legal documents" className="border-b border-line bg-info-soft text-ink">
      <div className="mx-auto flex w-full max-w-[75rem] flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 sm:px-4 md:px-8">
        <FileText className="size-5 shrink-0 text-info" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-sm leading-relaxed">
          <strong className="font-semibold">{reacceptanceHeadline(pending)}</strong>
          {" — "}
          <Link href={LEGAL_UPDATES_PATH} className="font-semibold text-primary-ink underline underline-offset-2">
            review and accept
          </Link>
        </p>
      </div>
    </aside>
  );
}

"use client";

import { ClipboardList } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { ButtonLink } from "@/components/ui/button";

/**
 * "Apply for this property" on a listing whose intake is open (API 0.32.0).
 * The page is cached and the same for everyone, so the server renders the
 * link to the apply page; in the browser a signed-out visitor's link goes to
 * sign-in first and comes back to the application.
 */
export function ApplyButton({ slug, title, className }: { slug: string; title: string; className?: string }) {
  const { status } = useAuth();
  const apply = `/apply/${slug}`;
  const href = status === "anonymous" ? `/sign-in?next=${encodeURIComponent(apply)}` : apply;
  return (
    <ButtonLink href={href} size="lg" className={className}>
      <ClipboardList className="size-4" aria-hidden="true" />
      Apply for this property
      <span className="sr-only">: {title}</span>
    </ButtonLink>
  );
}

import { Suspense, type ReactNode } from "react";
import { apiAtBuild } from "@/lib/api/server/load";

type Props = {
  /** Shown while the content loads, in a build made without the API. Match the content's size. */
  fallback: ReactNode;
  children: ReactNode;
};

/**
 * Wraps a component that reads the API through `load()`.
 *
 * In a build made with the API (the normal case) it renders its children
 * directly. Their data is cached, so they are part of the page's HTML and
 * are visible without JavaScript. A `<Suspense>` here would undo that: React
 * moves the finished content of any boundary larger than about 500 bytes
 * into a hidden element at the end of the document and reveals it with an
 * inline script.
 *
 * In a build made without the API it is a `<Suspense>`: the content cannot be
 * prerendered, so the fallback is stored and the content is streamed in on
 * each request (src/lib/api/server/load.ts).
 *
 * A page whose content also reads `params` or `searchParams` must export
 * `instant = false`, because without the boundary it has no static shell for
 * addresses that were not prerendered: the server renders the whole page
 * before it answers.
 */
export function ApiBoundary({ fallback, children }: Props) {
  if (apiAtBuild) return children;
  return <Suspense fallback={fallback}>{children}</Suspense>;
}

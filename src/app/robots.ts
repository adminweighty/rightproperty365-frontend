import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

/**
 * Private pages (sign-in, account, agent inbox, design system) are kept out of
 * search with a `noindex` robots meta tag, NOT listed here: a crawler that is
 * blocked from a page can never see its noindex.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}

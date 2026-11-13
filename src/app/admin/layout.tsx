import type { Metadata } from "next";

// Nothing under /admin is public: keep it out of search results and do not
// link to it from public pages (administrators are given the address).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return children;
}

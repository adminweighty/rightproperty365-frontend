import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";
import { eula } from "@/content/legal/eula";
import { legalDocument } from "@/lib/legal";

const info = legalDocument("eula");

export const metadata: Metadata = {
  title: info.title,
  description: info.description,
  alternates: { canonical: info.path },
  openGraph: { type: "article", title: info.title, description: info.description, url: info.path, images: ["/opengraph-image"] },
};

export default function Page() {
  return <LegalDocument document="eula" content={eula} />;
}

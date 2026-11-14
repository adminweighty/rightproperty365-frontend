import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";
import { privacyPolicy } from "@/content/legal/privacy-policy";
import { legalDocument } from "@/lib/legal";

const info = legalDocument("privacyPolicy");

export const metadata: Metadata = {
  title: info.title,
  description: info.description,
  alternates: { canonical: info.path },
  openGraph: { type: "article", title: info.title, description: info.description, url: info.path, images: ["/opengraph-image"] },
};

export default function Page() {
  return <LegalDocument document="privacyPolicy" content={privacyPolicy} />;
}

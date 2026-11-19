import type { Metadata } from "next";
import { FileScans } from "@/components/admin/file-scans";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Upload scanning", robots: { index: false, follow: false } };

// Read in the browser with the administrator's session; nothing is rendered on the server.
export default function FileScansPage() {
  return (
    <Container className="max-w-5xl py-10 md:py-14">
      <FileScans />
    </Container>
  );
}

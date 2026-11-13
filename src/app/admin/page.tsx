import type { Metadata } from "next";
import { AdminHome } from "@/components/admin/admin-home";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Administration", robots: { index: false, follow: false } };

export default function AdminPage() {
  return (
    <Container className="py-10 md:py-14">
      <AdminHome />
    </Container>
  );
}

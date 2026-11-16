import type { Metadata } from "next";
import { DeleteAccount } from "@/components/account/delete-account";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Delete your account", robots: { index: false, follow: false } };

// Shown in the browser with the session cookie; nothing is read on the server.
export default function DeleteAccountPage() {
  return (
    <Container className="max-w-3xl py-10 md:py-14">
      <DeleteAccount />
    </Container>
  );
}

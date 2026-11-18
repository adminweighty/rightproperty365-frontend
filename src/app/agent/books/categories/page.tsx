import type { Metadata } from "next";
import { Suspense } from "react";
import { BooksCategories } from "@/components/agent/books/categories";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Books categories", robots: { index: false, follow: false } };

/** The categories are private: read and changed in the browser with the session cookie. */
export default function BooksCategoriesPage() {
  return (
    <Container className="max-w-4xl py-10 md:py-14">
      <Suspense fallback={<div className="h-64 rounded-lg bg-sunken" aria-busy="true" />}>
        <BooksCategories />
      </Suspense>
    </Container>
  );
}

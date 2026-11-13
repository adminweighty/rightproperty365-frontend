import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export default function NotFound() {
  return (
    <Container className="py-24 text-center">
      <h1 className="text-4xl">We could not find that page</h1>
      <p className="mx-auto mt-3 max-w-md text-muted">
        The listing may have expired or been removed. Current listings are a search away.
      </p>
      <ButtonLink href="/listings" className="mt-8">
        Browse listings
      </ButtonLink>
    </Container>
  );
}

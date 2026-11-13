/**
 * Renders structured data as a native script tag, as the Next.js docs advise
 * (not next/script). "<" is escaped so listing text can never close the tag.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

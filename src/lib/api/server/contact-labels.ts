import type { ContactLabels } from "@/components/agent/contacts/shared";
import { load } from "@/lib/api/server/load";
import { getCatalogue } from "@/lib/api/server/reference";
import { toLabels } from "@/lib/api/types";

/**
 * The words of the contact book from the API's reference data: contact types,
 * sources and (when the API has such a set) stage labels. When they cannot
 * be loaded the pages still work and show the codes.
 */
export async function contactLabels(): Promise<ContactLabels> {
  const loaded = await load(getCatalogue);
  const sets = loaded.ok ? loaded.data.sets : undefined;
  return {
    types: sets ? toLabels(sets.contact_types ?? []) : {},
    sources: sets ? toLabels(sets.contact_sources ?? []) : {},
    stages: sets ? toLabels(sets.contact_stages ?? []) : {},
  };
}

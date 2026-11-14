import { cacheLife, cacheTag } from "next/cache";
import type { OnboardingRequirements } from "@/lib/api/onboarding";
import type { Option } from "@/lib/api/types";
import { apiGet } from "./client";
import { getDirectoryList } from "./directory";
import { getCatalogue } from "./reference";

/** What each professional role has to provide. Changes rarely, like the reference data. */
export async function getOnboardingRequirements(): Promise<OnboardingRequirements[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("reference", "onboarding");
  const { data } = await apiGet<{ roles: OnboardingRequirements[] }>("/v1/onboarding/requirements");
  return data.roles;
}

/** The directory an applicant picks their agency from (the API's `agencies` directory). */
const AGENCY_DIRECTORY = "agencies";

/** The lists the onboarding and review screens choose from and label with. */
export type OnboardingLists = {
  requirements: OnboardingRequirements[];
  cities: Option[];
  trades: Option[];
  /** Verified agencies an agency member can ask to join; `value` is the agency's slug. */
  agencies: Option[];
};

export async function getOnboardingLists(): Promise<OnboardingLists> {
  const [requirements, catalogue, agencies] = await Promise.all([
    getOnboardingRequirements(),
    getCatalogue(),
    getDirectoryList(AGENCY_DIRECTORY),
  ]);
  return {
    requirements,
    cities: catalogue.sets.cities.map(({ code, label }) => ({ value: code, label })),
    trades: catalogue.sets.service_trades.map(({ code, label }) => ({ value: code, label })),
    agencies: (agencies?.profiles ?? [])
      .filter((profile) => profile.verified)
      .map(({ slug, name }) => ({ value: slug, label: name })),
  };
}

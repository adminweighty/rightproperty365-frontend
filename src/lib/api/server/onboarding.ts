import { cacheLife, cacheTag } from "next/cache";
import type { OnboardingRequirements } from "@/lib/api/onboarding";
import type { ChoiceOption } from "@/components/onboarding/fields";
import type { Option } from "@/lib/api/types";
import { apiGet } from "./client";
import { getDirectoryList } from "./directory";
import { getAllCountries, getCatalogue } from "./reference";

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
  /** Every country: an applicant may be anywhere. The code is a search word ("GB", "ZW"). */
  countries: ChoiceOption[];
  /** The cities of every country that has reference cities, each with its country. */
  cities: ChoiceOption[];
  trades: Option[];
  /** Verified agencies an agency member can ask to join; `value` is the agency's slug. */
  agencies: Option[];
};

export async function getOnboardingLists(): Promise<OnboardingLists> {
  const [requirements, catalogue, countries, agencies] = await Promise.all([
    getOnboardingRequirements(),
    getCatalogue(),
    getAllCountries(),
    getDirectoryList(AGENCY_DIRECTORY),
  ]);
  return {
    requirements,
    countries: countries.map(({ code, name }) => ({ value: code, label: name, keywords: [code] })),
    cities: catalogue.sets.cities.map(({ code, label, market_code }) => ({
      value: code,
      label,
      country: market_code ?? undefined,
    })),
    trades: catalogue.sets.service_trades.map(({ code, label }) => ({ value: code, label })),
    agencies: (agencies?.profiles ?? [])
      .filter((profile) => profile.verified)
      .map(({ slug, name }) => ({ value: slug, label: name })),
  };
}

import { apiFetch } from "@/lib/api/http";
import { taxRuleFilterQuery, type TaxRuleFilters, type TaxRuleInput } from "@/lib/tax-rules";

/**
 * Tax rules per market (API 0.43.0, SUPER_ADMIN and FINANCE_ADMIN). Stored
 * and looked up only: nothing computes tax from them yet, and the site never
 * shows them to customers.
 */

export type TaxRule = {
  id: string;
  market_code: string;
  tax_name: string;
  /** A decimal string percent ("15", "12.5"): never turned into a float. */
  rate: string;
  applies_to: string;
  inclusive: boolean;
  effective_from: string;
  /** Exclusive; null is open-ended. */
  effective_to: string | null;
  registration_number_label: string | null;
  status: "ACTIVE" | "RETIRED";
  /** A sample value to confirm with a tax adviser. */
  is_sample: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const adminListTaxRules = (filters: TaxRuleFilters) =>
  apiFetch<{ tax_rules: TaxRule[] }>(`/v1/admin/tax-rules${taxRuleFilterQuery(filters)}`, { cache: "no-store" });

export const adminGetTaxRule = (id: string) =>
  apiFetch<{ tax_rule: TaxRule }>(`/v1/admin/tax-rules/${encodeURIComponent(id)}`, { cache: "no-store" });

/** Creates an ACTIVE rule. 409 `TAX_RULE_OVERLAP` when another active rule covers the same time. */
export const adminCreateTaxRule = (input: TaxRuleInput) =>
  apiFetch<{ tax_rule: TaxRule }>("/v1/admin/tax-rules", { method: "POST", body: input });

/** Changes any field but the market and what it applies to. `is_sample: false` confirms a sample. */
export const adminUpdateTaxRule = (id: string, input: Omit<TaxRuleInput, "market_code" | "applies_to">) =>
  apiFetch<{ tax_rule: TaxRule }>(`/v1/admin/tax-rules/${encodeURIComponent(id)}`, { method: "PATCH", body: input });

/** 409 `TAX_RULE_RETIRED` when it already is. */
export const adminRetireTaxRule = (id: string) =>
  apiFetch<{ tax_rule: TaxRule }>(`/v1/admin/tax-rules/${encodeURIComponent(id)}/retire`, { method: "POST", body: {} });

/** The rule in force for a market and use at a time (query from `lookupQuery`). `tax_rule` is null when none is. */
export const adminLookupTaxRule = (query: string) =>
  apiFetch<{ tax_rule: TaxRule | null }>(`/v1/admin/tax-rules/lookup${query}`, { cache: "no-store" });

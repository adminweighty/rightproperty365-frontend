// Checks the campaign rules (API 0.58.0): reading UTM parameters, cleaning
// them as the API does, keeping the session's campaign and the label. Run
// with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CAMPAIGN_MAX,
  campaignFromSearch,
  campaignLabel,
  cleanCampaignValue,
  nextCampaign,
  readStoredCampaign,
} from "../src/lib/analytics/campaign.ts";

test("values are cleaned like the API does", () => {
  assert.equal(cleanCampaignValue("  Facebook "), "facebook");
  assert.equal(cleanCampaignValue("Summer   Sale\t2026"), "summer sale 2026");
  assert.equal(cleanCampaignValue("cpc<script>"), "cpcscript");
  assert.equal(cleanCampaignValue("news-letter_01.v2+x:y/z"), "news-letter_01.v2+x:y/z");
  assert.equal(cleanCampaignValue("Ñandú"), "ñandú");
  assert.equal(cleanCampaignValue("<>"), "");
  assert.equal(cleanCampaignValue(null), "");
  assert.equal(cleanCampaignValue("a".repeat(150)).length, CAMPAIGN_MAX);
  assert.equal(cleanCampaignValue("ab ".repeat(60)), "ab ".repeat(60).slice(0, CAMPAIGN_MAX));
});

test("only the three UTM parameters are read", () => {
  assert.deepEqual(campaignFromSearch("?utm_source=Google&utm_medium=CPC&utm_campaign=Spring+Sale&utm_term=x&gclid=y"), {
    source: "google",
    medium: "cpc",
    campaign: "spring sale",
  });
  assert.deepEqual(campaignFromSearch("?utm_source=newsletter"), { source: "newsletter", medium: "", campaign: "" });
  assert.equal(campaignFromSearch("?q=house&utm_term=x"), null);
  assert.equal(campaignFromSearch(""), null);
  assert.equal(campaignFromSearch("?utm_source=%3C%3E"), null);
});

test("a new landing campaign replaces the stored one, a plain address keeps it", () => {
  const stored = JSON.stringify({ source: "facebook", medium: "cpc", campaign: "spring" });
  assert.deepEqual(nextCampaign("?page=2", stored), { source: "facebook", medium: "cpc", campaign: "spring" });
  assert.deepEqual(nextCampaign("?utm_source=email", stored), { source: "email", medium: "", campaign: "" });
  assert.equal(nextCampaign("", null), null);
  assert.equal(readStoredCampaign("not json"), null);
  assert.equal(readStoredCampaign("[1]"), null);
  assert.equal(readStoredCampaign(JSON.stringify({ source: 5 })), null);
});

test("label", () => {
  assert.equal(campaignLabel({ source: "facebook", medium: "cpc", campaign: "spring sale" }), "facebook · cpc · spring sale");
  assert.equal(campaignLabel({ source: "newsletter", medium: "", campaign: "" }), "newsletter");
  assert.equal(campaignLabel(null), "No campaign");
});

/**
 * How a country's name reads in a sentence.
 *
 * Country names come from the API (`GET /v1/markets`: `code` and `name`);
 * there is no list of countries here. The only thing written in the app is
 * which few names take "the" in English ("in the United Kingdom", but "in
 * Zimbabwe"), keyed by ISO 3166-1 alpha-2 code so it does not depend on how
 * the API spells the name.
 */
const TAKES_ARTICLE = new Set([
  "AE", // the United Arab Emirates
  "BS", // the Bahamas
  "CD", // the Democratic Republic of the Congo
  "CF", // the Central African Republic
  "CG", // the Republic of the Congo
  "CZ", // the Czech Republic
  "DO", // the Dominican Republic
  "GB", // the United Kingdom
  "GM", // the Gambia
  "KM", // the Comoros
  "MH", // the Marshall Islands
  "MV", // the Maldives
  "NL", // the Netherlands
  "PH", // the Philippines
  "SB", // the Solomon Islands
  "SC", // the Seychelles
  "US", // the United States
]);

/**
 * A country's name as it follows "in": "the United Kingdom", "Zimbabwe".
 * A name that already starts with "The" is not given a second one.
 */
export function countryInSentence(code: string, name: string): string {
  if (/^the\s/i.test(name)) return `the ${name.replace(/^the\s+/i, "")}`;
  return TAKES_ARTICLE.has(code.toUpperCase()) ? `the ${name}` : name;
}
